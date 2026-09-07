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
  ) {}

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

    const user = this.usersRepo.findByUsername(username.trim());
    if (!user || !user.isActive || !user.phoneNormalized) {
      return { message: genericMessage };
    }

    if (user.phoneNormalized !== phoneNormalized) {
      return { message: genericMessage };
    }

    const since = new Date(Date.now() - OTP_RATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    if (this.resetRepo.countRecentRequestsForPhone(phoneNormalized, since) >= OTP_RATE_LIMIT) {
      return { message: genericMessage };
    }

    const code = this.generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    this.resetRepo.create({
      userId: user.id,
      phoneNormalized,
      codeHash,
      expiresAt,
    });

    await this.smsService.sendPasswordResetOtp(user.phone ?? phone, code);

    return { message: genericMessage };
  }

  async verifyOtp(username: string, phone: string, code: string): Promise<{ resetToken: string }> {
    this.ensureOnlineRecoveryEnabled();

    if (!/^\d{6}$/.test(code.trim())) {
      throw new BadRequestException('Enter the 6-digit verification code.');
    }

    const phoneNormalized = normalizePhone(phone);
    const user = this.usersRepo.findByUsername(username.trim());
    if (!user || !user.isActive || user.phoneNormalized !== phoneNormalized) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    const otp = this.resetRepo.findActiveByUserId(user.id);
    if (!otp) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }

    if (otp.attemptCount >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts. Request a new verification code.');
    }

    const valid = await bcrypt.compare(code.trim(), otp.codeHash);
    if (!valid) {
      this.resetRepo.incrementAttempts(otp.id);
      throw new UnauthorizedException('Invalid verification code.');
    }

    this.resetRepo.markUsed(otp.id);

    const payload: PasswordResetJwtPayload = {
      sub: user.id,
      username: user.username,
      purpose: 'password_reset',
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

    const user = this.usersRepo.findById(payload.sub);
    if (!user || !user.isActive || user.username !== payload.username) {
      throw new UnauthorizedException('Invalid password reset token.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    this.usersRepo.update(user.id, { passwordHash });
    this.resetRepo.invalidateActiveForUser(user.id);

    return { message: 'Password updated successfully. You can sign in with your new password.' };
  }

  private generateOtp(): string {
    const max = 10 ** OTP_LENGTH;
    const num = crypto.randomInt(0, max);
    return num.toString().padStart(OTP_LENGTH, '0');
  }
}
