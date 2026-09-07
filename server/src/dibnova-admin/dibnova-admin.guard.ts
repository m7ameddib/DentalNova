import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class DibNovaAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('DIBNOVA_ADMIN_API_KEY');
    if (!expected?.trim()) {
      throw new UnauthorizedException('DibNova admin API is not configured on this server.');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided =
      (req.headers['x-dibnova-admin-key'] as string | undefined) ??
      (req.headers['authorization']?.startsWith('Bearer ')
        ? req.headers['authorization'].slice(7)
        : undefined);

    if (!provided || !this.timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid DibNova admin credentials.');
    }

    return true;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
