import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { PaymentsRepository } from '../database/repositories/payments.repository';
import { AppointmentsRepository } from '../database/repositories/appointments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { ClinicExpensesRepository } from '../database/repositories/clinic-expenses.repository';
import { FollowUpsRepository } from '../database/repositories/follow-ups.repository';
import { LabCasesRepository } from '../database/repositories/lab-cases.repository';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';

@Module({
  imports: [FollowUpsModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    PatientTreatmentsRepository,
    PaymentsRepository,
    AppointmentsRepository,
    PatientsRepository,
    ClinicExpensesRepository,
    FollowUpsRepository,
    LabCasesRepository,
  ],
})
export class ReportsModule {}