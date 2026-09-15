import { Module } from '@nestjs/common';
import { OfflineLicensingController } from './offline-licensing.controller';
import { OfflineLicensingService } from './offline-licensing.service';
import { OfflineLicensingRepository } from './offline-licensing.repository';
import { InstallationModule } from '../installation/installation.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [InstallationModule, AuthModule],
  controllers: [OfflineLicensingController],
  providers: [OfflineLicensingService, OfflineLicensingRepository],
  exports: [OfflineLicensingService],
})
export class OfflineLicensingModule {}
