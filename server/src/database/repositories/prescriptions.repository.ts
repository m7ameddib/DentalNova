import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { PrescriptionItem, PrescriptionType, PrescriptionWithItems } from '../../common/types';

export interface CreatePrescriptionItemInput {
  medicineName: string;
  dose?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

export interface CreatePrescriptionInput {
  patientId: number;
  doctorId: number | null;
  type?: PrescriptionType;
  items: CreatePrescriptionItemInput[];
}

const DETAILS_SELECT = `
  SELECT p.*, u.full_name as doctor_name
  FROM prescriptions p
  LEFT JOIN users u ON u.id = p.doctor_id
`;

@Injectable()
export class PrescriptionsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): PrescriptionWithItems | undefined {
    const row = this.db.connection.prepare(`${DETAILS_SELECT} WHERE p.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.withItems(toCamel<PrescriptionWithItems>(row)) : undefined;
  }

  /** All prescriptions for a patient, newest first, each with its medicine items. */
  findByPatient(patientId: number): PrescriptionWithItems[] {
    const rows = this.db.connection
      .prepare(`${DETAILS_SELECT} WHERE p.patient_id = ? ORDER BY p.created_at DESC, p.id DESC`)
      .all(patientId) as Record<string, unknown>[];
    return toCamelList<PrescriptionWithItems>(rows).map((prescription) => this.withItems(prescription));
  }

  create(input: CreatePrescriptionInput): PrescriptionWithItems {
    const insertPrescription = this.db.connection.prepare(
      `INSERT INTO prescriptions (patient_id, doctor_id, type) VALUES (?, ?, ?)`,
    );
    const insertItem = this.db.connection.prepare(
      `INSERT INTO prescription_items
        (prescription_id, medicine_name, dose, frequency, duration, instructions, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const createTx = this.db.connection.transaction((data: CreatePrescriptionInput) => {
      const result = insertPrescription.run(data.patientId, data.doctorId ?? null, data.type ?? 'MEDICATION');
      const prescriptionId = Number(result.lastInsertRowid);
      data.items.forEach((item, index) => {
        insertItem.run(
          prescriptionId,
          item.medicineName,
          item.dose ?? null,
          item.frequency ?? null,
          item.duration ?? null,
          item.instructions ?? null,
          index,
        );
      });
      return prescriptionId;
    });

    const prescriptionId = createTx(input);
    return this.findById(prescriptionId)!;
  }

  delete(id: number): boolean {
    const result = this.db.connection.prepare('DELETE FROM prescriptions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private withItems(prescription: PrescriptionWithItems): PrescriptionWithItems {
    const rows = this.db.connection
      .prepare('SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY sort_order ASC, id ASC')
      .all(prescription.id) as Record<string, unknown>[];
    prescription.items = toCamelList<PrescriptionItem>(rows);
    return prescription;
  }
}
