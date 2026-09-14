import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../database/repositories/users.repository';
import { PasswordResetRepository } from '../database/repositories/password-reset.repository';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { isValidPhone, normalizePhone } from '../common/phone.util';
import { JwtSecretService } from './jwt-secret.service';
import { PasswordResetJwtPayload } from './auth.types';
import { PASSWORD_RESET_JWT_ISSUER } from './jwt-payload.util';
import { PlatformService } from '../platform/platform.service';
import { runInTenant } from '../platform/tenant-context';

export const RECOVERY_CODE_ONLY =
  'SMS verification is not available. Use the clinic recovery code from Settings or DibNova Admin.';

const RESET_TOKEN_TTL = '15m';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly resetRepo: PasswordResetRepository,
    private readonly jwtService: JwtService,
    private readonly jwtSecret: JwtSecretService,
    private readonly platform: PlatformService,
    private readonly clinicSettings: ClinicSettingsRepository,
  ) {}

  private inUserClinic<T>(username: string, fn: () => T): T {
    if (!this.platform.isEnabled()) return fn();
    const directory = this.platform.findUserByUsername(username);
    if (!directory) return fn();
    return runInTenant(directory.clinicId, fn);
  }

  async recoverWithCode(username: string, recoveryCode: string): Promise<{ resetToken: string }> {
    const directory = this.platform.isEnabled() ? this.platform.findUserByUsername(username.trim()) : undefined;
    const user = this.inUserClinic(username.trim(), () => this.usersRepo.findByUsername(username.trim()));
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid recovery details.');
    }
    const hash = directory
      ? this.platform.getRecoveryHash(directory.clinicId)
      : this.clinicSettings.getRecoveryHash();
    if (!hash) {
      throw new UnauthorizedException('Account recovery is not set up for this clinic.');
    }
    const valid = await bcrypt.compare(recoveryCode.trim(), hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid recovery details.');
    }
    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        purpose: 'password_reset',
        clinicId: directory?.clinicId,
      } satisfies PasswordResetJwtPayload,
      {
        secret: this.jwtSecret.getResetSecret(),
        expiresIn: RESET_TOKEN_TTL,
        issuer: PASSWORD_RESET_JWT_ISSUER,
      },
    );
    return { resetToken };
  }

  async recoverUsername(phone: string, recoveryCode: string): Promise<{ usernames: string[] }> {
    if (!isValidPhone(phone)) {
      throw new BadRequestException('Enter a valid phone number.');
    }
    const phoneNormalized = normalizePhone(phone);
    if (this.platform.isEnabled()) {
      const matches = this.platform.findUsersByPhone(phoneNormalized);
      const usernames: string[] = [];
      for (const match of matches) {
        const hash = this.platform.getRecoveryHash(match.clinicId);
        if (hash && (await bcrypt.compare(recoveryCode.trim(), hash))) {
          usernames.push(match.username);
        }
      }
      return { usernames };
    }
    const hash = this.clinicSettings.getRecoveryHash();
    if (!hash || !(await bcrypt.compare(recoveryCode.trim(), hash))) {
      return { usernames: [] };
    }
    const user = this.usersRepo.findByPhoneNormalized(phoneNormalized);
    return { usernames: user ? [user.username] : [] };
  }

  async requestOtp(_username: string, _phone: string): Promise<{ message: string }> {
    throw new BadRequestException(RECOVERY_CODE_ONLY);
  }

  async verifyOtp(_username: string, _phone: string, _code: string): Promise<{ resetToken: string }> {
    throw new BadRequestException(RECOVERY_CODE_ONLY);
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    let payload: PasswordResetJwtPayload;
    try {
      payload = this.jwtService.verify<PasswordResetJwtPayload>(resetToken, {
        secret: this.jwtSecret.getResetSecret(),
        issuer: PASSWORD_RESET_JWT_ISSUER,
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
}
