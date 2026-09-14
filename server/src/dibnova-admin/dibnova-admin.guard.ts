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
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { JwtSecretService } from '../auth/jwt-secret.service';
import { requestClientIp } from '../common/loopback.util';
import {
  ADMIN_JWT_AUDIENCE,
  ADMIN_JWT_ISSUER,
  isValidAdminJwtPayload,
} from '../auth/jwt-payload.util';
import { AdminSessionService } from './admin-session.service';

const API_KEY_LIMIT = 8;
const API_KEY_WINDOW_MS = 15 * 60 * 1000;

export type AdminAuthMethod = 'jwt' | 'api-key';

export type AdminRequest = Request & {
  user?: unknown;
  adminAuthMethod?: AdminAuthMethod;
};

@Injectable()
export class DibNovaAdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly jwtSecret: JwtSecretService,
    private readonly authService: AuthService,
    private readonly sessions: AdminSessionService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AdminRequest>();

    const expectedKey = this.configuredApiKey();
    if (expectedKey) {
      const providedKey = req.headers['x-dibnova-admin-key'];
      const provided = Array.isArray(providedKey) ? providedKey[0] : providedKey;
      if (provided) {
        const limitKey = `admin-api-key:${requestClientIp(req)}`;
        this.rateLimit.assertAllowed(limitKey, API_KEY_LIMIT, API_KEY_WINDOW_MS);
        if (this.timingSafeEqual(provided, expectedKey)) {
          this.rateLimit.recordSuccess(limitKey);
          req.user = this.authService.toDibNovaAdminUser('api-key');
          req.adminAuthMethod = 'api-key';
          return true;
        }
        this.rateLimit.recordFailure(limitKey, API_KEY_WINDOW_MS);
      }
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.jwtSecret.getAdminSecret(),
          issuer: ADMIN_JWT_ISSUER,
          audience: ADMIN_JWT_AUDIENCE,
        });
        if (!isValidAdminJwtPayload(payload)) {
          throw new UnauthorizedException('DibNova admin authentication required.');
        }
        if (this.sessions.isRevoked(payload.jti)) {
          throw new UnauthorizedException('DibNova admin session has ended.');
        }
        req.user = this.authService.toDibNovaAdminUser(String(payload.username));
        req.adminAuthMethod = 'jwt';
        return true;
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
      }
    }

    throw new UnauthorizedException('DibNova admin authentication required.');
  }

  private configuredApiKey(): string | null {
    const key = this.config.get<string>('DIBNOVA_ADMIN_API_KEY')?.trim() || '';
    if (key.length < 16) return null;
    return key;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
