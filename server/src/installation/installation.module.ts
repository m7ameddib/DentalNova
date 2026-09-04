import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InstallationController } from './installation.controller';
import { InstallationService } from './installation.service';
import { InstallationRepository } from './installation.repository';
import { InstallationReadyGuard } from './guards/installation-ready.guard';
import { LicenseService } from '../common/license.service';
import { PathsService } from '../common/paths.service';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { UsersRepository } from '../database/repositories/users.repository';
import { RolesRepository } from '../database/repositories/roles.repository';
import { HealthController } from '../health/health.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InstallationController, HealthController],  providers: [
    InstallationService,
    InstallationRepository,
    LicenseService,
    PathsService,
    ClinicSettingsRepository,
    UsersRepository,
    RolesRepository,
    {
      provide: APP_GUARD,
      useClass: InstallationReadyGuard,
    },
  ],
  exports: [InstallationService, PathsService, LicenseService],
})
export class InstallationModule {}
