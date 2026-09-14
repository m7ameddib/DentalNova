import { Body, Controller, Get, Post, Req, SetMetadata, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { LoginDto } from '../auth/dto/login.dto';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { SKIP_SUBSCRIPTION_GUARD } from '../subscription/guards/subscription-active.guard';
import { requestClientIp } from '../common/loopback.util';
import { PlatformService } from '../platform/platform.service';
import { DibNovaAdminGuard } from './dibnova-admin.guard';
import { AdminSessionService } from './admin-session.service';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

@Controller('dibnova-admin/auth')
@SetMetadata(SKIP_INSTALLATION_GUARD, true)
@SetMetadata(SKIP_SUBSCRIPTION_GUARD, true)
export class DibNovaAdminAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimit: AuthRateLimitService,
    private readonly platform: PlatformService,
    private readonly sessions: AdminSessionService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = requestClientIp(req);
    const key = `admin-login:${ip}:${dto.username.trim().toLowerCase()}`;
    this.rateLimit.assertAllowed(key, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    try {
      const result = this.auth.loginDibNovaAdmin(dto.username, dto.password);
      this.rateLimit.recordSuccess(key);
      this.platform.recordAdminAudit({
        actor: dto.username.trim(),
        action: 'LOGIN',
        details: 'Admin sign-in succeeded',
        ip,
      });
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, LOGIN_WINDOW_MS);
      this.platform.recordAdminAudit({
        actor: dto.username.trim(),
        action: 'LOGIN_FAILURE',
        details: 'Admin sign-in rejected',
        ip,
      });
      throw err;
    }
  }

  @UseGuards(DibNovaAdminGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @UseGuards(DibNovaAdminGuard)
  @Post('logout')
  logout(@Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const decoded = this.jwtService.decode(header.slice(7).trim()) as { jti?: string; exp?: number } | null;
        if (decoded?.jti) this.sessions.revoke(decoded.jti, decoded.exp);
      } catch {
        /* already unauthenticated after this response */
      }
    }
    this.platform.recordAdminAudit({
      actor: user?.username || 'unknown',
      action: 'LOGOUT',
      ip: requestClientIp(req),
    });
    return { loggedOut: true };
  }
}
