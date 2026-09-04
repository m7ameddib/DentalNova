import { Module } from '@nestjs/common';
import { AccountDiscountsController } from './account-discounts.controller';
import { AccountDiscountsService } from './account-discounts.service';
import { AccountDiscountsRepository } from '../database/repositories/account-discounts.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';

@Module({
  imports: [FollowUpsModule],
  controllers: [AccountDiscountsController],
  providers: [AccountDiscountsService, AccountDiscountsRepository, PatientsRepository],
  exports: [AccountDiscountsService, AccountDiscountsRepository],
})
export class AccountDiscountsModule {}
