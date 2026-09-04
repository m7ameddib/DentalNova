import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PaymentsRepository } from '../database/repositories/payments.repository';
import { AccountDiscountsRepository } from '../database/repositories/account-discounts.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { AppointmentsRepository } from '../database/repositories/appointments.repository';
import { UploadsService } from '../common/uploads.service';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { LabCasesModule } from '../lab-cases/lab-cases.module';

@Module({
  imports: [FollowUpsModule, LabCasesModule],
  controllers: [PatientsController],  providers: [
    PatientsService,
    PatientsRepository,
    PaymentsRepository,
    AccountDiscountsRepository,
    PatientTreatmentsRepository,
    AppointmentsRepository,
    UploadsService,
  ],
  exports: [PatientsService],
})
export class PatientsModule {}
