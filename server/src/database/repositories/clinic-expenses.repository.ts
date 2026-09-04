import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { ClinicExpense } from '../../common/types';

export interface CreateClinicExpenseInput {
  date: string;
  amountCents: number;
  category: string;
  expenseCategoryId?: number | null;
  paymentMethod: string;
  paidTo?: string | null;
  note?: string | null;
  createdById?: number | null;
  sourceLabPaymentId?: number | null;
}

export interface UpdateClinicExpenseInput {
  date?: string;
  amountCents?: number;
  category?: string;
  expenseCategoryId?: number | null;
  paymentMethod?: string;
  paidTo?: string | null;
  note?: string | null;
}

/** Exclude voided expenses from financial totals. */
export const ACTIVE_EXPENSE_SQL = `COALESCE(e.status, 'ACTIVE') != 'VOID'`;

@Injectable()
export class ClinicExpensesRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): ClinicExpense | undefined {
    const row = this.db.connection.prepare('SELECT * FROM clinic_expenses WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<ClinicExpense>(row) : undefined;
  }

  findByLabPaymentId(labPaymentId: number): ClinicExpense | undefined {
    const row = this.db.connection
      .prepare(`SELECT * FROM clinic_expenses WHERE source_lab_payment_id = ?`)
      .get(labPaymentId) as Record<string, unknown> | undefined;
    return row ? toCamel<ClinicExpense>(row) : undefined;
  }

  findForPeriod(fromIso: string, toIso: string): ClinicExpense[] {
    const rows = this.db.connection
      .prepare(
        `SELECT * FROM clinic_expenses e
         WHERE date(e.date) BETWEEN date(?) AND date(?)
         ORDER BY e.date DESC, e.id DESC`,
      )
      .all(fromIso, toIso) as Record<string, unknown>[];
    return toCamelList<ClinicExpense>(rows);
  }

  totalForPeriod(fromIso: string, toIso: string): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(e.amount_cents), 0) as total FROM clinic_expenses e
         WHERE ${ACTIVE_EXPENSE_SQL} AND date(e.date) BETWEEN date(?) AND date(?)`,
      )
      .get(fromIso, toIso) as { total: number };
    return row.total;
  }

  create(input: CreateClinicExpenseInput): ClinicExpense {
    const result = this.db.connection
      .prepare(
        `INSERT INTO clinic_expenses
          (date, amount_cents, category, expense_category_id, payment_method, paid_to, note, created_by_id, source_lab_payment_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      )
      .run(
        input.date,
        input.amountCents,
        input.category,
        input.expenseCategoryId ?? null,
        input.paymentMethod,
        input.paidTo ?? null,
        input.note ?? null,
        input.createdById ?? null,
        input.sourceLabPaymentId ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  void(id: number, voidedById: number, reason: string): ClinicExpense | undefined {
    const result = this.db.connection
      .prepare(
        `UPDATE clinic_expenses SET status = 'VOID', voided_at = datetime('now'),
         voided_by_id = ?, void_reason = ? WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`,
      )
      .run(voidedById, reason, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }

  update(id: number, input: UpdateClinicExpenseInput): ClinicExpense | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    this.db.connection
      .prepare(
        `UPDATE clinic_expenses SET
          date = COALESCE(?, date),
          amount_cents = COALESCE(?, amount_cents),
          category = COALESCE(?, category),
          expense_category_id = COALESCE(?, expense_category_id),
          payment_method = COALESCE(?, payment_method),
          paid_to = COALESCE(?, paid_to),
          note = COALESCE(?, note),
          updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        input.date ?? null,
        input.amountCents ?? null,
        input.category ?? null,
        input.expenseCategoryId ?? null,
        input.paymentMethod ?? null,
        input.paidTo !== undefined ? input.paidTo : null,
        input.note !== undefined ? input.note : null,
        id,
      );
    return this.findById(id);
  }

  /** @deprecated Expenses should be voided, not deleted. */
  delete(id: number): boolean {
    const result = this.db.connection.prepare('DELETE FROM clinic_expenses WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
