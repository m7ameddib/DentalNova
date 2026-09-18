import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { DeploymentService } from '../common/deployment.service';
import { PlatformService } from '../platform/platform.service';
import { PathsService } from '../common/paths.service';
import { JwtSecretService } from '../auth/jwt-secret.service';
import { InstallationRepository } from '../installation/installation.repository';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { LicenseService } from '../common/license.service';
import { isLicenseExpiryDue, reconstructLicenseText } from '../common/license-state.util';
import { SYNC_DEVICE_JWT_ISSUER } from '../auth/jwt-payload.util';
import { AuthenticatedUser } from '../auth/auth.types';
import { getTenantClinicId } from '../platform/tenant-context';
import { Request } from 'express';
import {
  censusAttestationFromClinic,
  clinicOperationalCensus,
  isEmptyCensusAttestation,
  POPULATED_OFFLINE_CODE,
  populatedOfflineMessage,
} from './clinic-census.util';
import {
  compactPairingCode,
  INVALID_ONLINE_URL,
  normalizeOnlineBaseUrl,
  PublicPeerInfo,
  StoredPeerConfig,
  toPublicPeerInfo,
} from './pairing-public.util';
import {
  describeOnlineReachabilityError,
  messageFromOnlineResponse,
} from './online-reachability.util';
import {
  CENSUS_PROOF_INVALID,
  CensusProofInput,
  challengesMatch,
  isCompatibleSyncProtocol,
  isPairingSyncProtocol,
  parseSyncProtocolVersion,
  signCensusProof,
  SYNC_PROTOCOL_MISMATCH,
  SYNC_PROTOCOL_VERSION,
  syncProtocolHeaders,
  verifyCensusProof,
} from './sync-protocol.util';
import {
  canonicalPairingTranscript,
  DEVICE_INSTALL_ALREADY_PAIRED,
  DEVICE_INSTALL_ALREADY_PAIRED_CODE,
  DEVICE_KEY_ALREADY_REGISTERED,
  DEVICE_KEY_ALREADY_REGISTERED_CODE,
  DEVICE_SIGNATURE_INVALID,
  DEVICE_SIGNATURE_INVALID_CODE,
  DEVICE_TRUST_REQUIRED,
  DEVICE_TRUST_REQUIRED_CODE,
  generateDeviceKeypair,
  isDevicePublicKeyFormat,
  signWithDeviceKey,
  verifyDeviceSignature,
  verifyExpressDeviceRequest,
  deviceTrustHeaders,
} from './device-trust.util';

export type { StoredPeerConfig, PublicPeerInfo } from './pairing-public.util';

@Injectable()
export class SyncPairingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly platform: PlatformService,
    private readonly deployment: DeploymentService,
    private readonly paths: PathsService,
    private readonly jwtSecret: JwtSecretService,
    private readonly jwt: JwtService,
    private readonly installation: InstallationRepository,
    private readonly clinicSettings: ClinicSettingsRepository,
    private readonly license: LicenseService,
    private readonly config: ConfigService,
  ) {}

  startPairing(user: AuthenticatedUser): {
    code: string;
    expiresAt: string;
    clinicName: string;
    clinicId: string;
    onlineUrl: string;
    ttlMinutes: number;
    challenge: string;
    protocolVersion: number;
  } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing codes are created on the Online clinic.');
    }
    const clinicId = user.clinicId || getTenantClinicId();
    if (!clinicId) throw new ForbiddenException('Clinic context required');
    const clinic = this.platform.requireClinic(clinicId);
    const ttlMinutes = 10;
    const { code, expiresAt, challenge } = this.platform.createPairingCode(clinicId, user.id, ttlMinutes);
    this.platform.logEvent(clinicId, 'PAIRING_CODE', `user ${user.id}`);
    return {
      code,
      expiresAt,
      clinicName: clinic.name,
      clinicId,
      onlineUrl: this.publicOnlineUrl(),
      ttlMinutes,
      challenge,
      protocolVersion: SYNC_PROTOCOL_VERSION,
    };
  }

  previewFromOnline(code: string): {
    clinicId: string;
    clinicName: string;
    expiresAt: string;
    onlineUrl: string;
    challenge: string;
    protocolVersion: number;
  } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing must be previewed against the Online server.');
    }
    let peeked: { clinicId: string; expiresAt: string; challenge: string };
    try {
      peeked = this.platform.peekPairingCode(compactPairingCode(code));
    } catch {
      throw new UnauthorizedException('Invalid or expired pairing code.');
    }
    const clinic = this.platform.requireClinic(peeked.clinicId);
    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      expiresAt: peeked.expiresAt,
      onlineUrl: this.publicOnlineUrl(),
      challenge: peeked.challenge,
      protocolVersion: SYNC_PROTOCOL_VERSION,
    };
  }

  async previewOffline(input: { onlineUrl: string; pairingCode: string }): Promise<{
    clinicId: string;
    clinicName: string;
    expiresAt: string;
    onlineUrl: string;
    challenge: string;
    protocolVersion: number;
  }> {
    if (!this.deployment.isOffline()) {
      throw new BadRequestException('Connect to Online from the Offline Windows app.');
    }
    if (this.readPeerConfig()) {
      throw new BadRequestException('This Offline installation is already paired. Disconnect first before pairing again.');
    }
    this.assertEmptyOffline();
    const base = this.requireOnlineUrl(input.onlineUrl);
    const res = await this.fetchOnline(
      `${base}/api/sync/pairing/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...syncProtocolHeaders() },
        body: JSON.stringify({ code: compactPairingCode(input.pairingCode) }),
      },
      20_000,
    );
    const body = await this.readOnlineJson<{
      clinicId?: string;
      clinicName?: string;
      expiresAt?: string;
      challenge?: string;
      protocolVersion?: number;
      message?: string;
    }>(res);
    if (!res.ok || !body.clinicId || !body.clinicName || !body.challenge) {
      throw new BadRequestException(
        messageFromOnlineResponse(
          res.status,
          body,
          'Could not find that pairing code. Check the Online address and code.',
        ),
      );
    }
    if (!isCompatibleSyncProtocol(parseSyncProtocolVersion(body.protocolVersion))) {
      throw new BadRequestException(SYNC_PROTOCOL_MISMATCH);
    }
    return {
      clinicId: body.clinicId,
      clinicName: body.clinicName,
      expiresAt: body.expiresAt || '',
      onlineUrl: base,
      challenge: body.challenge,
      protocolVersion: parseSyncProtocolVersion(body.protocolVersion) || SYNC_PROTOCOL_VERSION,
    };
  }

  completeFromOnline(input: {
    code: string;
    deviceName: string;
    installationId?: string;
    emptyClinic: boolean;
    census?: {
      patients: number;
      payments: number;
      treatments: number;
      appointments: number;
      total: number;
      expenses?: number;
      labCases?: number;
      prescriptions?: number;
      notes?: number;
    };
    protocolVersion?: number;
    challenge?: string;
    censusProof?: string;
    devicePublicKey?: string;
    pairingSignature?: string;
    license?: string;
  }): {
    deviceId: string;
    deviceSecret: string;
    clinicId: string;
    clinicName: string;
    onlineBaseUrl: string;
    protocolVersion: number;
  } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing must be completed against the Online server.');
    }
    if (!isPairingSyncProtocol(parseSyncProtocolVersion(input.protocolVersion))) {
      throw new BadRequestException({ statusCode: 400, message: SYNC_PROTOCOL_MISMATCH, code: 'SYNC_PROTOCOL_MISMATCH' });
    }
    if (input.emptyClinic !== true || !isEmptyCensusAttestation(input.census)) {
      throw new BadRequestException(
        'Automatic pairing requires an empty Offline clinic (emptyClinic + zero census). Two populated databases cannot be merged. Online cannot inspect the Offline disk — the official Offline app attests this from SQLite.',
      );
    }
    let licensePayload;
    try {
      licensePayload = this.license.parseAndVerify(String(input.license || ''));
    } catch {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    if (isLicenseExpiryDue(licensePayload.expiresAt)) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    const installationId = String(input.installationId || '').trim();
    if (!installationId || licensePayload.installationId !== installationId) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    if (!isDevicePublicKeyFormat(input.devicePublicKey)) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    const compact = compactPairingCode(input.code);
    let peeked: { clinicId: string; expiresAt: string; challenge: string };
    try {
      peeked = this.platform.peekPairingCode(compact);
    } catch {
      throw new UnauthorizedException('Invalid or expired pairing code.');
    }
    if (!peeked.challenge || !challengesMatch(peeked.challenge, input.challenge)) {
      throw new BadRequestException({ statusCode: 400, message: CENSUS_PROOF_INVALID, code: 'CENSUS_PROOF_INVALID' });
    }
    const proofInput: CensusProofInput = {
      protocolVersion: parseSyncProtocolVersion(input.protocolVersion),
      challenge: peeked.challenge,
      installationId,
      emptyClinic: true,
      census: input.census!,
      devicePublicKey: input.devicePublicKey!,
      licenseId: licensePayload.licenseId,
    };
    if (!verifyCensusProof(peeked.challenge, proofInput, input.censusProof || '')) {
      throw new BadRequestException({ statusCode: 400, message: CENSUS_PROOF_INVALID, code: 'CENSUS_PROOF_INVALID' });
    }
    const transcript = canonicalPairingTranscript({
      protocolVersion: proofInput.protocolVersion,
      challenge: peeked.challenge,
      installationId,
      licenseId: licensePayload.licenseId,
      devicePublicKey: input.devicePublicKey!,
      emptyClinic: true,
      census: input.census!,
    });
    if (!verifyDeviceSignature(input.devicePublicKey!, transcript, input.pairingSignature || '')) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    if (this.platform.findActiveSyncDeviceByInstallation(installationId)) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_INSTALL_ALREADY_PAIRED,
        code: DEVICE_INSTALL_ALREADY_PAIRED_CODE,
      });
    }
    if (this.platform.findActiveSyncDeviceByLicense(licensePayload.licenseId)) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_INSTALL_ALREADY_PAIRED,
        code: DEVICE_INSTALL_ALREADY_PAIRED_CODE,
      });
    }
    let clinicId: string;
    try {
      clinicId = this.platform.consumePairingCode(compact);
    } catch {
      throw new UnauthorizedException('Invalid or expired pairing code.');
    }
    const clinic = this.platform.requireClinic(clinicId);
    const deviceSecret = crypto.randomBytes(32).toString('base64url');
    const secretHash = bcrypt.hashSync(deviceSecret, 10);
    const deviceId = this.platform.registerSyncDevice({
      clinicId,
      name: input.deviceName?.trim() || 'Offline computer',
      secretHash,
      installationId,
      publicKey: input.devicePublicKey,
      licenseId: licensePayload.licenseId,
    });
    this.platform.logEvent(clinicId, 'PAIRING_COMPLETE', deviceId);
    return {
      deviceId,
      deviceSecret,
      clinicId,
      clinicName: clinic.name,
      onlineBaseUrl: this.publicOnlineUrl(),
      protocolVersion: SYNC_PROTOCOL_VERSION,
    };
  }

  async connectOffline(input: { onlineUrl: string; pairingCode: string; deviceName?: string }): Promise<PublicPeerInfo> {
    if (!this.deployment.isOffline()) {
      throw new BadRequestException('Connect to Online from the Offline Windows app.');
    }
    if (this.readPeerConfig()) {
      throw new BadRequestException('This Offline installation is already paired. Disconnect first before pairing again.');
    }
    this.assertEmptyOffline();
    const preview = await this.previewOffline(input);
    const base = preview.onlineUrl;
    const installation = this.installation.get();
    const installationId = installation.installationId;
    const { license, licenseId } = this.requireOfflineLicense(installationId);
    const keys = generateDeviceKeypair();
    const census = censusAttestationFromClinic(clinicOperationalCensus(this.db.connection));
    const compact = compactPairingCode(input.pairingCode);
    const proofInput: CensusProofInput = {
      protocolVersion: SYNC_PROTOCOL_VERSION,
      challenge: preview.challenge,
      installationId,
      emptyClinic: true,
      census,
      devicePublicKey: keys.publicKey,
      licenseId,
    };
    const censusProof = signCensusProof(preview.challenge, proofInput);
    const pairingSignature = signWithDeviceKey(
      keys.privateKey,
      canonicalPairingTranscript({
        protocolVersion: SYNC_PROTOCOL_VERSION,
        challenge: preview.challenge,
        installationId,
        licenseId,
        devicePublicKey: keys.publicKey,
        emptyClinic: true,
        census,
      }),
    );
    const res = await this.fetchOnline(
      `${base}/api/sync/pairing/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...syncProtocolHeaders() },
        body: JSON.stringify({
          code: compact,
          deviceName: input.deviceName?.trim() || this.clinicSettings.get()?.clinicName || 'Offline clinic',
          installationId,
          emptyClinic: true,
          census,
          protocolVersion: SYNC_PROTOCOL_VERSION,
          challenge: preview.challenge,
          censusProof,
          devicePublicKey: keys.publicKey,
          pairingSignature,
          license,
        }),
      },
      20_000,
    );
    const body = await this.readOnlineJson<{
      deviceId?: string;
      deviceSecret?: string;
      clinicId?: string;
      clinicName?: string;
      message?: string;
    }>(res);
    if (!res.ok || !body.deviceId || !body.deviceSecret || !body.clinicId) {
      throw new BadRequestException(
        messageFromOnlineResponse(res.status, body, 'Pairing failed. Check the code and Online URL.'),
      );
    }
    const stored: StoredPeerConfig = {
      deviceId: body.deviceId,
      deviceSecret: body.deviceSecret,
      onlineBaseUrl: base,
      onlineClinicId: body.clinicId,
      clinicName: body.clinicName || 'Online clinic',
      pairedAt: new Date().toISOString(),
      devicePrivateKey: keys.privateKey,
      devicePublicKey: keys.publicKey,
    };
    this.writePeerConfig(stored);
    return toPublicPeerInfo(stored);
  }

  localClinicName(): string | null {
    try {
      return this.clinicSettings.get()?.clinicName ?? null;
    } catch {
      return null;
    }
  }

  issueDeviceToken(
    deviceId: string,
    deviceSecret: string,
    req?: Request,
  ): { accessToken: string; expiresIn: string; clinicId: string } {
    if (!this.platform.isEnabled()) {
      throw new BadRequestException('Device tokens are issued by the Online server.');
    }
    const device = this.platform.findSyncDevice(deviceId);
    if (!device || device.revokedAt) throw new UnauthorizedException('Device is not registered.');
    if (!bcrypt.compareSync(deviceSecret, device.secretHash)) {
      throw new UnauthorizedException('Invalid device credentials.');
    }
    if (device.publicKey) {
      this.assertDeviceRequestSignature(req, device.publicKey);
    }
    this.platform.touchSyncDevice(deviceId);
    const accessToken = this.jwt.sign(
      { sub: 0, username: `device:${deviceId}`, roleName: 'sync_device', clinicId: device.clinicId, typ: 'sync-device', deviceId },
      { secret: this.jwtSecret.getDeviceSecret(), expiresIn: '2h', issuer: SYNC_DEVICE_JWT_ISSUER },
    );
    return { accessToken, expiresIn: '2h', clinicId: device.clinicId };
  }

  registerDevicePublicKey(deviceId: string, devicePublicKey: string, req: Request): { registered: true } {
    const device = this.platform.findSyncDevice(deviceId);
    if (!device || device.revokedAt) throw new UnauthorizedException('Device is not registered.');
    if (device.publicKey) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_KEY_ALREADY_REGISTERED,
        code: DEVICE_KEY_ALREADY_REGISTERED_CODE,
      });
    }
    if (!isDevicePublicKeyFormat(devicePublicKey)) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    this.assertDeviceRequestSignature(req, devicePublicKey);
    if (!this.platform.setDevicePublicKey(deviceId, devicePublicKey)) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_KEY_ALREADY_REGISTERED,
        code: DEVICE_KEY_ALREADY_REGISTERED_CODE,
      });
    }
    return { registered: true };
  }

  persistDeviceKeys(publicKey: string, privateKey: string): StoredPeerConfig {
    const current = this.readPeerConfig();
    if (!current) {
      throw new BadRequestException('This Offline installation is not paired.');
    }
    const stored: StoredPeerConfig = {
      ...current,
      devicePublicKey: publicKey,
      devicePrivateKey: privateKey,
    };
    this.writePeerConfig(stored);
    return stored;
  }

  assertDeviceRequestSignature(req: Request | undefined, publicKey: string): void {
    if (!verifyExpressDeviceRequest(req, publicKey)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: DEVICE_SIGNATURE_INVALID,
        code: DEVICE_SIGNATURE_INVALID_CODE,
      });
    }
  }

  readPeerConfig(): StoredPeerConfig | null {
    const file = this.peerFile();
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as StoredPeerConfig;
    } catch {
      return null;
    }
  }

  async disconnectOffline(): Promise<void> {
    const peer = this.readPeerConfig();
    if (peer) {
      try {
        const tokenBody = JSON.stringify({ deviceId: peer.deviceId, deviceSecret: peer.deviceSecret });
        const tokenRes = await fetch(`${peer.onlineBaseUrl}/api/sync/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...syncProtocolHeaders(),
            ...this.peerTrustHeaders(peer, 'POST', '/api/sync/token', tokenBody),
          },
          body: tokenBody,
          signal: AbortSignal.timeout(10_000),
        });
        const data = (await tokenRes.json().catch(() => ({}))) as { accessToken?: string };
        if (tokenRes.ok && data.accessToken) {
          await fetch(`${peer.onlineBaseUrl}/api/sync/device/revoke-self`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${data.accessToken}`,
              'Content-Type': 'application/json',
              ...syncProtocolHeaders(),
              ...this.peerTrustHeaders(peer, 'POST', '/api/sync/device/revoke-self', ''),
            },
            signal: AbortSignal.timeout(10_000),
          });
        }
      } catch {
        /* local disconnect still proceeds; Online can revoke leftover devices */
      }
    }
    const file = this.peerFile();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  private writePeerConfig(config: StoredPeerConfig): void {
    this.paths.ensureDataDirs();
    fs.writeFileSync(this.peerFile(), JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
  }

  private peerFile(): string {
    return path.join(this.paths.configDir(), 'sync-device.json');
  }

  private peerTrustHeaders(
    peer: StoredPeerConfig,
    method: string,
    path: string,
    body: string,
  ): Record<string, string> {
    if (!peer.devicePrivateKey) return {};
    return deviceTrustHeaders(peer.devicePrivateKey, method, path, body);
  }

  private requireOfflineLicense(installationId: string): { license: string; licenseId: string } {
    const row = this.installation.get();
    if (!row.licensePayload || !row.licenseSignature) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    const license = reconstructLicenseText(row.licensePayload, row.licenseSignature);
    let payload;
    try {
      payload = this.license.parseAndVerify(license);
    } catch {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    if (payload.installationId !== installationId || payload.installationId !== row.installationId) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    if (isLicenseExpiryDue(payload.expiresAt)) {
      throw new BadRequestException({
        statusCode: 400,
        message: DEVICE_TRUST_REQUIRED,
        code: DEVICE_TRUST_REQUIRED_CODE,
      });
    }
    return { license, licenseId: payload.licenseId };
  }

  private assertEmptyOffline(): void {
    const census = clinicOperationalCensus(this.db.connection);
    if (census.populated) {
      throw new BadRequestException({
        statusCode: 400,
        message: populatedOfflineMessage(census),
        code: POPULATED_OFFLINE_CODE,
      });
    }
  }

  private requireOnlineUrl(raw: string): string {
    try {
      return normalizeOnlineBaseUrl(raw);
    } catch (err) {
      if ((err as Error).message === INVALID_ONLINE_URL) {
        throw new BadRequestException('Enter a valid Online clinic address, like https://dentalnova.dibnova.com');
      }
      throw err;
    }
  }

  private async fetchOnline(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        headers: {
          ...syncProtocolHeaders(),
          ...(init.headers || {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new BadRequestException(describeOnlineReachabilityError(err));
    }
  }

  private async readOnlineJson<T>(res: Response): Promise<T & { message?: string }> {
    return ((await res.json().catch(() => ({}))) as T & { message?: string }) ?? ({} as T & { message?: string });
  }

  private publicOnlineUrl(): string {
    const fromEnv = this.config.get<string>('PUBLIC_ONLINE_URL')?.trim();
    if (fromEnv) {
      try {
        return normalizeOnlineBaseUrl(fromEnv);
      } catch {
        /* fall through */
      }
    }
    const domain = this.config.get<string>('DOMAIN')?.trim();
    if (domain) return `https://${domain.replace(/\/$/, '')}`;
    return 'https://dentalnova.dibnova.com';
  }
}
