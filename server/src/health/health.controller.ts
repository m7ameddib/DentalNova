import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '../common/version';
import { InstallationService } from '../installation/installation.service';

@Controller('health')
export class HealthController {
  constructor(private readonly installation: InstallationService) {}

  @Get()
  check() {
    const status = this.installation.getStatus();
    return {
      ok: true,
      version: APP_VERSION,
      product: status.product,
      phase: status.phase,
      timestamp: new Date().toISOString(),
    };
  }
}
