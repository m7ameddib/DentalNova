import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { APP_VERSION } from '../common/version';
import { InstallationService } from '../installation/installation.service';
import { DeploymentService } from '../common/deployment.service';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly installation: InstallationService,
    private readonly deployment: DeploymentService,
    private readonly database: DatabaseService,
  ) {}

  @Get()
  check() {
    let databaseOk = false;
    try {
      databaseOk = this.database.ping();
    } catch {
      databaseOk = false;
    }
    const status = this.installation.getStatus();
    const body = {
      ok: databaseOk,
      version: APP_VERSION,
      product: status.product,
      phase: status.phase,
      deploymentMode: this.deployment.getMode(),
      timestamp: new Date().toISOString(),
    };
    if (!databaseOk) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
