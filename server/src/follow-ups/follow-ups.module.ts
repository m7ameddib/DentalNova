import { Module } from '@nestjs/common';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';
import { FollowUpsRepository } from '../database/repositories/follow-ups.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PaymentsRepository } from '../database/repositories/payments.repository';
import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [AppointmentsModule],
  controllers: [FollowUpsController],
  providers: [
    FollowUpsService,
    FollowUpsRepository,
    PatientsRepository,
    PaymentsRepository,
    PaymentMethodsRepository,
  ],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
