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
    const body: Record<string, unknown> = {
      ok: databaseOk,
      timestamp: new Date().toISOString(),
    };
    if (!this.deployment.isProduction()) {
      body.version = APP_VERSION;
      body.product = status.product;
      body.phase = status.phase;
      body.deploymentMode = this.deployment.getMode();
    }
    if (!databaseOk) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }
}
