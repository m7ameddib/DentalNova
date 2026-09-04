import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TreatmentTypesRepository } from '../database/repositories/treatment-types.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { GuarantorsRepository } from '../database/repositories/guarantors.repository';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { AuditService } from '../audit/audit.service';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { CreateTreatmentTypeDto } from './dto/create-treatment-type.dto';
import { UpdateTreatmentTypeDto } from './dto/update-treatment-type.dto';
import { UpdateTreatmentStatusDto } from './dto/update-treatment-status.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { TREATMENT_CATEGORY_COLORS } from '../common/treatment-catalog.constants';
import {
  priceMultiplier,
  resolveScope,
  teethForScope,
  TreatmentScope,
} from './treatment-scope.util';
import { localTodayIso } from '../common/local-date.util';

@Injectable()
export class TreatmentsService {
  constructor(
    private readonly treatmentTypesRepo: TreatmentTypesRepository,
    private readonly patientTreatmentsRepo: PatientTreatmentsRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly guarantorsRepo: GuarantorsRepository,
    private readonly followUpsService: FollowUpsService,
    private readonly audit: AuditService,
  ) {}

  listTreatmentTypes() {
    return this.treatmentTypesRepo.findAllActive();
  }

  listTreatmentCatalog() {
    return this.treatmentTypesRepo.findAll();
  }

  createTreatmentType(dto: CreateTreatmentTypeDto) {
    const code = this.generateCode(dto.label);
    if (this.treatmentTypesRepo.findByCode(code)) {
      throw new BadRequestException('A treatment type with a similar name already exists');
    }
    return this.treatmentTypesRepo.create({
      code,
      abbreviation: dto.abbreviation.trim().toUpperCase(),
      label: dto.label.trim(),
      colorHex: dto.colorHex ?? (dto.category ? TREATMENT_CATEGORY_COLORS[dto.category as keyof typeof TREATMENT_CATEGORY_COLORS] : undefined),
      defaultPriceCents: Math.round(dto.defaultPrice * 100),
      referencePriceCents: dto.referencePrice != null ? Math.round(dto.referencePrice * 100) : null,
      category: dto.category ?? null,
      scope: dto.scope ?? 'SINGLE',
      followUp1Days: dto.followUp1Days ?? null,
      followUp2Days: dto.followUp2Days ?? null,
      followUp3Days: dto.followUp3Days ?? null,
    });
  }

  updateTreatmentType(id: number, dto: UpdateTreatmentTypeDto) {
    if (!this.treatmentTypesRepo.findById(id)) {
      throw new NotFoundException('Treatment type not found');
    }
    return this.treatmentTypesRepo.update(id, {
      label: dto.label?.trim(),
      abbreviation: dto.abbreviation?.trim().toUpperCase(),
      colorHex: dto.colorHex,
      isActive: dto.isActive,
      defaultPriceCents: dto.defaultPrice != null ? Math.round(dto.defaultPrice * 100) : undefined,
      referencePriceCents:
        dto.referencePrice !== undefined
          ? dto.referencePrice == null
            ? null
            : Math.round(dto.referencePrice * 100)
          : undefined,
      category: dto.category,
      scope: dto.scope,
      followUp1Days: dto.followUp1Days,
      followUp2Days: dto.followUp2Days,
      followUp3Days: dto.followUp3Days,
    });
  }

  create(dto: CreateTreatmentDto, currentUser: AuthenticatedUser) {
    const patient = this.patientsRepo.findById(dto.patientId);
    if (!patient) throw new NotFoundException('Patient not found');

    const type = this.treatmentTypesRepo.findById(dto.treatmentTypeId);
    if (!type) throw new NotFoundException('Treatment type not found');

    const scope = resolveScope(dto.treatmentScope, (type as { scope?: TreatmentScope }).scope ?? null);
    const teeth = this.resolveTeeth(scope, dto.teeth);
    const amounts = this.computeAmounts(type.id, type.defaultPriceCents, patient.guarantorId ?? null, scope, teeth, dto.discount ?? 0);

    const followUpDaysFromType = [
      type.followUp1Days ?? type.followUpDays ?? null,
      type.followUp2Days ?? null,
      type.followUp3Days ?? null,
    ];

    const created = this.patientTreatmentsRepo.create({
      patientId: dto.patientId,
      treatmentTypeId: dto.treatmentTypeId,
      teeth,
      ...amounts,
      status: dto.status,
      note: dto.note ?? null,
      doctorId: currentUser.id,
      treatmentDate: dto.treatmentDate ?? localTodayIso(),
      treatmentScope: scope,
      followUp1Days: followUpDaysFromType[0],
      followUp2Days: followUpDaysFromType[1],
      followUp3Days: followUpDaysFromType[2],
    });

    if (dto.status === 'COMPLETED') {
      this.patientTreatmentsRepo.updateStatus(created.id, 'COMPLETED', currentUser.id);
    }

    const treatmentDate = dto.treatmentDate ?? created.createdAt.slice(0, 10);
    this.followUpsService.createClinicalFollowUpsFromTreatment(
      dto.patientId,
      created.id,
      type,
      treatmentDate,
      currentUser.id,
      followUpDaysFromType,
    );
    this.followUpsService.onPaymentChanged(dto.patientId);

    this.audit.log({
      action: 'TREATMENT_ADDED',
      entityType: 'patient_treatment',
      entityId: created.id,
      patientId: dto.patientId,
      description: `Treatment added: ${type.label}`,
      userId: currentUser.id,
    });

    return this.patientTreatmentsRepo.findById(created.id)!;
  }

  update(id: number, dto: UpdateTreatmentDto, currentUser: AuthenticatedUser) {
    const existing = this.patientTreatmentsRepo.findById(id);
    if (!existing) throw new NotFoundException('Treatment entry not found');
    if (existing.status === 'VOID') throw new BadRequestException('Cannot edit a voided treatment');

    const patient = this.patientsRepo.findById(existing.patientId);
    if (!patient) throw new NotFoundException('Patient not found');

    const typeId = dto.treatmentTypeId ?? existing.treatmentTypeId;
    const type = this.treatmentTypesRepo.findById(typeId);
    if (!type) throw new NotFoundException('Treatment type not found');

    const scope = resolveScope(
      dto.treatmentScope ?? (existing as { treatmentScope?: TreatmentScope }).treatmentScope,
      (type as { scope?: TreatmentScope }).scope ?? null,
    );
    const teeth = dto.teeth ? this.resolveTeeth(scope, dto.teeth) : existing.teeth;
    const discount = dto.discount !== undefined ? dto.discount : existing.discountCents / 100;
    const amounts = this.computeAmounts(type.id, type.defaultPriceCents, patient.guarantorId ?? null, scope, teeth, discount);

    const updated = this.patientTreatmentsRepo.update(id, {
      treatmentTypeId: dto.treatmentTypeId,
      teeth,
      ...amounts,
      status: dto.status,
      note: dto.note !== undefined ? dto.note : undefined,
      treatmentDate: dto.treatmentDate,
      treatmentScope: scope,
    });

    if (dto.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      this.patientTreatmentsRepo.updateStatus(id, 'COMPLETED', currentUser.id);
    }

    this.followUpsService.onPaymentChanged(existing.patientId);
    this.audit.log({
      action: 'TREATMENT_UPDATED',
      entityType: 'patient_treatment',
      entityId: id,
      patientId: existing.patientId,
      description: `Treatment updated: ${type.label}`,
      userId: currentUser.id,
    });

    return updated!;
  }

  void(id: number, currentUser: AuthenticatedUser) {
    const existing = this.patientTreatmentsRepo.findById(id);
    if (!existing) throw new NotFoundException('Treatment entry not found');
    if (existing.status === 'VOID') return existing;

    const updated = this.patientTreatmentsRepo.updateStatus(id, 'VOID');
    this.followUpsService.onPaymentChanged(existing.patientId);
    this.audit.log({
      action: 'TREATMENT_STATUS_CHANGED',
      entityType: 'patient_treatment',
      entityId: id,
      patientId: existing.patientId,
      description: 'Treatment voided',
      userId: currentUser.id,
    });
    return updated;
  }

  remove(id: number, currentUser: AuthenticatedUser) {
    const existing = this.patientTreatmentsRepo.findById(id);
    if (!existing) throw new NotFoundException('Treatment entry not found');

    this.followUpsService.deleteByTreatmentId(id);
    const deleted = this.patientTreatmentsRepo.delete(id);
    if (!deleted) throw new NotFoundException('Treatment entry not found');

    this.followUpsService.onPaymentChanged(existing.patientId);
    this.audit.log({
      action: 'TREATMENT_DELETED',
      entityType: 'patient_treatment',
      entityId: id,
      patientId: existing.patientId,
      description: 'Treatment permanently deleted',
      userId: currentUser.id,
    });
  }

  updateStatus(id: number, dto: UpdateTreatmentStatusDto, currentUser: AuthenticatedUser) {
    const existing = this.patientTreatmentsRepo.findById(id);
    if (!existing) throw new NotFoundException('Treatment entry not found');

    const updated = this.patientTreatmentsRepo.updateStatus(id, dto.status, currentUser.id);
    if (!updated) throw new NotFoundException('Treatment entry not found');

    if (dto.status === 'VOID') {
      this.followUpsService.onPaymentChanged(updated.patientId);
    }

    this.audit.log({
      action: 'TREATMENT_STATUS_CHANGED',
      entityType: 'patient_treatment',
      entityId: id,
      patientId: existing.patientId,
      description: `Treatment status: ${existing.status} → ${dto.status}`,
      userId: currentUser.id,
    });

    return updated;
  }

  private resolveTeeth(scope: TreatmentScope, selected: number[]): number[] {
    if (scope === 'UPPER_JAW' || scope === 'LOWER_JAW' || scope === 'ALL_TEETH') {
      return teethForScope(scope);
    }
    if (!selected || selected.length === 0) {
      throw new BadRequestException('Select at least one tooth');
    }
    return selected;
  }

  private computeAmounts(
    treatmentTypeId: number,
    defaultPriceCents: number,
    guarantorId: number | null,
    scope: TreatmentScope,
    teeth: number[],
    discountUnits: number,
  ) {
    let unitPriceCents = defaultPriceCents;
    if (guarantorId) {
      const guarantorPrice = this.guarantorsRepo.findPrice(guarantorId, treatmentTypeId);
      if (guarantorPrice != null) unitPriceCents = guarantorPrice;
    }
    const multiplier = priceMultiplier(scope, teeth.length);
    const baseAmountCents = unitPriceCents * multiplier;
    const discountCents = Math.round(discountUnits * 100);
    const finalAmountCents = Math.max(0, baseAmountCents - discountCents);
    return { baseAmountCents, discountCents, finalAmountCents };
  }

  private generateCode(label: string): string {
    return label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
