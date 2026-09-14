import { Global, Module } from '@nestjs/common';
import { ObjectStorageService } from './object-storage.service';
import { UploadsService } from '../common/uploads.service';

@Global()
@Module({
  providers: [ObjectStorageService, UploadsService],
  exports: [ObjectStorageService, UploadsService],
})
export class StorageModule {}
