import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PatientAttachmentsRepository } from '../database/repositories/patient-attachments.repository';
import { PatientsRepository } from '../database/repositories/patients.repository';
import { PatientTreatmentsRepository } from '../database/repositories/patient-treatments.repository';
import { ClinicalVisitNotesRepository } from '../database/repositories/clinical-visit-notes.repository';
import { UploadsService } from '../common/uploads.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { AuthenticatedUser } from '../auth/auth.types';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

@Injectable()
export class PatientAttachmentsService {
  constructor(
    private readonly repo: PatientAttachmentsRepository,
    private readonly patientsRepo: PatientsRepository,
    private readonly treatmentsRepo: PatientTreatmentsRepository,
    private readonly visitNotesRepo: ClinicalVisitNotesRepository,
    private readonly uploads: UploadsService,
  ) {}

  list(patientId: number) {
    this.assertPatientExists(patientId);
    return this.repo.findByPatient(patientId);
  }

  upload(patientId: number, file: Express.Multer.File, dto: CreateAttachmentDto, currentUser: AuthenticatedUser) {
    this.assertPatientExists(patientId);
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_FILE_SIZE_BYTES) throw new BadRequestException('File is too large (max 25MB)');

    if (dto.patientTreatmentId) {
      const treatment = this.treatmentsRepo.findById(dto.patientTreatmentId);
      if (!treatment || treatment.patientId !== patientId) {
        throw new BadRequestException('Invalid treatment link');
      }
    }
    if (dto.clinicalVisitNoteId) {
      const note = this.visitNotesRepo.findById(dto.clinicalVisitNoteId);
      if (!note || note.patientId !== patientId) {
        throw new BadRequestException('Invalid clinical visit link');
      }
    }

    const teeth = this.parseTeeth(dto.teeth);

    const dir = this.uploads.patientUploadsDir(patientId);
    const fileName = this.uploads.safeFileName(file.originalname);
    fs.writeFileSync(path.join(dir, fileName), file.buffer);
    const relativePath = path.join('patients', String(patientId), fileName);

    return this.repo.create({
      patientId,
      originalFileName: file.originalname,
      category: dto.category,
      storedPath: relativePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      note: dto.note ?? null,
      uploadedById: currentUser.id,
      patientTreatmentId: dto.patientTreatmentId ?? null,
      clinicalVisitNoteId: dto.clinicalVisitNoteId ?? null,
      teeth,
    });
  }

  getFileAbsolutePath(patientId: number, attachmentId: number): { absolutePath: string; mimeType: string | null; fileName: string } {
    const attachment = this.repo.findById(attachmentId);
    if (!attachment || attachment.patientId !== patientId) {
      throw new NotFoundException('Attachment not found');
    }
    const absolutePath = this.uploads.resolveManagedPath(attachment.storedPath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      throw new NotFoundException('File not found');
    }
    return { absolutePath, mimeType: attachment.mimeType, fileName: attachment.originalFileName };
  }

  remove(patientId: number, attachmentId: number) {
    const attachment = this.repo.findById(attachmentId);
    if (!attachment || attachment.patientId !== patientId) {
      throw new NotFoundException('Attachment not found');
    }
    this.repo.delete(attachmentId);
    this.uploads.deleteManagedFile(attachment.storedPath);
    return { id: attachmentId, patientId };
  }

  private parseTeeth(raw?: string): number[] {
    if (!raw?.trim()) return [];
    const teeth = raw
      .split(/[,\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 11 && n <= 48);
    return [...new Set(teeth)].sort((a, b) => a - b);
  }

  private assertPatientExists(patientId: number) {
    if (!this.patientsRepo.findById(patientId)) throw new NotFoundException('Patient not found');
  }
}
