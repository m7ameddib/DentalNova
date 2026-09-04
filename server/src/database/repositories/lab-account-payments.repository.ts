import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { LabAccountPayment } from '../../common/types';

export interface CreateLabAccountPaymentInput {
  labNameId: number;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  note?: string | null;
  expenseId: number;
  recordedById?: number | null;
}

export interface UpdateLabAccountPaymentInput {
  amountCents?: number;
  paymentMethod?: string;
  paymentDate?: string;
  note?: string | null;
}

@Injectable()
export class LabAccountPaymentsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): LabAccountPayment | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT lp.*, u.full_name as recorded_by_name, vu.full_name as voided_by_name
         FROM lab_account_payments lp
         LEFT JOIN users u ON u.id = lp.recorded_by_id
         LEFT JOIN users vu ON vu.id = lp.voided_by_id
         WHERE lp.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<LabAccountPayment>(row) : undefined;
  }

  findByLab(labNameId: number, fromDate?: string, toDate?: string): LabAccountPayment[] {
    let sql = `SELECT lp.*, u.full_name as recorded_by_name, vu.full_name as voided_by_name
               FROM lab_account_payments lp
               LEFT JOIN users u ON u.id = lp.recorded_by_id
               LEFT JOIN users vu ON vu.id = lp.voided_by_id
               WHERE lp.lab_name_id = ?`;
    const params: unknown[] = [labNameId];
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
    return toCamelList<LabAccountPayment>(rows);
  }

  totalPaidForLab(labNameId: number, fromDate?: string, toDate?: string): number {
    let sql = `SELECT COALESCE(SUM(amount_cents), 0) as total FROM lab_account_payments
               WHERE lab_name_id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`;
    const params: unknown[] = [labNameId];
    if (fromDate) {
      sql += ' AND payment_date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      sql += ' AND payment_date <= ?';
      params.push(toDate);
    }
    const row = this.db.connection.prepare(sql).get(...params) as { total: number };
    return row.total;
  }

  create(input: CreateLabAccountPaymentInput): LabAccountPayment {
    const result = this.db.connection
      .prepare(
        `INSERT INTO lab_account_payments
          (lab_name_id, amount_cents, payment_method, payment_date, note, expense_id, recorded_by_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      )
      .run(
        input.labNameId,
        input.amountCents,
        input.paymentMethod,
        input.paymentDate,
        input.note ?? null,
        input.expenseId,
        input.recordedById ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdateLabAccountPaymentInput): LabAccountPayment | undefined {
    const existing = this.findById(id);
    if (!existing || existing.status === 'VOID') return undefined;

    const amountCents = input.amountCents ?? existing.amountCents;
    const paymentMethod = input.paymentMethod ?? existing.paymentMethod;
    const paymentDate = input.paymentDate ?? existing.paymentDate;
    const note = input.note !== undefined ? input.note : existing.note;

    const result = this.db.connection
      .prepare(
        `UPDATE lab_account_payments SET
          amount_cents = ?, payment_method = ?, payment_date = ?, note = ?,
          updated_at = datetime('now')
         WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`,
      )
      .run(amountCents, paymentMethod, paymentDate, note, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }

  void(id: number, voidedById: number, reason: string): LabAccountPayment | undefined {
    const result = this.db.connection
      .prepare(
        `UPDATE lab_account_payments SET status = 'VOID', voided_at = datetime('now'),
         voided_by_id = ?, void_reason = ?, updated_at = datetime('now')
         WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`,
      )
      .run(voidedById, reason, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }
}
