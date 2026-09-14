import { Body, Controller, Post, Req, SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { OfflineLicensingService } from './offline-licensing.service';
import { OfflineActivateDto } from './dto/offline-licensing.dto';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { SKIP_SUBSCRIPTION_GUARD } from '../subscription/guards/subscription-active.guard';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { requestClientIp } from '../common/loopback.util';

const ACTIVATE_LIMIT = 10;
const ACTIVATE_WINDOW_MS = 15 * 60 * 1000;

@Controller('licensing')
@SetMetadata(SKIP_INSTALLATION_GUARD, true)
@SetMetadata(SKIP_SUBSCRIPTION_GUARD, true)
export class OfflineLicensingController {
  constructor(
    private readonly licensing: OfflineLicensingService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  @Post('offline-activate')
  offlineActivate(@Body() dto: OfflineActivateDto, @Req() req: Request) {
    const key = `offline-activate:${requestClientIp(req)}`;
    this.rateLimit.assertAllowed(key, ACTIVATE_LIMIT, ACTIVATE_WINDOW_MS);
    this.rateLimit.recordFailure(key, ACTIVATE_WINDOW_MS);
    return this.licensing.redeem(dto);
  }
}
