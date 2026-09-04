import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { DiseaseCatalogController } from './disease-catalog.controller';
import { DiseaseCatalogService } from './disease-catalog.service';
import { GuarantorsController } from './guarantors.controller';
import { GuarantorsService } from './guarantors.service';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesService } from './expense-categories.service';
import { AreasRepository } from '../database/repositories/areas.repository';
import { DiseaseCatalogRepository } from '../database/repositories/disease-catalog.repository';
import { GuarantorsRepository } from '../database/repositories/guarantors.repository';
import { ExpenseCategoriesRepository } from '../database/repositories/expense-categories.repository';
import { ClinicSettingsController } from './clinic-settings.controller';
import { ClinicSettingsService } from './clinic-settings.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { PaymentMethodsRepository } from '../database/repositories/payment-methods.repository';
import { WorkingScheduleController } from './working-schedule.controller';
import { WorkingScheduleService } from './working-schedule.service';
import { WorkingScheduleRepository } from '../database/repositories/working-schedule.repository';
import { UploadsService } from '../common/uploads.service';

@Module({
  controllers: [
    ClinicSettingsController,
    PaymentMethodsController,
    WorkingScheduleController,
    AreasController,
    DiseaseCatalogController,
    GuarantorsController,
    ExpenseCategoriesController,
  ],
  providers: [
    ClinicSettingsService,
    PaymentMethodsService,
    WorkingScheduleService,
    AreasService,
    DiseaseCatalogService,
    GuarantorsService,
    ExpenseCategoriesService,
    WorkingScheduleRepository,
    ClinicSettingsRepository,
    PaymentMethodsRepository,
    AreasRepository,
    DiseaseCatalogRepository,
    GuarantorsRepository,
    ExpenseCategoriesRepository,
    UploadsService,
  ],
  exports: [ClinicSettingsService, WorkingScheduleService, UploadsService],
})
export class SettingsModule {}
