import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DibNovaAdminGuard } from './dibnova-admin.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { OfflineLicensingService } from '../offline-licensing/offline-licensing.service';
import { AdminMarketingTrialDto, AdminNotesDto, AdminPaymentDto, AdminResetPasswordDto } from './dto/admin-notes.dto';
import { InstallationService } from '../installation/installation.service';
import { CreateOfflineLicenseSlotDto } from '../offline-licensing/dto/offline-licensing.dto';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { SKIP_SUBSCRIPTION_GUARD } from '../subscription/guards/subscription-active.guard';
import { SetMetadata } from '@nestjs/common';
import { PlatformService } from '../platform/platform.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DeploymentService } from '../common/deployment.service';
import { ObjectStorageService } from '../storage/object-storage.service';

@UseGuards(DibNovaAdminGuard)
@SetMetadata(SKIP_INSTALLATION_GUARD, true)
@SetMetadata(SKIP_SUBSCRIPTION_GUARD, true)
@Controller('dibnova-admin')
export class DibNovaAdminController {
  constructor(
    private readonly subscription: SubscriptionService,
    private readonly offlineLicensing: OfflineLicensingService,
    private readonly platform: PlatformService,
    private readonly installation: InstallationService,
    private readonly deployment: DeploymentService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /** Clinic installation info — online subscription or offline license metadata. */
  @Get('installation')
  getInstallation() {
    return {
      ...this.subscription.getAdminClinicInfo(),
      offlineLicensing: {
        canIssueOfflineLicenses: this.offlineLicensing.isIssuer(),
      },
    };
  }

  @Get('clinics')
  listClinics() {
    return this.subscription.listAdminClinics();
  }

  @Get('dashboard')
  dashboard() {
    return this.subscription.dashboard();
  }

  @Get('history')
  history(@Query('clinicId') clinicId?: string) {
    return this.platform.isEnabled() ? this.platform.listEvents(clinicId) : [];
  }

  @Get('trials')
  listTrials() {
    return this.subscription.listAdminClinics().filter((clinic) => {
      const status = clinic.subscription.status;
      return Boolean(clinic.trialType) || status === 'TRIAL_PENDING' || status === 'TRIAL_ACTIVE' || status === 'TRIAL_EXPIRED' || status === 'PENDING';
    });
  }

  @Post('trials/marketing')
  createMarketingTrial(@Body() dto: AdminMarketingTrialDto) {
    return this.installation.createMarketingTrial({ doctorName: dto.doctorName, phone: dto.phone });
  }

  @Post('trials/activate')
  activateTrial(@Body() dto: AdminNotesDto) {
    if (!dto.clinicId) throw new BadRequestException('Clinic id is required.');
    return this.subscription.activateTrial(dto.notes, dto.clinicId);
  }

  /** Activate a PENDING online clinic. */
  @Post('subscription/activate')
  activate(@Body() dto: AdminNotesDto) {
    return this.subscription.activate(dto.notes, dto.clinicId, dto.days, dto.expiresAt);
  }

  @Post('clinics/:clinicId/subscription/activate')
  activateClinic(@Param('clinicId') clinicId: string, @Body() dto: AdminNotesDto) {
    return this.subscription.activate(dto.notes, clinicId, dto.days, dto.expiresAt);
  }

  /** Extend an active online subscription. */
  @Post('subscription/extend')
  extend(@Body() dto: AdminNotesDto) {
    return this.subscription.extend(dto.notes, dto.clinicId, dto.days, dto.expiresAt);
  }

  @Post('clinics/:clinicId/subscription/extend')
  extendClinic(@Param('clinicId') clinicId: string, @Body() dto: AdminNotesDto) {
    return this.subscription.extend(dto.notes, clinicId, dto.days, dto.expiresAt);
  }

  /** Suspend an online clinic. */
  @Post('subscription/suspend')
  suspend(@Body() dto: AdminNotesDto) {
    return this.subscription.suspend(dto.reason ?? dto.notes, dto.clinicId);
  }

  @Post('clinics/:clinicId/subscription/suspend')
  suspendClinic(@Param('clinicId') clinicId: string, @Body() dto: AdminNotesDto) {
    return this.subscription.suspend(dto.reason ?? dto.notes, clinicId);
  }

  /** Reactivate a suspended or expired online clinic (new 1-year term). */
  @Post('subscription/reactivate')
  reactivate(@Body() dto: AdminNotesDto) {
    return this.subscription.reactivate(dto.notes, dto.clinicId);
  }

  @Post('clinics/:clinicId/subscription/reactivate')
  reactivateClinic(@Param('clinicId') clinicId: string, @Body() dto: AdminNotesDto) {
    return this.subscription.reactivate(dto.notes, clinicId);
  }

  @Post('subscription/cancel')
  cancel(@Body() dto: AdminNotesDto) {
    return this.subscription.cancel(dto.reason ?? dto.notes, dto.clinicId);
  }

  @Post('subscription/delete')
  deleteClinic(@Body() dto: AdminNotesDto) {
    if (!dto.clinicId) throw new BadRequestException('Clinic id is required.');
    return this.subscription.deleteClinic(dto.clinicId);
  }

  @Get('payments')
  listPayments(@Query('clinicId') clinicId?: string) {
    return this.platform.isEnabled() ? this.platform.listPayments(clinicId) : [];
  }

  @Get('payments/balance')
  paymentBalance(@Query('clinicId') clinicId?: string) {
    if (!clinicId || !this.platform.isEnabled()) return { balanceCents: 0 };
    return { balanceCents: this.platform.paymentBalanceCents(clinicId) };
  }

  @Post('payments')
  addPayment(@Body() dto: AdminPaymentDto) {
    if (!dto.clinicId) throw new BadRequestException('Clinic id is required.');
    return this.platform.addPayment({
      clinicId: dto.clinicId,
      amountCents: Math.round(dto.amount * 100),
      paymentDate: dto.paymentDate,
      method: dto.method,
      note: dto.note,
    });
  }

  @Post('payments/:id/update')
  updatePayment(@Param('id') id: string, @Body() dto: AdminPaymentDto) {
    return this.platform.updatePayment(Number(id), {
      amountCents: dto.amount != null ? Math.round(dto.amount * 100) : undefined,
      paymentDate: dto.paymentDate,
      method: dto.method,
      note: dto.note,
    });
  }

  @Post('payments/:id/void')
  voidPayment(@Param('id') id: string, @Body() dto: AdminNotesDto) {
    return this.platform.voidPayment(Number(id), dto.reason ?? dto.notes);
  }

  @Get('ops/health')
  opsHealth() {
    return {
      ok: true,
      deploymentMode: this.deployment.getMode(),
      platformEnabled: this.platform.isEnabled(),
      clinicCount: this.platform.isEnabled() ? this.subscription.listAdminClinics().length : 0,
      r2Configured: this.objectStorage.usesR2(),
      uptimeSec: Math.round(process.uptime()),
    };
  }

  @Get('clinics/:clinicId/ops')
  clinicOps(@Param('clinicId') clinicId: string) {
    if (!this.platform.isEnabled()) {
      return { clinicId, patientCount: 0, backupZipCount: 0, attachmentBytes: 0, clinicDbBytes: 0, syncDevices: [] };
    }
    try {
      return this.platform.clinicOpsSummary(clinicId);
    } catch {
      throw new BadRequestException('Unknown clinic');
    }
  }

  @Get('ai-usage')
  aiUsage(@Query('clinicId') clinicId?: string) {
    return this.platform.isEnabled() ? this.platform.listAiUsage(clinicId) : [];
  }

  @Get('clinics/:clinicId/users')
  listClinicUsers(@Param('clinicId') clinicId: string) {
    return this.platform.isEnabled() ? this.platform.listClinicUsers(clinicId) : [];
  }

  @Post('users/reset-password')
  async resetUserPassword(@Body() dto: AdminResetPasswordDto) {
    if (dto.newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
    const hash = await bcrypt.hash(dto.newPassword, 10);
    this.platform.updateClinicUserPassword(dto.clinicId, dto.userId, hash);
    return { reset: true };
  }

  @Post('recovery-code')
  async issueRecoveryCode(@Body() dto: AdminNotesDto) {
    if (!dto.clinicId) throw new BadRequestException('Clinic id is required.');
    const code = `DN-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const hash = await bcrypt.hash(code, 10);
    this.platform.setRecoveryHash(dto.clinicId, hash);
    return { recoveryCode: code };
  }

  @Post('signup-invite')
  createSignupInvite() {
    return this.platform.createSignupInvite();
  }

  /** Create a one-time offline activation code (licensing server only). */
  @Post('offline-license/create-slot')
  createOfflineLicenseSlot(@Body() dto: CreateOfflineLicenseSlotDto) {
    return this.offlineLicensing.createSlot(dto);
  }

  /** List recent offline activation slots (licensing server only). */
  @Get('offline-license/slots')
  listOfflineLicenseSlots() {
    return this.offlineLicensing.listSlots();
  }
}
