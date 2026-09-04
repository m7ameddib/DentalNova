import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalAlertsRepository } from '../database/repositories/medical-alerts.repository';
import { DiseaseCatalogRepository } from '../database/repositories/disease-catalog.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { AuditService } from '../audit/audit.service';
import { CreateMedicalAlertDto } from './dto/create-medical-alert.dto';
import { UpdateMedicalAlertDto } from './dto/update-medical-alert.dto';
import { AuthenticatedUser } from '../auth/auth.types';

export const MEDICAL_ALERT_PRESETS: Record<string, string> = {
  ALLERGY: 'Allergy',
  PENICILLIN_ALLERGY: 'Penicillin Allergy',
  ANTICOAGULANTS: 'Anticoagulants / Blood Thinners',
  DIABETES: 'Diabetes',
  HYPERTENSION: 'Hypertension',
  PREGNANCY: 'Pregnancy',
  HEART_CONDITION: 'Heart Condition',
  DISEASE: 'Disease',
  OTHER: 'Other',
};

@Injectable()
export class MedicalAlertsService {
  constructor(
    private readonly repo: MedicalAlertsRepository,
    private readonly diseaseCatalogRepo: DiseaseCatalogRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly audit: AuditService,
  ) {}

  listForPatient(patientId: number, activeOnly = false) {
    this.assertPatient(patientId);
    return this.repo.findByPatient(patientId, activeOnly);
  }

  create(patientId: number, dto: CreateMedicalAlertDto, user: AuthenticatedUser) {
    this.assertPatient(patientId);

    let alertType = dto.alertType ?? 'OTHER';
    let label: string;
    let diseaseCatalogId: number | null = null;

    if (dto.diseaseCatalogId) {
      const disease = this.diseaseCatalogRepo.findById(dto.diseaseCatalogId);
      if (!disease || !disease.isActive) throw new NotFoundException('Disease not found');
      alertType = 'DISEASE';
      label = disease.name;
      diseaseCatalogId = disease.id;
    } else {
      label = this.resolveLabel(alertType, dto.label);
    }

    const created = this.repo.create({
      patientId,
      alertType,
      label,
      note: dto.note ?? null,
      diseaseCatalogId,
      createdById: user.id,
    });
    this.audit.log({
      action: 'MEDICAL_ALERT_CREATED',
      entityType: 'medical_alert',
      entityId: created.id,
      patientId,
      description: `Medical alert added: ${label}`,
      userId: user.id,
    });
    return created;
  }

  update(id: number, dto: UpdateMedicalAlertDto, user: AuthenticatedUser) {
    const existing = this.repo.findById(id);
    if (!existing) throw new NotFoundException('Medical alert not found');
    const label =
      dto.alertType || dto.label
        ? this.resolveLabel(dto.alertType ?? existing.alertType, dto.label ?? existing.label)
        : undefined;
    const updated = this.repo.update(id, {
      alertType: dto.alertType,
      label,
      note: dto.note,
    });
    this.audit.log({
      action: 'MEDICAL_ALERT_UPDATED',
      entityType: 'medical_alert',
      entityId: id,
      patientId: existing.patientId,
      description: `Medical alert updated: ${updated!.label}`,
      userId: user.id,
    });
    return updated;
  }

  deactivate(id: number, user: AuthenticatedUser) {
    const existing = this.repo.findById(id);
    if (!existing) throw new NotFoundException('Medical alert not found');
    const updated = this.repo.deactivate(id, user.id);
    if (!updated) throw new BadRequestException('Alert is already inactive');
    this.audit.log({
      action: 'MEDICAL_ALERT_DEACTIVATED',
      entityType: 'medical_alert',
      entityId: id,
      patientId: existing.patientId,
      description: `Medical alert deactivated: ${existing.label}`,
      userId: user.id,
    });
    return updated;
  }

  private resolveLabel(alertType: string, customLabel?: string): string {
    if (alertType === 'OTHER') {
      const trimmed = customLabel?.trim();
      if (!trimmed) throw new BadRequestException('Label is required for custom alerts');
      return trimmed;
    }
    return MEDICAL_ALERT_PRESETS[alertType] ?? customLabel?.trim() ?? alertType;
  }

  private assertPatient(patientId: number) {
    if (!this.patientsRepo.findById(patientId)) throw new NotFoundException('Patient not found');
  }
}
