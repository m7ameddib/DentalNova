import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DeploymentService } from '../common/deployment.service';
import { InstallationRepository } from '../installation/installation.repository';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { SubscriptionRepository } from './subscription.repository';
import {
  OnlineSubscriptionStatus,
  OnlineSubscriptionStatusResponse,
} from './subscription.types';

const SUBSCRIPTION_TERM_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly installation: InstallationRepository,
    private readonly clinicSettings: ClinicSettingsRepository,
    private readonly deployment: DeploymentService,
  ) {}

  isApplicable(): boolean {
    return this.deployment.isOnline() && this.installation.phase() === 'ready';
  }

  /** Resolve effective status, auto-expiring ACTIVE subscriptions past expiry. */
  effectiveStatus(): OnlineSubscriptionStatus | null {
    if (!this.isApplicable()) return null;

    const row = this.repo.get();
    if (!row.status) return 'PENDING';

    if (row.status === 'ACTIVE' && row.expiresAt) {
      const expiry = new Date(row.expiresAt);
      if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        this.repo.setExpired();
        this.logger.log('Online subscription auto-expired.');
        return 'EXPIRED';
      }
    }

    return row.status;
  }

  canUseSystem(): boolean {
    if (!this.isApplicable()) return true;
    return this.effectiveStatus() === 'ACTIVE';
  }

  getStatusResponse(): OnlineSubscriptionStatusResponse {
    const applicable = this.isApplicable();
    const row = applicable ? this.repo.get() : null;
    const status = applicable ? this.effectiveStatus() : null;

    return {
      deploymentMode: this.deployment.getMode(),
      applicable,
      status,
      startedAt: row?.startedAt ?? null,
      expiresAt: row?.expiresAt ?? null,
      suspendedAt: row?.suspendedAt ?? null,
      suspendedReason: row?.suspendedReason ?? null,
      canUseSystem: this.canUseSystem(),
    };
  }

  activate(adminNotes?: string): OnlineSubscriptionStatusResponse {
    this.assertOnlineReady();
    const now = new Date();
    const expires = new Date(now.getTime() + SUBSCRIPTION_TERM_MS);
    this.repo.setActive(now.toISOString(), expires.toISOString(), adminNotes ?? null);
    this.logger.log(`Online subscription activated until ${expires.toISOString()}`);
    return this.getStatusResponse();
  }

  extend(adminNotes?: string): OnlineSubscriptionStatusResponse {
    this.assertOnlineReady();
    const row = this.repo.get();
    const base = row.expiresAt ? new Date(row.expiresAt) : new Date();
    const startFrom =
      !Number.isNaN(base.getTime()) && base.getTime() > Date.now() ? base : new Date();
    const expires = new Date(startFrom.getTime() + SUBSCRIPTION_TERM_MS);
    this.repo.extendExpiry(expires.toISOString(), adminNotes ?? null);
    this.logger.log(`Online subscription extended until ${expires.toISOString()}`);
    return this.getStatusResponse();
  }

  suspend(reason?: string): OnlineSubscriptionStatusResponse {
    this.assertOnlineReady();
    const status = this.effectiveStatus();
    if (status !== 'ACTIVE' && status !== 'PENDING') {
      throw new BadRequestException('Only active or pending clinics can be suspended.');
    }
    this.repo.setSuspended(reason?.trim() || null);
    this.logger.log('Online subscription suspended.');
    return this.getStatusResponse();
  }

  reactivate(adminNotes?: string): OnlineSubscriptionStatusResponse {
    this.assertOnlineReady();
    const status = this.effectiveStatus();
    if (status !== 'SUSPENDED' && status !== 'EXPIRED') {
      throw new BadRequestException('Only suspended or expired clinics can be reactivated.');
    }
    return this.activate(adminNotes);
  }

  getAdminClinicInfo() {
    const installation = this.installation.get();
    const clinic = this.clinicSettings.get();
    const subscription = this.getStatusResponse();

    return {
      deploymentMode: this.deployment.getMode(),
      installationId: installation.installationId,
      clinicName: clinic.clinicName,
      clinicPhone: clinic.clinicPhone,
      setupCompletedAt: installation.setupCompletedAt,
      subscription,
      offlineLicense: this.deployment.isOffline()
        ? {
            activatedAt: installation.licenseActivatedAt,
            hasLicense: Boolean(installation.licensePayload),
          }
        : null,
    };
  }

  private assertOnlineReady(): void {
    if (!this.deployment.isOnline()) {
      throw new BadRequestException('Online subscription management applies to online deployments only.');
    }
    if (this.installation.phase() !== 'ready') {
      throw new BadRequestException('Clinic setup must be completed first.');
    }
  }
}
