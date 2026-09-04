import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { Payment, PaymentMethod } from '../../common/types';

export interface CreatePaymentInput {
  patientId: number;
  amountCents: number;
  method: PaymentMethod;
  date: string;
  note?: string | null;
  recordedById?: number | null;
}

/** Exclude voided payments from financial totals. */
export const ACTIVE_PAYMENT_SQL = `COALESCE(p.status, 'ACTIVE') != 'VOID'`;

const WITH_METHOD_LABEL = `
  SELECT p.*, COALESCE(pm.label, p.method) as method_label, vu.full_name as voided_by_name
  FROM payments p
  LEFT JOIN payment_methods pm ON pm.code = p.method
  LEFT JOIN users vu ON vu.id = p.voided_by_id
`;

@Injectable()
export class PaymentsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): Payment | undefined {
    const row = this.db.connection.prepare(`${WITH_METHOD_LABEL} WHERE p.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<Payment>(row) : undefined;
  }

  findByPatient(patientId: number, limit = 100): Payment[] {
    const rows = this.db.connection
      .prepare(`${WITH_METHOD_LABEL} WHERE p.patient_id = ? ORDER BY p.date DESC, p.id DESC LIMIT ?`)
      .all(patientId, limit) as Record<string, unknown>[];
    return toCamelList<Payment>(rows);
  }

  /** @deprecated Payments must be voided, not deleted. */
  delete(id: number): boolean {
    const result = this.db.connection.prepare('DELETE FROM payments WHERE id = ?').run(id);
    return result.changes > 0;
  }

  void(id: number, voidedById: number, reason: string): Payment | undefined {
    const result = this.db.connection
      .prepare(
        `UPDATE payments SET status = 'VOID', voided_at = datetime('now'), voided_by_id = ?, void_reason = ?
         WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`,
      )
      .run(voidedById, reason, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }

  /** Clinic-wide sum of active payments — used for the Reports outstanding balance. */
  totalPaidAll(): number {
    const row = this.db.connection
      .prepare(`SELECT COALESCE(SUM(amount_cents), 0) as total FROM payments p WHERE ${ACTIVE_PAYMENT_SQL}`)
      .get() as { total: number };
    return row.total;
  }

  /** Sum of active payments recorded within a date range (Reports > Financial Summary). */
  totalForPeriod(fromIso: string, toIso: string): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as total FROM payments p
         WHERE ${ACTIVE_PAYMENT_SQL} AND date(p.date) BETWEEN date(?) AND date(?)`,
      )
      .get(fromIso, toIso) as { total: number };
    return row.total;
  }

  /** Payments recorded within a date range, joined with the patient (Reports > Collected Payments drill-down). */
  findForPeriodWithPatient(fromIso: string, toIso: string): (Payment & { patientName: string; patientFileNumber: string })[] {
    const rows = this.db.connection
      .prepare(
        `SELECT p.*, COALESCE(pm.label, p.method) as method_label, vu.full_name as voided_by_name,
                pat.full_name as patient_name, pat.file_number as patient_file_number
         FROM payments p
         LEFT JOIN payment_methods pm ON pm.code = p.method
         LEFT JOIN users vu ON vu.id = p.voided_by_id
         JOIN patients pat ON pat.id = p.patient_id
         WHERE date(p.date) BETWEEN date(?) AND date(?)
         ORDER BY p.date DESC, p.id DESC`,
      )
      .all(fromIso, toIso) as Record<string, unknown>[];
    return toCamelList(rows);
  }

  totalPaidForPatient(patientId: number): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as total FROM payments p
         WHERE p.patient_id = ? AND ${ACTIVE_PAYMENT_SQL}`,
      )
      .get(patientId) as { total: number };
    return row.total;
  }

  create(input: CreatePaymentInput): Payment {
    const result = this.db.connection
      .prepare(
        `INSERT INTO payments (patient_id, amount_cents, method, date, note, recorded_by_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      )
      .run(
        input.patientId,
        input.amountCents,
        input.method,
        input.date,
        input.note ?? null,
        input.recordedById ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }
}
