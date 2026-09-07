import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionActiveGuard } from './guards/subscription-active.guard';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { InstallationModule } from '../installation/installation.module';

@Module({
  imports: [forwardRef(() => InstallationModule)],
  controllers: [SubscriptionController],
  providers: [
    SubscriptionService,
    SubscriptionRepository,
    ClinicSettingsRepository,
    {
      provide: APP_GUARD,
      useClass: SubscriptionActiveGuard,
    },
  ],
  exports: [SubscriptionService, SubscriptionRepository],
})
export class SubscriptionModule {}
