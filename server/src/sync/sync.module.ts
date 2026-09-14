import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SyncController } from './sync.controller';
import { SyncPairingService } from './sync-pairing.service';
import { SyncEngineService } from './sync-engine.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { DeviceAuthGuard } from './device-auth.guard';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service';
import { AuthModule } from '../auth/auth.module';
import { InstallationModule } from '../installation/installation.module';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => AuthModule), forwardRef(() => InstallationModule)],
  controllers: [SyncController],
  providers: [
    SyncPairingService,
    SyncEngineService,
    SyncSchedulerService,
    DeviceAuthGuard,
    ClinicSettingsRepository,
    AuthRateLimitService,
  ],
  exports: [SyncEngineService, SyncPairingService],
})
export class SyncModule {}
