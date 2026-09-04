import { Module } from '@nestjs/common';
import { LabCasesController } from './lab-cases.controller';
import { LabCasesService } from './lab-cases.service';
import { LabCasesRepository } from '../database/repositories/lab-cases.repository';
import { LabCasePaymentsRepository } from '../database/repositories/lab-case-payments.repository';
import { LabWorkTypesRepository } from '../database/repositories/lab-work-types.repository';
import { LabNamesRepository } from '../database/repositories/lab-names.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { ClinicExpensesRepository } from '../database/repositories/clinic-expenses.repository';
import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';
import { LabServiceCostsRepository } from '../database/repositories/lab-service-costs.repository';
import { LabAccountPaymentsRepository } from '../database/repositories/lab-account-payments.repository';

@Module({
  controllers: [LabCasesController],
  providers: [
    LabCasesService,
    LabCasesRepository,
    LabCasePaymentsRepository,
    LabWorkTypesRepository,
    LabNamesRepository,
    LabServiceCostsRepository,
    LabAccountPaymentsRepository,
    PatientsRepository,
    PatientTreatmentsRepository,
    ClinicExpensesRepository,
    PaymentMethodsRepository,
  ],
  exports: [LabCasesService, LabCasesRepository],
})
export class LabCasesModule {}

