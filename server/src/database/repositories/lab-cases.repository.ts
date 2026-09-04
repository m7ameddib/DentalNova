import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { addLocalDays, localTodayIso } from '../../common/local-date.util';
import {
  LabCaseDueAlert,
  LabCaseHistoryEntry,
  LabCaseStatus,
  LabCaseWithDetails,
} from '../../common/types';

export interface CreateLabCaseInput {
  patientId: number;
  patientTreatmentId?: number | null;
  labName: string;
  workTypeCode: string;
  workTypeCustom?: string | null;
  status?: LabCaseStatus;
  labCostCents?: number;
  sentDate?: string | null;
  expectedDeliveryDate?: string | null;
  receivedDate?: string | null;
  deliveredDate?: string | null;
  notes?: string | null;
  teeth: number[];
  createdById?: number | null;
}

export type UpdateLabCaseInput = Partial<Omit<CreateLabCaseInput, 'patientId' | 'createdById'>> & {
  teeth?: number[];
};

export type LabCaseListFilter =
  | 'active'
  | 'due_today'
  | 'overdue'
  | 'received'
  | 'delivered'
  | 'all';

const TERMINAL_STATUSES: LabCaseStatus[] = ['DELIVERED_TO_PATIENT', 'CANCELLED'];

const DETAILS_FROM = `
  FROM lab_cases lc
  JOIN patients p ON p.id = lc.patient_id
  LEFT JOIN patient_treatments pt ON pt.id = lc.patient_treatment_id
  LEFT JOIN treatment_types tt ON tt.id = pt.treatment_type_id
  LEFT JOIN lab_work_types wt ON wt.code = lc.work_type_code
`;

const DETAILS_SELECT = `
  SELECT lc.*,
    p.full_name as patient_name,
    p.file_number as patient_file_number,
    p.phone as patient_phone,
    COALESCE(wt.label, lc.work_type_code) as work_type_label,
    tt.label as treatment_label,
    (SELECT GROUP_CONCAT(ptt.tooth_number) FROM patient_treatment_teeth ptt WHERE ptt.treatment_id = pt.id) as treatment_teeth_csv,
    (SELECT GROUP_CONCAT(lct.tooth_number) FROM lab_case_teeth lct WHERE lct.lab_case_id = lc.id) as teeth_csv
  ${DETAILS_FROM}
`;

function computeDueAlert(expectedDeliveryDate: string | null, status: LabCaseStatus): LabCaseDueAlert {
  if (!expectedDeliveryDate || TERMINAL_STATUSES.includes(status)) return null;
  if (status === 'RECEIVED_FROM_LAB') return null;
  const today = localTodayIso();
  const tomorrow = addLocalDays(today, 1);
  if (expectedDeliveryDate < today) return 'OVERDUE';
  if (expectedDeliveryDate === today) return 'DUE_TODAY';
  if (expectedDeliveryDate === tomorrow) return 'DUE_TOMORROW';
  return null;
}

function mapDetailsRow(row: Record<string, unknown>): LabCaseWithDetails {
  const { teeth_csv, treatment_teeth_csv, ...rest } = row;
  const mapped = toCamel<LabCaseWithDetails>(rest);
  mapped.teeth = teeth_csv
    ? String(teeth_csv)
        .split(',')
        .map((n) => Number(n))
        .sort((a, b) => a - b)
    : [];
  mapped.treatmentTeeth = treatment_teeth_csv
    ? String(treatment_teeth_csv)
        .split(',')
        .map((n) => Number(n))
        .sort((a, b) => a - b)
    : [];
  mapped.dueAlert = computeDueAlert(mapped.expectedDeliveryDate, mapped.status);
  if (mapped.workTypeCode === 'OTHER' && mapped.workTypeCustom) {
    mapped.workTypeLabel = mapped.workTypeCustom;
  }
  return mapped;
}

@Injectable()
export class LabCasesRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): LabCaseWithDetails | undefined {
    const row = this.db.connection.prepare(`${DETAILS_SELECT} WHERE lc.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapDetailsRow(row) : undefined;
  }

  findByPatient(patientId: number, activeOnly = false): LabCaseWithDetails[] {
    let sql = `${DETAILS_SELECT} WHERE lc.patient_id = ? AND p.archived_at IS NULL`;
    if (activeOnly) {
      sql += ` AND lc.status NOT IN ('DELIVERED_TO_PATIENT', 'CANCELLED')`;
    }
    sql += ' ORDER BY lc.expected_delivery_date ASC, lc.id DESC';
    const rows = this.db.connection.prepare(sql).all(patientId) as Record<string, unknown>[];
    return rows.map(mapDetailsRow);
  }

  list(filter: LabCaseListFilter = 'active', search?: string): LabCaseWithDetails[] {
    const params: unknown[] = [];
    let sql = `${DETAILS_SELECT} WHERE p.archived_at IS NULL`;

    const today = localTodayIso();

    switch (filter) {
      case 'active':
        sql += ` AND lc.status NOT IN ('DELIVERED_TO_PATIENT', 'CANCELLED')`;
        break;
      case 'due_today':
        sql += ` AND lc.expected_delivery_date = ? AND lc.status NOT IN ('DELIVERED_TO_PATIENT', 'CANCELLED', 'RECEIVED_FROM_LAB')`;
        params.push(today);
        break;
      case 'overdue':
        sql += ` AND lc.expected_delivery_date < ? AND lc.status NOT IN ('DELIVERED_TO_PATIENT', 'CANCELLED', 'RECEIVED_FROM_LAB')`;
        params.push(today);
        break;
      case 'received':
        sql += ` AND lc.status = 'RECEIVED_FROM_LAB'`;
        break;
      case 'delivered':
        sql += ` AND lc.status = 'DELIVERED_TO_PATIENT'`;
        break;
      case 'all':
        break;
    }

    if (search?.trim()) {
      const like = `%${search.trim()}%`;
      sql += ` AND (
        p.full_name LIKE ? OR p.phone LIKE ? OR p.file_number LIKE ?
        OR lc.lab_name LIKE ? OR lc.work_type_code LIKE ? OR lc.work_type_custom LIKE ?
        OR wt.label LIKE ?
        OR EXISTS (SELECT 1 FROM lab_case_teeth t WHERE t.lab_case_id = lc.id AND CAST(t.tooth_number AS TEXT) LIKE ?)
      )`;
      params.push(like, like, like, like, like, like, like, like);
    }

    sql +=
      ' ORDER BY CASE WHEN lc.expected_delivery_date IS NULL THEN 1 ELSE 0 END, lc.expected_delivery_date ASC, lc.id DESC';
    const rows = this.db.connection.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(mapDetailsRow);
  }

  summaryForDate(dateIso: string): { dueToday: number; overdue: number } {
    const dueTodayRow = this.db.connection
      .prepare(
        `SELECT COUNT(*) as c FROM lab_cases
         WHERE expected_delivery_date = ?
           AND status NOT IN ('DELIVERED_TO_PATIENT', 'CANCELLED', 'RECEIVED_FROM_LAB')`,
      )
      .get(dateIso) as { c: number };
    const overdueRow = this.db.connection
      .prepare(
        `SELECT COUNT(*) as c FROM lab_cases
         WHERE expected_delivery_date < ?
           AND status NOT IN ('DELIVERED_TO_PATIENT', 'CANCELLED', 'RECEIVED_FROM_LAB')`,
      )
      .get(dateIso) as { c: number };
    return { dueToday: dueTodayRow.c, overdue: overdueRow.c };
  }

  findDueForDailyReport(dateIso: string): LabCaseWithDetails[] {
    return this.list('all').filter(
      (c) =>
        c.expectedDeliveryDate &&
        c.expectedDeliveryDate <= dateIso &&
        !TERMINAL_STATUSES.includes(c.status) &&
        c.status !== 'RECEIVED_FROM_LAB',
    );
  }

  create(input: CreateLabCaseInput): LabCaseWithDetails {
    const status = input.status ?? 'PENDING';
    const result = this.db.connection
      .prepare(
        `INSERT INTO lab_cases
          (patient_id, patient_treatment_id, lab_name, work_type_code, work_type_custom, status,
           lab_cost_cents, sent_date, expected_delivery_date, received_date, delivered_date, notes, created_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.patientId,
        input.patientTreatmentId ?? null,
        input.labName.trim(),
        input.workTypeCode,
        input.workTypeCustom?.trim() ?? null,
        status,
        input.labCostCents ?? 0,
        input.sentDate ?? null,
        input.expectedDeliveryDate ?? null,
        input.receivedDate ?? null,
        input.deliveredDate ?? null,
        input.notes?.trim() ?? null,
        input.createdById ?? null,
      );
    const id = Number(result.lastInsertRowid);
    this.replaceTeeth(id, input.teeth);
    return this.findById(id)!;
  }

  update(id: number, input: UpdateLabCaseInput): LabCaseWithDetails | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const labName = input.labName?.trim() ?? existing.labName;
    const workTypeCode = input.workTypeCode ?? existing.workTypeCode;
    const workTypeCustom =
      input.workTypeCustom !== undefined ? input.workTypeCustom?.trim() || null : existing.workTypeCustom;
    const status = input.status ?? existing.status;
    const labCostCents = input.labCostCents !== undefined ? input.labCostCents : existing.labCostCents;
    const sentDate = input.sentDate !== undefined ? input.sentDate : existing.sentDate;
    const expectedDeliveryDate =
      input.expectedDeliveryDate !== undefined ? input.expectedDeliveryDate : existing.expectedDeliveryDate;
    const receivedDate = input.receivedDate !== undefined ? input.receivedDate : existing.receivedDate;
    const deliveredDate = input.deliveredDate !== undefined ? input.deliveredDate : existing.deliveredDate;
    const notes = input.notes !== undefined ? input.notes?.trim() || null : existing.notes;
    const patientTreatmentId =
      input.patientTreatmentId !== undefined ? input.patientTreatmentId : existing.patientTreatmentId;

    this.db.connection
      .prepare(
        `UPDATE lab_cases SET
          patient_treatment_id = ?, lab_name = ?, work_type_code = ?, work_type_custom = ?, status = ?,
          lab_cost_cents = ?, sent_date = ?, expected_delivery_date = ?, received_date = ?, delivered_date = ?, notes = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        patientTreatmentId,
        labName,
        workTypeCode,
        workTypeCustom,
        status,
        labCostCents,
        sentDate,
        expectedDeliveryDate,
        receivedDate,
        deliveredDate,
        notes,
        id,
      );

    if (input.teeth) {
      this.replaceTeeth(id, input.teeth);
    }
    return this.findById(id);
  }

  private replaceTeeth(labCaseId: number, teeth: number[]): void {
    this.db.connection.prepare('DELETE FROM lab_case_teeth WHERE lab_case_id = ?').run(labCaseId);
    const insert = this.db.connection.prepare(
      'INSERT INTO lab_case_teeth (lab_case_id, tooth_number) VALUES (?, ?)',
    );
    for (const tooth of [...new Set(teeth)].sort((a, b) => a - b)) {
      insert.run(labCaseId, tooth);
    }
  }

  insertHistory(entry: {
    labCaseId: number;
    patientId: number;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    note?: string | null;
    performedById?: number | null;
  }): void {
    this.db.connection
      .prepare(
        `INSERT INTO lab_case_history
          (lab_case_id, patient_id, action, from_status, to_status, note, performed_by_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.labCaseId,
        entry.patientId,
        entry.action,
        entry.fromStatus ?? null,
        entry.toStatus ?? null,
        entry.note?.trim() ?? null,
        entry.performedById ?? null,
      );
  }

  findHistory(labCaseId: number): LabCaseHistoryEntry[] {
    const rows = this.db.connection
      .prepare(
        `SELECT h.*, u.full_name as performed_by_name
         FROM lab_case_history h
         LEFT JOIN users u ON u.id = h.performed_by_id
         WHERE h.lab_case_id = ?
         ORDER BY h.created_at DESC, h.id DESC`,
      )
      .all(labCaseId) as Record<string, unknown>[];
    return toCamelList<LabCaseHistoryEntry>(rows);
  }

  /** All lab cases for a laboratory (matched by lab_names.name, case-insensitive). */
  findByLabName(labName: string, fromDate?: string, toDate?: string): LabCaseWithDetails[] {
    let sql = `${DETAILS_SELECT}
      WHERE p.archived_at IS NULL
        AND LOWER(TRIM(lc.lab_name)) = LOWER(TRIM(?))
        AND lc.status != 'CANCELLED'`;
    const params: unknown[] = [labName];
    if (fromDate) {
      sql += ` AND COALESCE(lc.sent_date, date(lc.created_at)) >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND COALESCE(lc.sent_date, date(lc.created_at)) <= ?`;
      params.push(toDate);
    }
    sql += ' ORDER BY COALESCE(lc.sent_date, date(lc.created_at)) DESC, lc.id DESC';
    const rows = this.db.connection.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(mapDetailsRow);
  }

  totalCostForLab(labName: string, fromDate?: string, toDate?: string): number {
    let sql = `SELECT COALESCE(SUM(lc.lab_cost_cents), 0) as total
      FROM lab_cases lc
      WHERE LOWER(TRIM(lc.lab_name)) = LOWER(TRIM(?))
        AND lc.status != 'CANCELLED'`;
    const params: unknown[] = [labName];
    if (fromDate) {
      sql += ` AND COALESCE(lc.sent_date, date(lc.created_at)) >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND COALESCE(lc.sent_date, date(lc.created_at)) <= ?`;
      params.push(toDate);
    }
    const row = this.db.connection.prepare(sql).get(...params) as { total: number };
    return row.total;
  }

  /** Sum of active case-level payments for all cases belonging to this lab. */
  totalCasePaymentsForLab(labName: string, fromDate?: string, toDate?: string): number {
    let sql = `SELECT COALESCE(SUM(lp.amount_cents), 0) as total
      FROM lab_case_payments lp
      JOIN lab_cases lc ON lc.id = lp.lab_case_id
      WHERE LOWER(TRIM(lc.lab_name)) = LOWER(TRIM(?))
        AND COALESCE(lp.status, 'ACTIVE') != 'VOID'
        AND lc.status != 'CANCELLED'`;
    const params: unknown[] = [labName];
    if (fromDate) {
      sql += ' AND lp.payment_date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND lp.payment_date <= ?';
      params.push(toDate);
    }
    const row = this.db.connection.prepare(sql).get(...params) as { total: number };
    return row.total;
  }

  findCasePaymentsForLab(
    labName: string,
    fromDate?: string,
    toDate?: string,
  ): Array<{
    id: number;
    labCaseId: number;
    amountCents: number;
    paymentMethod: string;
    paymentDate: string;
    note: string | null;
    status: string;
    voidReason: string | null;
    recordedByName: string | null;
    createdAt: string;
    patientName: string;
    patientFileNumber: string;
    workTypeLabel: string;
  }> {
    let sql = `SELECT lp.id, lp.lab_case_id, lp.amount_cents, lp.payment_method, lp.payment_date,
                      lp.note, lp.status, lp.void_reason, lp.created_at,
                      u.full_name as recorded_by_name,
                      p.full_name as patient_name, p.file_number as patient_file_number,
                      COALESCE(wt.label, lc.work_type_code) as work_type_label
               FROM lab_case_payments lp
               JOIN lab_cases lc ON lc.id = lp.lab_case_id
               JOIN patients p ON p.id = lc.patient_id
               LEFT JOIN lab_work_types wt ON wt.code = lc.work_type_code
               LEFT JOIN users u ON u.id = lp.recorded_by_id
               WHERE LOWER(TRIM(lc.lab_name)) = LOWER(TRIM(?))
                 AND lc.status != 'CANCELLED'`;
    const params: unknown[] = [labName];
    if (fromDate) {
      sql += ' AND lp.payment_date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND lp.payment_date <= ?';
      params.push(toDate);
    }
    sql += ' ORDER BY lp.payment_date DESC, lp.id DESC';
    const rows = this.db.connection.prepare(sql).all(...params) as Record<string, unknown>[];
    return toCamelList(rows) as Array<{
      id: number;
      labCaseId: number;
      amountCents: number;
      paymentMethod: string;
      paymentDate: string;
      note: string | null;
      status: string;
      voidReason: string | null;
      recordedByName: string | null;
      createdAt: string;
      patientName: string;
      patientFileNumber: string;
      workTypeLabel: string;
    }>;
  }
}
