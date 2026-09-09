import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DeploymentService } from '../common/deployment.service';
import { InstallationRepository } from '../installation/installation.repository';
import { ClinicSettingsRepository } from '../database/repositories/clinic-settings.repository';
import { SubscriptionRepository } from './subscription.repository';
import {
  OnlineSubscriptionStatus,
  OnlineSubscriptionStatusResponse,
} from './subscription.types';
import { PlatformService } from '../platform/platform.service';
import { getTenantClinicId } from '../platform/tenant-context';

const SUBSCRIPTION_TERM_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly repo: SubscriptionRepository,
    private readonly installation: InstallationRepository,
    private readonly clinicSettings: ClinicSettingsRepository,
    private readonly deployment: DeploymentService,
    private readonly platform: PlatformService,
  ) {}

  isApplicable(): boolean {
    if (!this.deployment.isOnline()) return false;
    return Boolean(this.currentClinicId());
  }

  /** Resolve effective status, auto-expiring ACTIVE subscriptions past expiry. */
  effectiveStatus(): OnlineSubscriptionStatus | null {
    if (!this.isApplicable()) return null;
    const clinicId = this.currentClinicId();
    if (clinicId && this.platform.isEnabled()) {
      return this.platform.getSubscription(clinicId).status;
    }

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
    const clinicId = this.currentClinicId();
    const row =
      applicable && clinicId && this.platform.isEnabled()
        ? this.platform.getSubscription(clinicId)
        : applicable
          ? this.repo.get()
          : null;
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

  activate(adminNotes?: string, clinicId?: string): OnlineSubscriptionStatusResponse {
    const id = this.requireManagedClinicId(clinicId);
    if (this.platform.isEnabled()) {
      this.platform.setSubscriptionActive(id, adminNotes);
      this.logger.log(`Online subscription activated for clinic ${id}`);
      return this.statusForClinic(id);
    }
    this.assertOnlineReady();
    const now = new Date();
    const expires = new Date(now.getTime() + SUBSCRIPTION_TERM_MS);
    this.repo.setActive(now.toISOString(), expires.toISOString(), adminNotes ?? null);
    this.logger.log(`Online subscription activated until ${expires.toISOString()}`);
    return this.getStatusResponse();
  }

  extend(adminNotes?: string, clinicId?: string): OnlineSubscriptionStatusResponse {
    const id = this.requireManagedClinicId(clinicId);
    if (this.platform.isEnabled()) {
      this.platform.extendSubscription(id, adminNotes);
      this.logger.log(`Online subscription extended for clinic ${id}`);
      return this.statusForClinic(id);
    }
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

  suspend(reason?: string, clinicId?: string): OnlineSubscriptionStatusResponse {
    const id = this.requireManagedClinicId(clinicId);
    if (this.platform.isEnabled()) {
      const status = this.platform.getSubscription(id).status;
      if (status !== 'ACTIVE' && status !== 'PENDING') {
        throw new BadRequestException('Only active or pending clinics can be suspended.');
      }
      this.platform.setSubscriptionSuspended(id, reason);
      this.logger.log(`Online subscription suspended for clinic ${id}`);
      return this.statusForClinic(id);
    }
    this.assertOnlineReady();
    const status = this.effectiveStatus();
    if (status !== 'ACTIVE' && status !== 'PENDING') {
      throw new BadRequestException('Only active or pending clinics can be suspended.');
    }
    this.repo.setSuspended(reason?.trim() || null);
    this.logger.log('Online subscription suspended.');
    return this.getStatusResponse();
  }

  reactivate(adminNotes?: string, clinicId?: string): OnlineSubscriptionStatusResponse {
    const id = this.requireManagedClinicId(clinicId);
    if (this.platform.isEnabled()) {
      const status = this.platform.getSubscription(id).status;
      if (status !== 'SUSPENDED' && status !== 'EXPIRED') {
        throw new BadRequestException('Only suspended or expired clinics can be reactivated.');
      }
      return this.activate(adminNotes, id);
    }
    this.assertOnlineReady();
    const status = this.effectiveStatus();
    if (status !== 'SUSPENDED' && status !== 'EXPIRED') {
      throw new BadRequestException('Only suspended or expired clinics can be reactivated.');
    }
    return this.activate(adminNotes);
  }

  getAdminClinicInfo() {
    if (this.platform.isEnabled()) {
      return {
        deploymentMode: this.deployment.getMode(),
        installationId: 'platform',
        clinicName: '',
        clinicPhone: '',
        setupCompletedAt: null,
        phase: 'ready' as const,
        clinics: this.listAdminClinics(),
        subscription: {
          deploymentMode: 'online' as const,
          applicable: false,
          status: null,
          startedAt: null,
          expiresAt: null,
          suspendedAt: null,
          suspendedReason: null,
          canUseSystem: false,
        },
        offlineLicense: null,
      };
    }

    const installation = this.installation.get();
    const clinic = this.clinicSettings.get();
    const subscription = this.getStatusResponse();

    return {
      deploymentMode: this.deployment.getMode(),
      installationId: installation.installationId,
      clinicName: clinic.clinicName,
      clinicPhone: clinic.clinicPhone,
      setupCompletedAt: installation.setupCompletedAt,
      phase: this.installation.phase(),
      subscription,
      offlineLicense: this.deployment.isOffline()
        ? {
            activatedAt: installation.licenseActivatedAt,
            hasLicense: Boolean(installation.licensePayload),
          }
        : null,
    };
  }

  listAdminClinics() {
    if (!this.platform.isEnabled()) return [];
    return this.platform.listClinics().map((clinic) => {
      const sub = this.platform.getSubscription(clinic.id);
      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        clinicPhone: clinic.phone,
        createdAt: clinic.createdAt,
        subscription: {
          deploymentMode: 'online' as const,
          applicable: true,
          status: sub.status,
          startedAt: sub.startedAt,
          expiresAt: sub.expiresAt,
          suspendedAt: sub.suspendedAt,
          suspendedReason: sub.suspendedReason,
          canUseSystem: sub.status === 'ACTIVE',
        },
      };
    });
  }

  private statusForClinic(clinicId: string): OnlineSubscriptionStatusResponse {
    const sub = this.platform.getSubscription(clinicId);
    return {
      deploymentMode: 'online',
      applicable: true,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      suspendedAt: sub.suspendedAt,
      suspendedReason: sub.suspendedReason,
      canUseSystem: sub.status === 'ACTIVE',
    };
  }

  private currentClinicId(): string | undefined {
    return getTenantClinicId();
  }

  private requireManagedClinicId(clinicId?: string): string {
    if (!this.deployment.isOnline()) {
      throw new BadRequestException('Online subscription management applies to online deployments only.');
    }
    const id = clinicId?.trim() || this.currentClinicId();
    if (!id) {
      throw new BadRequestException('Clinic id is required.');
    }
    this.platform.requireClinic(id);
    return id;
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
