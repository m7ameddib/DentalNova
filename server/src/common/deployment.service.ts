import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { onlineBootConfigError } from './online-boot-config.util';

export type DeploymentMode = 'offline' | 'online';
export type ClinicSignupMode = 'open' | 'invite' | 'disabled';

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

  isProduction(): boolean {
    return (this.config.get<string>('NODE_ENV') || '').toLowerCase() === 'production';
  }

  /**
   * Online clinic self-signup. Production defaults to open registration (admin approval via subscription).
   * Set ONLINE_CLINIC_SIGNUP=open|invite|disabled to override.
   */
  clinicSignupMode(): ClinicSignupMode {
    const raw = (this.config.get<string>('ONLINE_CLINIC_SIGNUP') || '').trim().toLowerCase();
    if (raw === 'open' || raw === 'invite' || raw === 'disabled') return raw;
    return 'open';
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
    const error = onlineBootConfigError({
      jwtSecret: this.config.get<string>('JWT_SECRET'),
      geminiApiKey: this.config.get<string>('GEMINI_API_KEY'),
      aiServiceSecret: this.config.get<string>('AI_SERVICE_SECRET'),
      isProduction: this.isProduction(),
      adminUsername: this.config.get<string>('DIBNOVA_ADMIN_USERNAME'),
      adminPassword: this.config.get<string>('DIBNOVA_ADMIN_PASSWORD'),
      platformSecretsKey: this.config.get<string>('PLATFORM_SECRETS_KEY'),
    });
    if (error) throw new Error(error);
  }
}
