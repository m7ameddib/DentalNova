import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { LicenseService } from '../common/license.service';
import { OfflineLicensingRepository } from './offline-licensing.repository';
import {
  CreateOfflineLicenseSlotDto,
  OfflineActivateDto,
} from './dto/offline-licensing.dto';

export interface OfflineActivateResponse {
  license: string;
  clinicId: string;
  clinicName: string;
  licenseId: string;
}

export interface CreateOfflineLicenseSlotResponse {
  clinicId: string;
  clinicName: string;
  licenseId: string;
  activationCode: string;
  installationId: string | null;
  slotExpiresAt: string | null;
  licenseExpiresAt: string | null;
}

@Injectable()
export class OfflineLicensingService {
  private readonly logger = new Logger(OfflineLicensingService.name);

  constructor(
    private readonly repo: OfflineLicensingRepository,
    private readonly license: LicenseService,
  ) {}

  isIssuer(): boolean {
    return this.license.canSign();
  }

  createSlot(dto: CreateOfflineLicenseSlotDto): CreateOfflineLicenseSlotResponse {
    if (!this.license.canSign()) {
      throw new ServiceUnavailableException(
        'Offline license issuance is not configured on this server.',
      );
    }

    if (this.repo.findByClinicId(dto.clinicId)) {
      throw new ConflictException('An offline license slot already exists for this clinic ID.');
    }

    const activationCode = this.generateActivationCode();
    const lookup = this.activationCodeLookup(activationCode);
    const licenseId = crypto.randomUUID();
    const installationId = dto.installationId?.trim() || null;

    if (installationId && !/^[a-f0-9]{32}$/i.test(installationId)) {
      throw new BadRequestException('Installation ID must be a 32-character hex string.');
    }

    const slotExpiresAt = dto.slotExpiresAt ? this.parseOptionalDate(dto.slotExpiresAt, 'slot expiry') : null;
    const licenseExpiresAt = dto.licenseExpiresAt
      ? this.parseOptionalDate(dto.licenseExpiresAt, 'license expiry')
      : null;

    this.repo.create({
      clinicId: dto.clinicId,
      clinicName: dto.clinicName,
      licenseId,
      activationCodeLookup: lookup,
      installationId,
      slotExpiresAt: slotExpiresAt?.toISOString() ?? null,
      licenseExpiresAt: licenseExpiresAt?.toISOString() ?? null,
      adminNotes: dto.adminNotes ?? null,
    });

    this.logger.log(`Created offline license slot for clinic ${dto.clinicId}`);

    return {
      clinicId: dto.clinicId.trim(),
      clinicName: dto.clinicName.trim(),
      licenseId,
      activationCode,
      installationId,
      slotExpiresAt: slotExpiresAt?.toISOString() ?? null,
      licenseExpiresAt: licenseExpiresAt?.toISOString() ?? null,
    };
  }

  listSlots() {
    return this.repo.listRecent().map((slot) => ({
      id: slot.id,
      clinicId: slot.clinicId,
      clinicName: slot.clinicName,
      licenseId: slot.licenseId,
      installationId: slot.installationId,
      status: slot.status,
      slotExpiresAt: slot.slotExpiresAt,
      licenseExpiresAt: slot.licenseExpiresAt,
      redeemedAt: slot.redeemedAt,
      createdAt: slot.createdAt,
      adminNotes: slot.adminNotes,
    }));
  }

  redeem(dto: OfflineActivateDto): OfflineActivateResponse {
    if (!this.license.canSign()) {
      throw new ServiceUnavailableException(
        'Online activation is temporarily unavailable. Use manual license key activation or try again later.',
      );
    }

    const installationId = dto.installationId.trim();
    if (!/^[a-f0-9]{32}$/i.test(installationId)) {
      throw new BadRequestException('Invalid installation ID.');
    }

    const activationCode = this.normalizeActivationCode(dto.activationCode);
    const slot = this.repo.findByActivationLookup(this.activationCodeLookup(activationCode));
    if (!slot) {
      throw new BadRequestException('Invalid or expired activation code.');
    }

    if (slot.status === 'revoked') {
      throw new BadRequestException('This activation code has been revoked.');
    }
    if (slot.status === 'redeemed') {
      throw new BadRequestException('This activation code has already been used.');
    }

    if (slot.slotExpiresAt) {
      const slotExpiry = new Date(slot.slotExpiresAt);
      if (!Number.isNaN(slotExpiry.getTime()) && slotExpiry.getTime() < Date.now()) {
        throw new BadRequestException('This activation code has expired.');
      }
    }

    if (slot.installationId && slot.installationId.toLowerCase() !== installationId.toLowerCase()) {
      throw new BadRequestException(
        'This activation code is bound to a different installation ID.',
      );
    }

    const clinicName = dto.clinicName?.trim() || slot.clinicName;
    const payload = this.license.createPayload({
      clinicId: slot.clinicId,
      clinicName,
      installationId,
      licenseId: slot.licenseId,
      expiresAt: slot.licenseExpiresAt,
    });
    const license = this.license.signPayload(payload);

    this.repo.markRedeemed(slot.id, installationId);
    this.logger.log(`Offline license redeemed for clinic ${slot.clinicId} / installation ${installationId}`);

    return {
      license,
      clinicId: slot.clinicId,
      clinicName,
      licenseId: slot.licenseId,
    };
  }

  private generateActivationCode(): string {
    const segment = crypto.randomBytes(5).toString('hex').toUpperCase();
    const segment2 = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `DNT-${segment}-${segment2}`;
  }

  private normalizeActivationCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

  private activationCodeLookup(normalizedCode: string): string {
    return crypto.createHash('sha256').update(normalizedCode, 'utf8').digest('hex');
  }

  private parseOptionalDate(value: string, label: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${label} date.`);
    }
    return date;
  }
}
