import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from '../database/repositories/payments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';

@Module({
  imports: [FollowUpsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, PatientsRepository, PaymentMethodsRepository],
  exports: [PaymentsService],
})
export class PaymentsModule {}
