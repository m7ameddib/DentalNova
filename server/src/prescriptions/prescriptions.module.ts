import { Module } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { MedicationCatalogController } from './medication-catalog.controller';
import { MedicationCatalogService } from './medication-catalog.service';
import { PrescriptionsRepository } from '../database/repositories/prescriptions.repository';
import { MedicationCatalogRepository } from '../database/repositories/medication-catalog.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';

@Module({
  controllers: [PrescriptionsController, MedicationCatalogController],
  providers: [
    PrescriptionsService,
    PrescriptionsRepository,
    PatientsRepository,
    MedicationCatalogService,
    MedicationCatalogRepository,
  ],
})
export class PrescriptionsModule {}
