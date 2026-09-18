import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { PasswordResetService, RECOVERY_CODE_ONLY } from './password-reset.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  RecoverUsernameDto,
  ResetPasswordDto,
  VerifyResetOtpDto,
} from './dto/password-reset.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './auth.types';
import { SkipSubscriptionGuard } from '../subscription/decorators/skip-subscription-guard.decorator';
import { requestClientIp } from '../common/loopback.util';

const LOGIN_LIMIT = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const RESET_LIMIT = 8;
const RESET_WINDOW_MS = 15 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const key = `login:${requestClientIp(req)}:${dto.username.trim().toLowerCase()}`;
    this.rateLimit.assertAllowed(key, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    try {
      const user = await this.authService.validateCredentials(dto.username, dto.password);
      this.rateLimit.recordSuccess(key);
      return this.authService.login(user);
    } catch (err) {
      this.rateLimit.recordFailure(key, LOGIN_WINDOW_MS);
      throw err;
    }
  }

  @SkipSubscriptionGuard()
  @Post('forgot-password')
  async requestPasswordReset(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const key = `reset:${requestClientIp(req)}:${dto.username.trim().toLowerCase()}`;
    this.rateLimit.assertAllowed(key, RESET_LIMIT, RESET_WINDOW_MS);
    try {
      if (!dto.recoveryCode?.trim()) {
        throw new BadRequestException(RECOVERY_CODE_ONLY);
      }
      const result = await this.passwordResetService.recoverWithCode(dto.username, dto.recoveryCode);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, RESET_WINDOW_MS);
      throw err;
    }
  }

  @SkipSubscriptionGuard()
  @Post('recover-username')
  async recoverUsername(@Body() dto: RecoverUsernameDto, @Req() req: Request) {
    const key = `recover-username:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, RESET_LIMIT, RESET_WINDOW_MS);
    // This endpoint returns 200 with an empty list for unknown details, so every
    // probe must count against the limit (unlike login / forgot-password).
    this.rateLimit.recordFailure(key, RESET_WINDOW_MS);
    return this.passwordResetService.recoverUsername(dto.phone, dto.recoveryCode);
  }

  @SkipSubscriptionGuard()
  @Post('verify-reset-otp')
  async verifyResetOtp(@Body() dto: VerifyResetOtpDto, @Req() req: Request) {
    const key = `verify-otp:${requestClientIp(req)}:${dto.username.trim().toLowerCase()}`;
    this.rateLimit.assertAllowed(key, RESET_LIMIT, RESET_WINDOW_MS);
    try {
      const result = await this.passwordResetService.verifyOtp(dto.username, dto.phone, dto.code);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, RESET_WINDOW_MS);
      throw err;
    }
  }

  @SkipSubscriptionGuard()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const key = `reset-password:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, RESET_LIMIT, RESET_WINDOW_MS);
    try {
      const result = await this.passwordResetService.resetPassword(dto.resetToken, dto.newPassword);
      this.rateLimit.recordSuccess(key);
      return result;
    } catch (err) {
      this.rateLimit.recordFailure(key, RESET_WINDOW_MS);
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
