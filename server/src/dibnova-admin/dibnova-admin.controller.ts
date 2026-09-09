import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DibNovaAdminGuard } from './dibnova-admin.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { OfflineLicensingService } from '../offline-licensing/offline-licensing.service';
import { AdminNotesDto } from './dto/admin-notes.dto';
import { CreateOfflineLicenseSlotDto } from '../offline-licensing/dto/offline-licensing.dto';
import { SKIP_INSTALLATION_GUARD } from '../installation/guards/installation-ready.guard';
import { SKIP_SUBSCRIPTION_GUARD } from '../subscription/guards/subscription-active.guard';
import { SetMetadata } from '@nestjs/common';

@UseGuards(DibNovaAdminGuard)
@SetMetadata(SKIP_INSTALLATION_GUARD, true)
@SetMetadata(SKIP_SUBSCRIPTION_GUARD, true)
@Controller('dibnova-admin')
export class DibNovaAdminController {
  constructor(
    private readonly subscription: SubscriptionService,
    private readonly offlineLicensing: OfflineLicensingService,
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

  /** Activate a PENDING online clinic (1-year subscription). */
  @Post('subscription/activate')
  activate(@Body() dto: AdminNotesDto) {
    return this.subscription.activate(dto.notes, dto.clinicId);
  }

  @Post('clinics/:clinicId/subscription/activate')
  activateClinic(@Param('clinicId') clinicId: string, @Body() dto: AdminNotesDto) {
    return this.subscription.activate(dto.notes, clinicId);
  }

  /** Extend an active online subscription by 1 year. */
  @Post('subscription/extend')
  extend(@Body() dto: AdminNotesDto) {
    return this.subscription.extend(dto.notes, dto.clinicId);
  }

  @Post('clinics/:clinicId/subscription/extend')
  extendClinic(@Param('clinicId') clinicId: string, @Body() dto: AdminNotesDto) {
    return this.subscription.extend(dto.notes, clinicId);
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
