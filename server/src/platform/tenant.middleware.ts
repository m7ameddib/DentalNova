import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { tenantAls } from './tenant-context';
import { JwtPayload } from '../auth/auth.types';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const clinicId = this.readClinicId(req);
    if (!clinicId) {
      next();
      return;
    }
    tenantAls.run({ clinicId }, () => next());
  }

  private readClinicId(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    const token = header.slice(7).trim();
    if (!token) return undefined;
    const payload = decodeJwtPayload(token);
    if (!payload || payload.dibnovaAdmin) return undefined;
    const clinicId = payload.clinicId?.trim();
    return clinicId || undefined;
  }
}

function decodeJwtPayload(token: string): JwtPayload | undefined {
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json) as JwtPayload;
  } catch {
    return undefined;
  }
}
