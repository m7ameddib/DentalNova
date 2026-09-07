import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskPhone } from '../common/phone.util';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetOtp(phone: string, code: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER')?.trim() || 'stub';
    const masked = maskPhone(phone);

    if (provider === 'stub') {
      this.logger.log(`Password reset OTP sent to ${masked} via stub provider`);
      if (this.config.get<string>('PASSWORD_RESET_LOG_OTP') === 'true') {
        this.logger.warn(`[PASSWORD_RESET_LOG_OTP] code for ${masked}: ${code}`);
      }
      return;
    }

    // Future: Twilio or other providers plug in here without changing auth flow.
    this.logger.warn(`SMS provider "${provider}" is not configured; OTP for ${masked} was not delivered`);
  }
}
