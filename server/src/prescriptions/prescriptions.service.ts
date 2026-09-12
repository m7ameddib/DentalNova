import { Injectable, NotFoundException } from '@nestjs/common';
import { PrescriptionsRepository } from '../database/repositories/prescriptions.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prescriptionsRepo: PrescriptionsRepository,
    private readonly patientsRepo: PatientsRepository,
  ) {}

  list(patientId: number) {
    this.assertPatientExists(patientId);
    return this.prescriptionsRepo.findByPatient(patientId);
  }

  create(patientId: number, dto: CreatePrescriptionDto, currentUser: AuthenticatedUser) {
    this.assertPatientExists(patientId);
    return this.prescriptionsRepo.create({
      patientId,
      doctorId: currentUser.id,
      type: dto.type ?? 'MEDICATION',
      items: dto.items.map((item) => ({
        medicineName: item.medicineName.trim(),
        dose: item.dose?.trim() || null,
        frequency: item.frequency?.trim() || null,
        duration: item.duration?.trim() || null,
        instructions: item.instructions?.trim() || null,
      })),
    });
  }

  update(patientId: number, id: number, dto: CreatePrescriptionDto) {
    const existing = this.prescriptionsRepo.findById(id);
    if (!existing || existing.patientId !== patientId) {
      throw new NotFoundException('Prescription not found');
    }
    const updated = this.prescriptionsRepo.replaceItems(
      id,
      dto.items.map((item) => ({
        medicineName: item.medicineName.trim(),
        dose: item.dose?.trim() || null,
        frequency: item.frequency?.trim() || null,
        duration: item.duration?.trim() || null,
        instructions: item.instructions?.trim() || null,
      })),
    );
    if (!updated) throw new NotFoundException('Prescription not found');
    return updated;
  }

  remove(patientId: number, id: number) {
    const existing = this.prescriptionsRepo.findById(id);
    if (!existing || existing.patientId !== patientId) {
      throw new NotFoundException('Prescription not found');
    }
    this.prescriptionsRepo.delete(id);
    return { id, patientId };
  }

  private assertPatientExists(patientId: number) {
    if (!this.patientsRepo.findById(patientId)) throw new NotFoundException('Patient not found');
  }
}
