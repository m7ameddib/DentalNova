import { Global, Module } from '@nestjs/common';
import { DeploymentService } from '../common/deployment.service';
import { PlatformService } from './platform.service';

@Global()
@Module({
  providers: [DeploymentService, PlatformService],
  exports: [DeploymentService, PlatformService],
})
export class PlatformModule {}
