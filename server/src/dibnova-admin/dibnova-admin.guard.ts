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
import { PERMISSIONS } from '../common/rbac.constants';

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
        });
        if (payload.dibnovaAdmin) {
          req.user = this.authService.toDibNovaAdminUser(payload.username);
          return true;
        }
        const user = this.authService.toAuthenticatedUser(payload.sub);
        if (user.permissions.includes(PERMISSIONS.DIBNOVA_ADMIN)) {
          req.user = user;
          return true;
        }
      } catch {
        // fall through to unauthorized
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
