import { Controller, Get, SetMetadata } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { SKIP_SUBSCRIPTION_GUARD } from './guards/subscription-active.guard';

@SetMetadata(SKIP_INSTALLATION_GUARD, true)
@SetMetadata(SKIP_SUBSCRIPTION_GUARD, true)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscription: SubscriptionService) {}

  @Get('status')
  status() {
    return this.subscription.getStatusResponse();
  }
}
