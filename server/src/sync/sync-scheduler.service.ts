import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DeploymentService } from '../common/deployment.service';
import { SyncEngineService } from './sync-engine.service';
import { SyncPairingService } from './sync-pairing.service';

@Injectable()
export class SyncSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly deployment: DeploymentService,
    private readonly engine: SyncEngineService,
    private readonly pairing: SyncPairingService,
  ) {}

  onModuleInit() {
    if (!this.deployment.isOffline()) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (!this.pairing.readPeerConfig()) return;
    const result = await this.engine.runOfflineCycle();
    if (result.error) this.logger.warn(`Automatic clinic sync: ${result.error}`);
  }
}
