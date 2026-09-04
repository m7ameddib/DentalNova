import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from '../database/repositories/appointments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsRepository, PatientsRepository],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
