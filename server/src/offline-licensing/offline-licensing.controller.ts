import { Body, Controller, Post, SetMetadata } from '@nestjs/common';
import { OfflineLicensingService } from './offline-licensing.service';
import { OfflineActivateDto } from './dto/offline-licensing.dto';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { SKIP_SUBSCRIPTION_GUARD } from '../subscription/guards/subscription-active.guard';

@Controller('licensing')
@SetMetadata(SKIP_INSTALLATION_GUARD, true)
@SetMetadata(SKIP_SUBSCRIPTION_GUARD, true)
export class OfflineLicensingController {
  constructor(private readonly licensing: OfflineLicensingService) {}

  @Post('offline-activate')
  offlineActivate(@Body() dto: OfflineActivateDto) {
    return this.licensing.redeem(dto);
  }
}
