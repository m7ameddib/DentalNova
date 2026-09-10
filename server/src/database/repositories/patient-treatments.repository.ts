import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel } from '../row-mapper.util';
import { PatientTreatment, TreatmentStatus } from '../../common/types';

export type TreatmentScope = 'SINGLE' | 'UPPER_JAW' | 'LOWER_JAW' | 'ALL_TEETH';

export interface CreatePatientTreatmentInput {
  patientId: number;
  treatmentTypeId: number;
  teeth: number[];
  baseAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
  status: TreatmentStatus;
  note?: string | null;
  doctorId?: number | null;
  treatmentDate?: string | null;
  treatmentScope?: TreatmentScope | null;
  followUp1Days?: number | null;
  followUp2Days?: number | null;
  followUp3Days?: number | null;
}

export interface UpdatePatientTreatmentInput {
  treatmentTypeId?: number;
  teeth?: number[];
  baseAmountCents?: number;
  discountCents?: number;
  finalAmountCents?: number;
  status?: TreatmentStatus;
  note?: string | null;
  treatmentDate?: string | null;
  treatmentScope?: TreatmentScope | null;
}

export interface PatientTreatmentWithDetails extends PatientTreatment {
  treatmentCode: string;
  treatmentAbbreviation: string;
  treatmentLabel: string;
  treatmentColor: string;
  doctorName: string | null;
  completedByName: string | null;
  teeth: number[];
}

export interface PatientTreatmentReportRow extends PatientTreatmentWithDetails {
  patientName: string;
  patientFileNumber: string;
}

const DETAILS_SELECT = `
  SELECT pt.*, tt.code as treatment_code, tt.abbreviation as treatment_abbreviation,
         tt.label as treatment_label, tt.color_hex as treatment_color,
         u.full_name as doctor_name, cu.full_name as completed_by_name,
         (SELECT GROUP_CONCAT(ptt.tooth_number) FROM patient_treatment_teeth ptt WHERE ptt.treatment_id = pt.id) as teeth_csv
  FROM patient_treatments pt
  JOIN treatment_types tt ON tt.id = pt.treatment_type_id
  LEFT JOIN users u ON u.id = pt.doctor_id
  LEFT JOIN users cu ON cu.id = pt.completed_by_id
`;

function mapDetailsRow(row: Record<string, unknown>): PatientTreatmentWithDetails {
  const { teeth_csv, ...rest } = row;
  const mapped = toCamel<PatientTreatmentWithDetails>(rest);
  mapped.teeth = teeth_csv
    ? String(teeth_csv)
        .split(',')
        .map((n) => Number(n))
        .sort((a, b) => a - b)
    : [];
  return mapped;
}

@Injectable()
export class PatientTreatmentsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): PatientTreatmentWithDetails | undefined {
    const row = this.db.connection
      .prepare(`${DETAILS_SELECT} WHERE pt.id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapDetailsRow(row) : undefined;
  }

  /** All treatment entries for a patient, joined with catalog + teeth, newest first. */
  findByPatient(patientId: number): PatientTreatmentWithDetails[] {
    const rows = this.db.connection
      .prepare(`${DETAILS_SELECT} WHERE pt.patient_id = ? ORDER BY pt.created_at DESC, pt.id DESC`)
      .all(patientId) as Record<string, unknown>[];
    return rows.map(mapDetailsRow);
  }

  create(input: CreatePatientTreatmentInput): PatientTreatmentWithDetails {
    const insertEntry = this.db.connection.prepare(
      `INSERT INTO patient_treatments
        (patient_id, treatment_type_id, tooth_number, price_cents, base_amount_cents,
         discount_cents, final_amount_cents, status, note, doctor_id,
         treatment_date, treatment_scope,
         follow_up_1_days, follow_up_2_days, follow_up_3_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertTooth = this.db.connection.prepare(
      `INSERT INTO patient_treatment_teeth (treatment_id, tooth_number) VALUES (?, ?)`,
    );

    const tx = this.db.connection.transaction((data: CreatePatientTreatmentInput) => {
      const singleTooth = data.teeth.length === 1 ? data.teeth[0] : null;
      const result = insertEntry.run(
        data.patientId,
        data.treatmentTypeId,
        singleTooth,
        data.finalAmountCents,
        data.baseAmountCents,
        data.discountCents,
        data.finalAmountCents,
        data.status,
        data.note ?? null,
        data.doctorId ?? null,
        data.treatmentDate ?? null,
        data.treatmentScope ?? null,
        data.followUp1Days ?? null,
        data.followUp2Days ?? null,
        data.followUp3Days ?? null,
      );
      const treatmentId = Number(result.lastInsertRowid);
      for (const tooth of data.teeth) {
        insertTooth.run(treatmentId, tooth);
      }
      return treatmentId;
    });

    const treatmentId = tx(input);
    return this.findById(treatmentId)!;
  }

  /** Deletes a treatment entry; its teeth rows cascade via the FK. Returns true if a row was removed. */
  delete(id: number): boolean {
    const result = this.db.connection.prepare(`DELETE FROM patient_treatments WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  /**
   * Updates ONLY the status of an existing treatment entry — price, discount,
   * final amount, date and teeth are left untouched (editable directly from
   * Treatment History, per the Patient Workspace status control).
   * When transitioning to COMPLETED, records completion date/user (once).
   */
  updateStatus(
    id: number,
    status: TreatmentStatus,
    completedById?: number | null,
  ): PatientTreatmentWithDetails | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const shouldSetCompletion =
      status === 'COMPLETED' && existing.status !== 'COMPLETED' && !existing.completedAt;

    if (shouldSetCompletion && completedById) {
      this.db.connection
        .prepare(
          `UPDATE patient_treatments SET status = ?, completed_at = datetime('now'),
           completed_by_id = ?, updated_at = datetime('now') WHERE id = ?`,
        )
        .run(status, completedById, id);
    } else {
      this.db.connection
        .prepare(`UPDATE patient_treatments SET status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(status, id);
    }
    return this.findById(id);
  }

  update(id: number, input: UpdatePatientTreatmentInput): PatientTreatmentWithDetails | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const deleteTeeth = this.db.connection.prepare(
      'DELETE FROM patient_treatment_teeth WHERE treatment_id = ?',
    );
    const insertTooth = this.db.connection.prepare(
      'INSERT INTO patient_treatment_teeth (treatment_id, tooth_number) VALUES (?, ?)',
    );

    const tx = this.db.connection.transaction((data: UpdatePatientTreatmentInput) => {
      const teeth = data.teeth ?? existing.teeth;
      const singleTooth = teeth.length === 1 ? teeth[0] : null;

      this.db.connection
        .prepare(
          `UPDATE patient_treatments SET
            treatment_type_id = COALESCE(?, treatment_type_id),
            tooth_number = ?,
            price_cents = COALESCE(?, price_cents),
            base_amount_cents = COALESCE(?, base_amount_cents),
            discount_cents = COALESCE(?, discount_cents),
            final_amount_cents = COALESCE(?, final_amount_cents),
            status = COALESCE(?, status),
            note = COALESCE(?, note),
            treatment_date = COALESCE(?, treatment_date),
            treatment_scope = COALESCE(?, treatment_scope),
            updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(
          data.treatmentTypeId ?? null,
          singleTooth,
          data.finalAmountCents ?? null,
          data.baseAmountCents ?? null,
          data.discountCents ?? null,
          data.finalAmountCents ?? null,
          data.status ?? null,
          data.note !== undefined ? data.note : null,
          data.treatmentDate ?? null,
          data.treatmentScope ?? null,
          id,
        );

      if (data.teeth) {
        deleteTeeth.run(id);
        for (const tooth of teeth) {
          insertTooth.run(id, tooth);
        }
      }
    });

    tx(input);
    return this.findById(id);
  }

  /** Treatment entries recorded within a date range, joined with the patient (Reports drill-down). */
  findForPeriodWithPatient(fromIso: string, toIso: string): PatientTreatmentReportRow[] {
    const rows = this.db.connection
      .prepare(
        `SELECT pt.*, tt.code as treatment_code, tt.abbreviation as treatment_abbreviation,
                tt.label as treatment_label, tt.color_hex as treatment_color,
                u.full_name as doctor_name,
                p.full_name as patient_name, p.file_number as patient_file_number,
                (SELECT GROUP_CONCAT(ptt.tooth_number) FROM patient_treatment_teeth ptt WHERE ptt.treatment_id = pt.id) as teeth_csv
         FROM patient_treatments pt
         JOIN treatment_types tt ON tt.id = pt.treatment_type_id
         JOIN patients p ON p.id = pt.patient_id
         LEFT JOIN users u ON u.id = pt.doctor_id
         WHERE date(pt.created_at) BETWEEN date(?) AND date(?)
         ORDER BY pt.created_at DESC, pt.id DESC`,
      )
      .all(fromIso, toIso) as Record<string, unknown>[];
    return rows.map(mapDetailsRow) as PatientTreatmentReportRow[];
  }

  /** Sum of COMPLETED treatment amounts — feeds the patient account total. */
  totalCostForPatient(patientId: number): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(final_amount_cents), 0) as total FROM patient_treatments WHERE patient_id = ? AND status = 'COMPLETED'`,
      )
      .get(patientId) as { total: number };
    return row.total;
  }

  /** Clinic-wide sum of final amounts across all patients (all time) — used for the Reports outstanding balance. */
  totalFinalAmountAll(): number {
    const row = this.db.connection
      .prepare(`SELECT COALESCE(SUM(final_amount_cents), 0) as total FROM patient_treatments WHERE status = 'COMPLETED'`)
      .get() as { total: number };
    return row.total;
  }

  /** Base/discount/final totals for entries recorded within a date range (Reports > Financial Summary). */
  sumForPeriod(fromIso: string, toIso: string): { baseCents: number; discountCents: number; finalCents: number } {
    const row = this.db.connection
      .prepare(
        `SELECT
           COALESCE(SUM(base_amount_cents), 0) as baseCents,
           COALESCE(SUM(discount_cents), 0) as discountCents,
           COALESCE(SUM(final_amount_cents), 0) as finalCents
         FROM patient_treatments
         WHERE date(created_at) BETWEEN date(?) AND date(?)
           AND status != 'VOID'`,
      )
      .get(fromIso, toIso) as { baseCents: number; discountCents: number; finalCents: number };
    return row;
  }
}
