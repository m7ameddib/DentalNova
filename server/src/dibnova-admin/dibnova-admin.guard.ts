import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import * as crypto from 'crypto';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/auth.types';
import { JwtSecretService } from '../auth/jwt-secret.service';
import { isSessionJwtPayload, SESSION_JWT_ISSUER } from '../auth/jwt-payload.util';

@Injectable()
export class DibNovaAdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly jwtSecret: JwtSecretService,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();

    const expectedKey = this.config.get<string>('DIBNOVA_ADMIN_API_KEY');
    if (expectedKey?.trim()) {
      const providedKey = req.headers['x-dibnova-admin-key'] as string | undefined;
      if (providedKey && this.timingSafeEqual(providedKey, expectedKey)) {
        return true;
      }
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = this.jwtService.verify<JwtPayload>(token, {
          secret: this.jwtSecret.getSecret(),
          issuer: SESSION_JWT_ISSUER,
        });
        if (!isSessionJwtPayload(payload) || !payload.dibnovaAdmin) {
          throw new UnauthorizedException('DibNova admin authentication required.');
        }
        req.user = this.authService.toDibNovaAdminUser(payload.username);
        return true;
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
      }
    }

    throw new UnauthorizedException('DibNova admin authentication required.');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
