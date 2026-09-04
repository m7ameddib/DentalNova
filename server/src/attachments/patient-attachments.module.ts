import { Module } from '@nestjs/common';
import { PatientAttachmentsController } from './patient-attachments.controller';
import { PatientAttachmentsService } from './patient-attachments.service';
import { PatientAttachmentsRepository } from '../database/repositories/patient-attachments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { ClinicalVisitNotesRepository } from '../database/repositories/clinical-visit-notes.repository';
import { UploadsService } from '../common/uploads.service';

@Module({
  controllers: [PatientAttachmentsController],
  providers: [
    PatientAttachmentsService,
    PatientAttachmentsRepository,
    PatientsRepository,
    PatientTreatmentsRepository,
    ClinicalVisitNotesRepository,
    UploadsService,
  ],
})
export class PatientAttachmentsModule {}
