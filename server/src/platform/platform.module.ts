import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DeploymentService } from '../common/deployment.service';
import { PlatformService } from './platform.service';
import { TenantContextInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [
    DeploymentService,
    PlatformService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [DeploymentService, PlatformService],
})
export class PlatformModule {}
