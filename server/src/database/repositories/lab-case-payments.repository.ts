import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { LabCasePayment, LabPaymentStatus } from '../../common/types';

export interface CreateLabCasePaymentInput {
  labCaseId: number;
  amountCents: number;
  paymentMethod: string;
  paymentDate: string;
  note?: string | null;
  expenseId: number;
  recordedById?: number | null;
}

@Injectable()
export class LabCasePaymentsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): LabCasePayment | undefined {
    const row = this.db.connection
      .prepare(
        `SELECT lp.*, u.full_name as recorded_by_name, vu.full_name as voided_by_name
         FROM lab_case_payments lp
         LEFT JOIN users u ON u.id = lp.recorded_by_id
         LEFT JOIN users vu ON vu.id = lp.voided_by_id
         WHERE lp.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<LabCasePayment>(row) : undefined;
  }

  findByLabCase(labCaseId: number): LabCasePayment[] {
    const rows = this.db.connection
      .prepare(
        `SELECT lp.*, u.full_name as recorded_by_name, vu.full_name as voided_by_name
         FROM lab_case_payments lp
         LEFT JOIN users u ON u.id = lp.recorded_by_id
         LEFT JOIN users vu ON vu.id = lp.voided_by_id
         WHERE lp.lab_case_id = ?
         ORDER BY lp.payment_date DESC, lp.id DESC`,
      )
      .all(labCaseId) as Record<string, unknown>[];
    return toCamelList<LabCasePayment>(rows);
  }

  totalPaidForCase(labCaseId: number): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as total FROM lab_case_payments
         WHERE lab_case_id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`,
      )
      .get(labCaseId) as { total: number };
    return row.total;
  }

  create(input: CreateLabCasePaymentInput): LabCasePayment {
    const result = this.db.connection
      .prepare(
        `INSERT INTO lab_case_payments
          (lab_case_id, amount_cents, payment_method, payment_date, note, expense_id, recorded_by_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      )
      .run(
        input.labCaseId,
        input.amountCents,
        input.paymentMethod,
        input.paymentDate,
        input.note ?? null,
        input.expenseId,
        input.recordedById ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  void(id: number, voidedById: number, reason: string): LabCasePayment | undefined {
    const result = this.db.connection
      .prepare(
        `UPDATE lab_case_payments SET status = 'VOID', voided_at = datetime('now'),
         voided_by_id = ?, void_reason = ? WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`,
      )
      .run(voidedById, reason, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }
}

export function computeLabPaymentStatus(
  labCostCents: number,
  totalPaidCents: number,
): LabPaymentStatus {
  if (labCostCents <= 0) {
    return totalPaidCents > 0 ? 'PAID' : 'UNPAID';
  }
  if (totalPaidCents <= 0) return 'UNPAID';
  if (totalPaidCents >= labCostCents) return 'PAID';
  return 'PARTIALLY_PAID';
}
