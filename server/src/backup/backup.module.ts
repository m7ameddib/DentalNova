import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { DatabaseModule } from '../database/database.module';
import { UploadsService } from '../common/uploads.service';

@Module({
  imports: [DatabaseModule],
  controllers: [BackupController],
  providers: [BackupService, UploadsService],
})
export class BackupModule {}
