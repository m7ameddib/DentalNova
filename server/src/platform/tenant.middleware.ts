import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { JwtSecretService } from '../auth/jwt-secret.service';
import { bindTenant, clearTenant, getTenantClinicId } from './tenant-context';
import { clinicIdFromVerifiedBearer } from './verified-tenant.util';

/**
 * Seeds tenant context early so subscription/auth guards can resolve the clinic.
 * Uses enterWith (not als.run(next)) so the store survives Nest's async
 * guard/interceptor/controller hop. JwtStrategy / DeviceAuthGuard overwrite
 * this with the verified clinicId after the token is authenticated.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly jwtSecret: JwtSecretService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const clinicId = this.readClinicId(req);
    if (!clinicId) {
      next();
      return;
    }

    bindTenant(clinicId);
    const restore = () => {
      if (getTenantClinicId() === clinicId) {
        clearTenant();
      }
    };
    res.once('finish', restore);
    res.once('close', restore);
    next();
  }

  private readClinicId(req: Request): string | undefined {
    return clinicIdFromVerifiedBearer(
      req.headers.authorization,
      {
        sessionSecret: this.jwtSecret.getSecret(),
        deviceSecret: this.jwtSecret.getDeviceSecret(),
      },
      (token, secret, issuer) => {
        try {
          const payload = this.jwt.verify(token, { secret, issuer });
          if (!payload || typeof payload !== 'object') return null;
          return payload as Record<string, unknown>;
        } catch {
          return null;
        }
      },
    );
  }
}
