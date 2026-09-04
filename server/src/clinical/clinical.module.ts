import { Module } from '@nestjs/common';
import { ClinicalController } from './clinical.controller';
import { MedicalAlertsService } from './medical-alerts.service';
import { ClinicalVisitNotesService } from './clinical-visit-notes.service';
import { MedicalAlertsRepository } from '../database/repositories/medical-alerts.repository';
import { ClinicalVisitNotesRepository } from '../database/repositories/clinical-visit-notes.repository';
import { DiseaseCatalogRepository } from '../database/repositories/disease-catalog.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';

@Module({
  controllers: [ClinicalController],
  providers: [
    MedicalAlertsService,
    ClinicalVisitNotesService,
    MedicalAlertsRepository,
    ClinicalVisitNotesRepository,
    DiseaseCatalogRepository,
    PatientsRepository,
  ],
  exports: [MedicalAlertsService, ClinicalVisitNotesService],
})
export class ClinicalModule {}
