import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '../common/version';
import { InstallationService } from '../installation/installation.service';
import { DeploymentService } from '../common/deployment.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly installation: InstallationService,
    private readonly deployment: DeploymentService,
  ) {}

  @Get()
  check() {
    const status = this.installation.getStatus();
    return {
      ok: true,
      version: APP_VERSION,
      product: status.product,
      phase: status.phase,
      deploymentMode: this.deployment.getMode(),
      timestamp: new Date().toISOString(),
    };
  }
}
