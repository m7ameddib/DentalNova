import { Injectable, NotFoundException } from '@nestjs/common';
import { ClinicalVisitNotesRepository } from '../database/repositories/clinical-visit-notes.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { AuditService } from '../audit/audit.service';
import { CreateClinicalVisitNoteDto } from './dto/create-clinical-visit-note.dto';
import { UpdateClinicalVisitNoteDto } from './dto/update-clinical-visit-note.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class ClinicalVisitNotesService {
  constructor(
    private readonly repo: ClinicalVisitNotesRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly audit: AuditService,
  ) {}

  listForPatient(patientId: number) {
    this.assertPatient(patientId);
    return this.repo.findByPatient(patientId);
  }

  create(patientId: number, dto: CreateClinicalVisitNoteDto, user: AuthenticatedUser) {
    this.assertPatient(patientId);
    const created = this.repo.create({
      patientId,
      visitDate: dto.visitDate,
      chiefComplaint: dto.chiefComplaint ?? null,
      examinationFindings: dto.examinationFindings ?? null,
      diagnosis: dto.diagnosis ?? null,
      procedureAction: dto.procedureAction ?? null,
      anesthesiaNote: dto.anesthesiaNote ?? null,
      clinicalNotes: dto.clinicalNotes ?? null,
      patientInstructions: dto.patientInstructions ?? null,
      createdById: user.id,
    });
    this.audit.log({
      action: 'CLINICAL_NOTE_CREATED',
      entityType: 'clinical_visit_note',
      entityId: created.id,
      patientId,
      description: `Clinical visit note for ${dto.visitDate}`,
      userId: user.id,
    });
    return created;
  }

  update(id: number, dto: UpdateClinicalVisitNoteDto, user: AuthenticatedUser) {
    const existing = this.repo.findById(id);
    if (!existing) throw new NotFoundException('Clinical visit note not found');
    const updated = this.repo.update(id, { ...dto, updatedById: user.id });
    this.audit.log({
      action: 'CLINICAL_NOTE_UPDATED',
      entityType: 'clinical_visit_note',
      entityId: id,
      patientId: existing.patientId,
      description: `Clinical visit note updated (${updated!.visitDate})`,
      userId: user.id,
    });
    return updated;
  }

  private assertPatient(patientId: number) {
    if (!this.patientsRepo.findById(patientId)) throw new NotFoundException('Patient not found');
  }
}
