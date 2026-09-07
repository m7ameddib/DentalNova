import { Module } from '@nestjs/common';
import { DibNovaAdminController } from './dibnova-admin.controller';
import { DibNovaAdminGuard } from './dibnova-admin.guard';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [DibNovaAdminController],
  providers: [DibNovaAdminGuard],
})
export class DibNovaAdminModule {}
