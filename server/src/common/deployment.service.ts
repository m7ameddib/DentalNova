import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type DeploymentMode = 'offline' | 'online';

/**
 * Central deployment-mode configuration for the unified DentalNova codebase.
 * - offline: Windows desktop installer, local SQLite, license activation required
 * - online:  Cloud deployment, browser access, no license activation
 */
@Injectable()
export class DeploymentService implements OnModuleInit {
  private readonly logger = new Logger(DeploymentService.name);
  private readonly mode: DeploymentMode;

  constructor(private readonly config: ConfigService) {
    const raw = (this.config.get<string>('DEPLOYMENT_MODE') || 'offline').toLowerCase();
    this.mode = raw === 'online' ? 'online' : 'offline';
  }

  onModuleInit() {
    this.logger.log(`Deployment mode: ${this.mode}`);
    if (this.isOnline()) {
      this.validateOnlineConfig();
    }
  }

  getMode(): DeploymentMode {
    return this.mode;
  }

  isOnline(): boolean {
    return this.mode === 'online';
  }

  isOffline(): boolean {
    return this.mode === 'offline';
  }

  /** Offline desktop installs require a signed license before first setup. */
  requiresLicense(): boolean {
    return this.isOffline();
  }

  /** Comma-separated browser origins allowed in online mode (CORS). */
  allowedOrigins(): string[] {
    const explicit = this.config.get<string>('CORS_ORIGINS');
    if (explicit) {
      return explicit
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    }
    if (this.isOnline()) {
      return ['https://dental.dibnova.com', 'https://dentalnova.dibnova.com'];
    }
    return [];
  }

  private validateOnlineConfig() {
    const jwt = this.config.get<string>('JWT_SECRET');
    if (!jwt || jwt === 'change-this-in-production' || jwt === 'dev-secret') {
      throw new Error(
        'Online deployment requires a strong JWT_SECRET environment variable. ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
      );
    }
  }
}
