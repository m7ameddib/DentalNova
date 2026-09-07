import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DibNovaAdminController } from './dibnova-admin.controller';
import { DibNovaAdminAuthController } from './dibnova-admin-auth.controller';
import { DibNovaAdminGuard } from './dibnova-admin.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SubscriptionModule, AuthModule, JwtModule.register({})],
  controllers: [DibNovaAdminController, DibNovaAdminAuthController],
  providers: [DibNovaAdminGuard],
})
export class DibNovaAdminModule {}
