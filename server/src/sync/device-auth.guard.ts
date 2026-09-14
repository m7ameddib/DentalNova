import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtSecretService } from '../auth/jwt-secret.service';
import { PlatformService } from '../platform/platform.service';
import { bindTenant } from '../platform/tenant-context';
import { SYNC_DEVICE_JWT_ISSUER } from '../auth/jwt-payload.util';

export interface SyncDevicePrincipal {
  deviceId: string;
  clinicId: string;
}

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly jwtSecret: JwtSecretService,
    private readonly platform: PlatformService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { syncDevice?: SyncDevicePrincipal }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException();
    let payload: { typ?: string; deviceId?: string; clinicId?: string; iss?: string };
    try {
      payload = this.jwt.verify(header.slice(7).trim(), {
        secret: this.jwtSecret.getDeviceSecret(),
        issuer: SYNC_DEVICE_JWT_ISSUER,
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== 'sync-device' || !payload.deviceId || !payload.clinicId) {
      throw new UnauthorizedException();
    }
    if (!this.platform.isEnabled()) throw new UnauthorizedException();
    const device = this.platform.findSyncDevice(payload.deviceId);
    if (!device || device.revokedAt || device.clinicId !== payload.clinicId) {
      throw new UnauthorizedException();
    }
    if (!this.platform.canUseSystem(device.clinicId)) {
      throw new UnauthorizedException('Clinic subscription is not active');
    }
    bindTenant(device.clinicId);
    req.syncDevice = { deviceId: device.id, clinicId: device.clinicId };
    this.platform.touchSyncDevice(device.id);
    return true;
  }
}
