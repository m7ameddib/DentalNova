import { Module } from '@nestjs/common';
import { TreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';
import { TreatmentTypesRepository } from '../database/repositories/treatment-types.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { GuarantorsRepository } from '../database/repositories/guarantors.repository';

@Module({
  imports: [FollowUpsModule],
  controllers: [TreatmentsController],
  providers: [
    TreatmentsService,
    TreatmentTypesRepository,
    PatientTreatmentsRepository,
    PatientsRepository,
    GuarantorsRepository,
  ],
  exports: [TreatmentsService],
})
export class TreatmentsModule {}