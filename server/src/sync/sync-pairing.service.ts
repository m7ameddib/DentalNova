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
import { SYNC_DEVICE_JWT_ISSUER } from '../auth/jwt-payload.util';
import { AuthenticatedUser } from '../auth/auth.types';
import { getTenantClinicId } from '../platform/tenant-context';
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
    private readonly config: ConfigService,
  ) {}

  startPairing(user: AuthenticatedUser): {
    code: string;
    expiresAt: string;
    clinicName: string;
    clinicId: string;
    onlineUrl: string;
    ttlMinutes: number;
  } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing codes are created on the Online clinic.');
    }
    const clinicId = user.clinicId || getTenantClinicId();
    if (!clinicId) throw new ForbiddenException('Clinic context required');
    const clinic = this.platform.requireClinic(clinicId);
    const ttlMinutes = 10;
    const { code, expiresAt } = this.platform.createPairingCode(clinicId, user.id, ttlMinutes);
    this.platform.logEvent(clinicId, 'PAIRING_CODE', `user ${user.id}`);
    return {
      code,
      expiresAt,
      clinicName: clinic.name,
      clinicId,
      onlineUrl: this.publicOnlineUrl(),
      ttlMinutes,
    };
  }

  previewFromOnline(code: string): { clinicId: string; clinicName: string; expiresAt: string; onlineUrl: string } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing must be previewed against the Online server.');
    }
    let peeked: { clinicId: string; expiresAt: string };
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
    };
  }

  async previewOffline(input: { onlineUrl: string; pairingCode: string }): Promise<{
    clinicId: string;
    clinicName: string;
    expiresAt: string;
    onlineUrl: string;
  }> {
    if (!this.deployment.isOffline()) {
      throw new BadRequestException('Connect to Online from the Offline Windows app.');
    }
    if (this.readPeerConfig()) {
      throw new BadRequestException('This Offline installation is already paired. Disconnect first before pairing again.');
    }
    this.assertEmptyOffline();
    const base = this.requireOnlineUrl(input.onlineUrl);
    const res = await fetch(`${base}/api/sync/pairing/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code: compactPairingCode(input.pairingCode) }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      clinicId?: string;
      clinicName?: string;
      expiresAt?: string;
      message?: string;
    };
    if (!res.ok || !body.clinicId || !body.clinicName) {
      throw new BadRequestException(body.message || 'Could not find that pairing code. Check the Online address and code.');
    }
    return {
      clinicId: body.clinicId,
      clinicName: body.clinicName,
      expiresAt: body.expiresAt || '',
      onlineUrl: base,
    };
  }

  completeFromOnline(input: {
    code: string;
    deviceName: string;
    installationId?: string;
    emptyClinic: boolean;
    census?: { patients: number; payments: number; treatments: number; appointments: number; total: number };
  }): {
    deviceId: string;
    deviceSecret: string;
    clinicId: string;
    clinicName: string;
    onlineBaseUrl: string;
  } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing must be completed against the Online server.');
    }
    if (input.emptyClinic !== true || !isEmptyCensusAttestation(input.census)) {
      throw new BadRequestException(
        'Automatic pairing requires an empty Offline clinic (emptyClinic + zero census). Two populated databases cannot be merged. Online cannot inspect the Offline disk — the official Offline app attests this from SQLite.',
      );
    }
    let clinicId: string;
    try {
      clinicId = this.platform.consumePairingCode(compactPairingCode(input.code));
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
      installationId: input.installationId ?? null,
    });
    this.platform.logEvent(clinicId, 'PAIRING_COMPLETE', deviceId);
    return {
      deviceId,
      deviceSecret,
      clinicId,
      clinicName: clinic.name,
      onlineBaseUrl: this.publicOnlineUrl(),
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
    const base = this.requireOnlineUrl(input.onlineUrl);
    const installationId = this.installation.get().installationId;
    const census = censusAttestationFromClinic(clinicOperationalCensus(this.db.connection));
    const res = await fetch(`${base}/api/sync/pairing/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: compactPairingCode(input.pairingCode),
        deviceName: input.deviceName?.trim() || this.clinicSettings.get()?.clinicName || 'Offline clinic',
        installationId,
        emptyClinic: true,
        census,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      deviceId?: string;
      deviceSecret?: string;
      clinicId?: string;
      clinicName?: string;
      message?: string;
    };
    if (!res.ok || !body.deviceId || !body.deviceSecret || !body.clinicId) {
      throw new BadRequestException(body.message || 'Pairing failed. Check the code and Online URL.');
    }
    const stored: StoredPeerConfig = {
      deviceId: body.deviceId,
      deviceSecret: body.deviceSecret,
      onlineBaseUrl: base,
      onlineClinicId: body.clinicId,
      clinicName: body.clinicName || 'Online clinic',
      pairedAt: new Date().toISOString(),
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

  issueDeviceToken(deviceId: string, deviceSecret: string): { accessToken: string; expiresIn: string; clinicId: string } {
    if (!this.platform.isEnabled()) {
      throw new BadRequestException('Device tokens are issued by the Online server.');
    }
    const device = this.platform.findSyncDevice(deviceId);
    if (!device || device.revokedAt) throw new UnauthorizedException('Device is not registered.');
    if (!bcrypt.compareSync(deviceSecret, device.secretHash)) {
      throw new UnauthorizedException('Invalid device credentials.');
    }
    this.platform.touchSyncDevice(deviceId);
    const accessToken = this.jwt.sign(
      { sub: 0, username: `device:${deviceId}`, roleName: 'sync_device', clinicId: device.clinicId, typ: 'sync-device', deviceId },
      { secret: this.jwtSecret.getDeviceSecret(), expiresIn: '2h', issuer: SYNC_DEVICE_JWT_ISSUER },
    );
    return { accessToken, expiresIn: '2h', clinicId: device.clinicId };
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
        const tokenRes = await fetch(`${peer.onlineBaseUrl}/api/sync/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: peer.deviceId, deviceSecret: peer.deviceSecret }),
          signal: AbortSignal.timeout(10_000),
        });
        const data = (await tokenRes.json().catch(() => ({}))) as { accessToken?: string };
        if (tokenRes.ok && data.accessToken) {
          await fetch(`${peer.onlineBaseUrl}/api/sync/device/revoke-self`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${data.accessToken}`, 'Content-Type': 'application/json' },
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
