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
import { clinicOperationalCensus, POPULATED_OFFLINE_CODE, populatedOfflineMessage } from './clinic-census.util';
import { normalizeOnlineBaseUrl } from './pairing-public.util';

export interface StoredPeerConfig {
  deviceId: string;
  deviceSecret: string;
  onlineBaseUrl: string;
  onlineClinicId: string;
  clinicName: string;
  pairedAt: string;
}

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

  startPairing(user: AuthenticatedUser): { code: string; expiresAt: string; clinicName: string; clinicId: string } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing codes are created on the Online clinic.');
    }
    const clinicId = user.clinicId || getTenantClinicId();
    if (!clinicId) throw new ForbiddenException('Clinic context required');
    const clinic = this.platform.requireClinic(clinicId);
    const { code, expiresAt } = this.platform.createPairingCode(clinicId, user.id);
    this.platform.logEvent(clinicId, 'PAIRING_CODE', `user ${user.id}`);
    return { code, expiresAt, clinicName: clinic.name, clinicId };
  }

  completeFromOnline(input: { code: string; deviceName: string; installationId?: string; emptyClinic: boolean }): {
    deviceId: string;
    deviceSecret: string;
    clinicId: string;
    clinicName: string;
    onlineBaseUrl: string;
  } {
    if (!this.deployment.isOnline() || !this.platform.isEnabled()) {
      throw new BadRequestException('Pairing must be completed against the Online server.');
    }
    if (input.emptyClinic !== true) {
      throw new BadRequestException(
        'Automatic pairing requires an empty Offline clinic. Two populated databases cannot be merged.',
      );
    }
    let clinicId: string;
    try {
      clinicId = this.platform.consumePairingCode(input.code);
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

  async connectOffline(input: { onlineUrl: string; pairingCode: string; deviceName?: string }): Promise<StoredPeerConfig> {
    if (!this.deployment.isOffline()) {
      throw new BadRequestException('Connect to Online from the Offline Windows app.');
    }
    if (this.readPeerConfig()) {
      throw new BadRequestException('This Offline installation is already paired. Disconnect first before pairing again.');
    }
    const census = clinicOperationalCensus(this.db.connection);
    if (census.populated) {
      throw new BadRequestException({
        statusCode: 400,
        message: populatedOfflineMessage(census),
        code: POPULATED_OFFLINE_CODE,
      });
    }
    const base = normalizeOnlineBaseUrl(input.onlineUrl);
    const installationId = this.installation.get().installationId;
    const res = await fetch(`${base}/api/sync/pairing/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: input.pairingCode.trim().toUpperCase(),
        deviceName: input.deviceName?.trim() || this.clinicSettings.get()?.clinicName || 'Offline clinic',
        installationId,
        emptyClinic: true,
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
    return stored;
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

  private publicOnlineUrl(): string {
    const fromEnv = this.config.get<string>('PUBLIC_ONLINE_URL')?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    const domain = this.config.get<string>('DOMAIN')?.trim();
    if (domain) return `https://${domain.replace(/\/$/, '')}`;
    return 'https://dentalnova.dibnova.com';
  }
}
