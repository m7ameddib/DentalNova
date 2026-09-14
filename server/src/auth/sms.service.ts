import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** SMS delivery is not shipped. Password reset uses clinic recovery codes only. */
export const SMS_NOT_CONFIGURED =
  'SMS password reset is not available. Use the clinic recovery code from Settings or DibNova Admin.';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetOtp(_phone: string, _code: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER')?.trim() || 'stub';
    this.logger.warn(`Refusing SMS OTP (provider=${provider || 'stub'}). Recovery codes only.`);
    throw new ServiceUnavailableException(SMS_NOT_CONFIGURED);
  }
}
