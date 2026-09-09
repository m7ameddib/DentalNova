import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersRepository } from '../database/repositories/users.repository';
import { PasswordResetRepository } from '../database/repositories/password-reset.repository';
import { DeploymentService } from '../common/deployment.service';
import { isValidPhone, maskPhone, normalizePhone } from '../common/phone.util';
import { JwtSecretService } from './jwt-secret.service';
import { SmsService } from './sms.service';
import { PasswordResetJwtPayload } from './auth.types';
import { PlatformService } from '../platform/platform.service';
import { runInTenant } from '../platform/tenant-context';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT = 3;
const OTP_RATE_WINDOW_HOURS = 1;
const RESET_TOKEN_TTL = '15m';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly resetRepo: PasswordResetRepository,
    private readonly smsService: SmsService,
    private readonly jwtService: JwtService,
    private readonly jwtSecret: JwtSecretService,
    private readonly deployment: DeploymentService,
    private readonly platform: PlatformService,
  ) {}

  private inUserClinic<T>(username: string, fn: () => T): T {
    if (!this.platform.isEnabled()) return fn();
    const directory = this.platform.findUserByUsername(username);
    if (!directory) return fn();
    return runInTenant(directory.clinicId, fn);
  }

  private ensureOnlineRecoveryEnabled(): void {
    if (!this.deployment.isOnline()) {
      throw new BadRequestException('Self-service password reset is available for online clinics only.');
    }
  }

  async requestOtp(username: string, phone: string): Promise<{ message: string }> {
    this.ensureOnlineRecoveryEnabled();

    if (!isValidPhone(phone)) {
      throw new BadRequestException('Enter a valid phone number.');
    }

    const phoneNormalized = normalizePhone(phone);
    const genericMessage =
      'If the account details are correct, a verification code will be sent to the registered phone number.';

    const prepared = this.inUserClinic(username.trim(), () => {
      const user = this.usersRepo.findByUsername(username.trim());
      if (!user || !user.isActive || !user.phoneNormalized) return null;
      if (user.phoneNormalized !== phoneNormalized) return null;
      const since = new Date(Date.now() - OTP_RATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
      if (this.resetRepo.countRecentRequestsForPhone(phoneNormalized, since) >= OTP_RATE_LIMIT) {
        return null;
      }
      return user;
    });
    if (!prepared) {
      return { message: genericMessage };
    }

    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    this.inUserClinic(username.trim(), () => {
      this.resetRepo.create({
        userId: prepared.id,
        phoneNormalized,
        codeHash,
        expiresAt,
      });
    });

    await this.smsService.sendPasswordResetOtp(prepared.phone ?? phone, code);

    return { message: genericMessage };
  }

  async verifyOtp(username: string, phone: string, code: string): Promise<{ resetToken: string }> {
    this.ensureOnlineRecoveryEnabled();

    if (!/^\d{6}$/.test(code.trim())) {
      throw new BadRequestException('Enter the 6-digit verification code.');
    }

    const phoneNormalized = normalizePhone(phone);
    const directory = this.platform.isEnabled() ? this.platform.findUserByUsername(username.trim()) : undefined;
    const verified = this.inUserClinic(username.trim(), () => {
      const user = this.usersRepo.findByUsername(username.trim());
      if (!user || !user.isActive || user.phoneNormalized !== phoneNormalized) {
        return { user: null as null, otp: null as null };
      }
      return { user, otp: this.resetRepo.findActiveByUserId(user.id) ?? null };
    });
    if (!verified.user) {
      throw new UnauthorizedException('Invalid verification code.');
    }
    const otp = verified.otp;
    if (!otp) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }

    if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts. Request a new verification code.');
    }

    const valid = await bcrypt.compare(code.trim(), otp.codeHash);
    if (!valid) {
      this.inUserClinic(username.trim(), () => this.resetRepo.incrementAttempts(otp.id));
      throw new UnauthorizedException('Invalid verification code.');
    }

    this.inUserClinic(username.trim(), () => this.resetRepo.markUsed(otp.id));

    const payload: PasswordResetJwtPayload = {
      sub: verified.user.id,
      username: verified.user.username,
      purpose: 'password_reset',
      clinicId: directory?.clinicId,
    };

    const resetToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret.getSecret(),
      expiresIn: RESET_TOKEN_TTL,
    });

    return { resetToken };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
    this.ensureOnlineRecoveryEnabled();

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    let payload: PasswordResetJwtPayload;
    try {
      payload = this.jwtService.verify<PasswordResetJwtPayload>(resetToken, {
        secret: this.jwtSecret.getSecret(),
      });
    } catch {
      throw new UnauthorizedException('Password reset link has expired. Start again.');
    }

    if (payload.purpose !== 'password_reset') {
      throw new UnauthorizedException('Invalid password reset token.');
    }

    const apply = () => {
      const user = this.usersRepo.findById(payload.sub);
      if (!user || !user.isActive || user.username !== payload.username) {
        throw new UnauthorizedException('Invalid password reset token.');
      }
      return user;
    };
    const user = payload.clinicId ? runInTenant(payload.clinicId, apply) : apply();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const persist = () => {
      this.usersRepo.update(user.id, { passwordHash });
      this.resetRepo.invalidateActiveForUser(user.id);
    };
    if (payload.clinicId) runInTenant(payload.clinicId, persist);
    else persist();

    return { message: 'Password updated successfully. You can sign in with your new password.' };
  }

  private generateOtp(): string {
    const max = 10 ** OTP_LENGTH;
    const num = crypto.randomInt(0, max);
    return num.toString().padStart(OTP_LENGTH, '0');
  }
}
