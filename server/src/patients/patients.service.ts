import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientsRepository, UpdatePatientInput } from '../database/repositories/patients.repository';
import { PaymentsRepository } from '../database/repositories/payments.repository';
import { AccountDiscountsRepository } from '../database/repositories/account-discounts.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { AppointmentsRepository } from '../database/repositories/appointments.repository';
import { UploadsService } from '../common/uploads.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepo: PatientsRepository,
    private readonly paymentsRepo: PaymentsRepository,
    private readonly accountDiscountsRepo: AccountDiscountsRepository,
    private readonly treatmentsRepo: PatientTreatmentsRepository,
    private readonly appointmentsRepo: AppointmentsRepository,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
  ) {}

  search(query?: string, includeArchived?: boolean) {
    const patients =
      query && query.trim()
        ? this.patientsRepo.search(query.trim(), 50, includeArchived)
        : this.patientsRepo.findAll(200, includeArchived);
    return patients;
  }

  getById(id: number) {
    const patient = this.patientsRepo.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');

    const familyMembers = patient.familyGroupId
      ? this.patientsRepo.findFamilyMembers(patient.familyGroupId, patient.id)
      : [];

    return { ...patient, familyMembers };
  }

  checkPhone(phone: string) {
    return this.patientsRepo.findByPhone(phone);
  }

  create(dto: CreatePatientDto) {
    if (dto.linkFamilyOfPatientId) {
      const relative = this.patientsRepo.findById(dto.linkFamilyOfPatientId);
      if (!relative) throw new NotFoundException('Referenced family member not found');

      let familyGroupId = relative.familyGroupId;
      if (!familyGroupId) {
        const group = this.patientsRepo.createFamilyGroup(relative.phone, null);
        familyGroupId = group.id;
        this.patientsRepo.update(relative.id, { familyGroupId });
      }

      return this.patientsRepo.create({ ...this.toCreateInput(dto), familyGroupId });
    }

    const existing = this.patientsRepo.findByPhone(dto.phone);
    if (existing.length > 0) {
      throw new ConflictException({
        message: 'A patient with this phone number already exists',
        code: 'PHONE_EXISTS',
        existingPatients: existing,
      });
    }

    return this.patientsRepo.create(this.toCreateInput(dto));
  }

  update(id: number, dto: UpdatePatientDto, currentUser?: AuthenticatedUser) {
    const payload: UpdatePatientDto = { ...dto };
    if (payload.dateOfBirth) {
      payload.approxAge = undefined;
    }
    const repoInput: UpdatePatientInput = {
      ...payload,
      approxAge: payload.dateOfBirth ? null : payload.approxAge,
    };
    if (payload.accountDiscount !== undefined) {
      repoInput.accountDiscountCents = Math.round(payload.accountDiscount * 100);
    }
    const updated = this.patientsRepo.update(id, repoInput);
    if (!updated) throw new NotFoundException('Patient not found');
    this.audit.log({
      action: 'PATIENT_UPDATED',
      entityType: 'patient',
      entityId: id,
      patientId: id,
      description: `Patient information updated: ${updated.fullName}`,
      userId: currentUser?.id ?? null,
    });
    return updated;
  }

  /**
   * Archives a patient — hides from active lists while preserving all history.
   */
  archive(id: number) {
    this.assertExists(id);
    const archived = this.patientsRepo.archive(id);
    if (!archived) throw new NotFoundException('Patient not found');
    return { id, archived: true, archivedAt: archived.archivedAt };
  }

  restore(id: number) {
    const patient = this.patientsRepo.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');
    const restored = this.patientsRepo.restore(id);
    return { id, restored: true, archivedAt: restored!.archivedAt };
  }

  deletePermanently(id: number, currentUser?: AuthenticatedUser) {
    const patient = this.patientsRepo.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');
    if (!patient.archivedAt) {
      throw new ConflictException('Only archived patients can be permanently deleted');
    }
    const deleted = this.patientsRepo.delete(id);
    if (!deleted) throw new NotFoundException('Patient not found');
    this.audit.log({
      action: 'PATIENT_DELETED_PERMANENTLY',
      entityType: 'patient',
      entityId: id,
      patientId: id,
      description: `Patient permanently deleted: ${patient.fullName}`,
      userId: currentUser?.id ?? null,
    });
    return { id, deleted: true };
  }

  listArchived() {
    return this.patientsRepo.findArchived();
  }

  getAccountSummary(patientId: number) {
    this.assertExists(patientId);
    const subtotalCents = this.treatmentsRepo.totalCostForPatient(patientId);
    const accountDiscountCents = this.accountDiscountsRepo.totalForPatient(patientId);
    const totalCostCents = Math.max(0, subtotalCents - accountDiscountCents);
    const totalPaidCents = this.paymentsRepo.totalPaidForPatient(patientId);
    const lastPayments = this.paymentsRepo.findByPatient(patientId, 2);
    const lastDiscounts = this.accountDiscountsRepo.findByPatient(patientId, 2);
    return {
      subtotalCents,
      accountDiscountCents,
      totalCostCents,
      totalPaidCents,
      remainingCents: totalCostCents - totalPaidCents,
      lastPayments,
      lastDiscounts,
    };
  }

  getUpcomingAppointments(patientId: number) {
    this.assertExists(patientId);
    return this.appointmentsRepo.findByPatient(patientId, true, 5);
  }

  getTreatments(patientId: number) {
    this.assertExists(patientId);
    return this.treatmentsRepo.findByPatient(patientId);
  }

  getPayments(patientId: number) {
    this.assertExists(patientId);
    return this.paymentsRepo.findByPatient(patientId);
  }

  getAccountDiscounts(patientId: number) {
    this.assertExists(patientId);
    return this.accountDiscountsRepo.findByPatient(patientId);
  }

  private assertExists(id: number) {
    if (!this.patientsRepo.findById(id)) throw new NotFoundException('Patient not found');
  }

  private toCreateInput(dto: CreatePatientDto) {
    const dateOfBirth = dto.dateOfBirth ?? null;
    return {
      fullName: dto.fullName,
      phone: dto.phone,
      gender: dto.gender ?? null,
      dateOfBirth,
      approxAge: dateOfBirth ? null : (dto.approxAge ?? null),
      address: dto.address ?? null,
      areaId: dto.areaId ?? null,
      medicalNotes: dto.medicalNotes ?? null,
      generalNotes: dto.generalNotes ?? null,
      weightKg: dto.weightKg ?? null,
      guarantorId: dto.guarantorId ?? null,
    };
  }
}
