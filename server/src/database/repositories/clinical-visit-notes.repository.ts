import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { ClinicalVisitNote } from '../../common/types';

export interface CreateClinicalVisitNoteInput {
  patientId: number;
  visitDate: string;
  chiefComplaint?: string | null;
  examinationFindings?: string | null;
  diagnosis?: string | null;
  procedureAction?: string | null;
  anesthesiaNote?: string | null;
  clinicalNotes?: string | null;
  patientInstructions?: string | null;
  createdById?: number | null;
}

export interface UpdateClinicalVisitNoteInput {
  visitDate?: string;
  chiefComplaint?: string | null;
  examinationFindings?: string | null;
  diagnosis?: string | null;
  procedureAction?: string | null;
  anesthesiaNote?: string | null;
  clinicalNotes?: string | null;
  patientInstructions?: string | null;
  updatedById?: number | null;
}

const SELECT = `
  SELECT n.*, cu.full_name as created_by_name, uu.full_name as updated_by_name
  FROM clinical_visit_notes n
  LEFT JOIN users cu ON cu.id = n.created_by_id
  LEFT JOIN users uu ON uu.id = n.updated_by_id
`;

@Injectable()
export class ClinicalVisitNotesRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): ClinicalVisitNote | undefined {
    const row = this.db.connection.prepare(`${SELECT} WHERE n.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<ClinicalVisitNote>(row) : undefined;
  }

  findByPatient(patientId: number): ClinicalVisitNote[] {
    const rows = this.db.connection
      .prepare(`${SELECT} WHERE n.patient_id = ? ORDER BY n.visit_date DESC, n.created_at DESC, n.id DESC`)
      .all(patientId) as Record<string, unknown>[];
    return toCamelList<ClinicalVisitNote>(rows);
  }

  create(input: CreateClinicalVisitNoteInput): ClinicalVisitNote {
    const result = this.db.connection
      .prepare(
        `INSERT INTO clinical_visit_notes
          (patient_id, visit_date, chief_complaint, examination_findings, diagnosis,
           procedure_action, anesthesia_note, clinical_notes, patient_instructions, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.patientId,
        input.visitDate,
        input.chiefComplaint ?? null,
        input.examinationFindings ?? null,
        input.diagnosis ?? null,
        input.procedureAction ?? null,
        input.anesthesiaNote ?? null,
        input.clinicalNotes ?? null,
        input.patientInstructions ?? null,
        input.createdById ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdateClinicalVisitNoteInput): ClinicalVisitNote | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    this.db.connection
      .prepare(
        `UPDATE clinical_visit_notes SET
          visit_date = ?, chief_complaint = ?, examination_findings = ?, diagnosis = ?,
          procedure_action = ?, anesthesia_note = ?, clinical_notes = ?, patient_instructions = ?,
          updated_by_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        input.visitDate ?? existing.visitDate,
        input.chiefComplaint !== undefined ? input.chiefComplaint : existing.chiefComplaint,
        input.examinationFindings !== undefined ? input.examinationFindings : existing.examinationFindings,
        input.diagnosis !== undefined ? input.diagnosis : existing.diagnosis,
        input.procedureAction !== undefined ? input.procedureAction : existing.procedureAction,
        input.anesthesiaNote !== undefined ? input.anesthesiaNote : existing.anesthesiaNote,
        input.clinicalNotes !== undefined ? input.clinicalNotes : existing.clinicalNotes,
        input.patientInstructions !== undefined ? input.patientInstructions : existing.patientInstructions,
        input.updatedById ?? null,
        id,
      );
    return this.findById(id);
  }
}
