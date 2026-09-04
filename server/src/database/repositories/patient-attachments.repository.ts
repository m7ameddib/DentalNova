import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database.service';

import { toCamel, toCamelList } from '../row-mapper.util';

import { AttachmentCategory, PatientAttachment } from '../../common/types';



export interface CreatePatientAttachmentInput {

  patientId: number;

  originalFileName: string;

  category: AttachmentCategory;

  storedPath: string;

  mimeType?: string | null;

  fileSize?: number | null;

  note?: string | null;

  uploadedById?: number | null;

  patientTreatmentId?: number | null;

  clinicalVisitNoteId?: number | null;

  teeth?: number[];

}



const SELECT = `

  SELECT pa.*,

    tt.label as treatment_label,

    cvn.visit_date as visit_date,

    (SELECT GROUP_CONCAT(pat.tooth_number) FROM patient_attachment_teeth pat WHERE pat.attachment_id = pa.id) as teeth_csv

  FROM patient_attachments pa

  LEFT JOIN patient_treatments pt ON pt.id = pa.patient_treatment_id

  LEFT JOIN treatment_types tt ON tt.id = pt.treatment_type_id

  LEFT JOIN clinical_visit_notes cvn ON cvn.id = pa.clinical_visit_note_id

`;



function mapAttachmentRow(row: Record<string, unknown>): PatientAttachment {

  const { teeth_csv, ...rest } = row;

  const mapped = toCamel<PatientAttachment>(rest);

  mapped.teeth = teeth_csv

    ? String(teeth_csv)

        .split(',')

        .map((n) => Number(n))

        .sort((a, b) => a - b)

    : [];

  return mapped;

}



@Injectable()

export class PatientAttachmentsRepository {

  constructor(private readonly db: DatabaseService) {}



  findById(id: number): PatientAttachment | undefined {

    const row = this.db.connection.prepare(`${SELECT} WHERE pa.id = ?`).get(id) as

      | Record<string, unknown>

      | undefined;

    return row ? mapAttachmentRow(row) : undefined;

  }



  findByPatient(patientId: number): PatientAttachment[] {

    const rows = this.db.connection

      .prepare(`${SELECT} WHERE pa.patient_id = ? ORDER BY pa.created_at DESC, pa.id DESC`)

      .all(patientId) as Record<string, unknown>[];

    return rows.map(mapAttachmentRow);

  }



  create(input: CreatePatientAttachmentInput): PatientAttachment {

    const insertTooth = this.db.connection.prepare(

      `INSERT INTO patient_attachment_teeth (attachment_id, tooth_number) VALUES (?, ?)`,

    );



    const tx = this.db.connection.transaction((data: CreatePatientAttachmentInput) => {

      const result = this.db.connection

        .prepare(

          `INSERT INTO patient_attachments

            (patient_id, original_file_name, category, stored_path, mime_type, file_size, note,

             uploaded_by_id, patient_treatment_id, clinical_visit_note_id)

           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

        )

        .run(

          data.patientId,

          data.originalFileName,

          data.category,

          data.storedPath,

          data.mimeType ?? null,

          data.fileSize ?? null,

          data.note ?? null,

          data.uploadedById ?? null,

          data.patientTreatmentId ?? null,

          data.clinicalVisitNoteId ?? null,

        );

      const attachmentId = Number(result.lastInsertRowid);

      for (const tooth of data.teeth ?? []) {

        insertTooth.run(attachmentId, tooth);

      }

      return attachmentId;

    });



    const attachmentId = tx(input);

    return this.findById(attachmentId)!;

  }



  delete(id: number): boolean {

    const result = this.db.connection.prepare('DELETE FROM patient_attachments WHERE id = ?').run(id);

    return result.changes > 0;

  }

}


