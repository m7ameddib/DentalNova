import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { AccountDiscount } from '../../common/types';

export interface CreateAccountDiscountInput {
  patientId: number;
  amountCents: number;
  date: string;
  note?: string | null;
  recordedById?: number | null;
}

export const ACTIVE_ACCOUNT_DISCOUNT_SQL = `COALESCE(ad.status, 'ACTIVE') != 'VOID'`;

const WITH_VOID_USER = `
  SELECT ad.*, vu.full_name as voided_by_name
  FROM account_discounts ad
  LEFT JOIN users vu ON vu.id = ad.voided_by_id
`;

@Injectable()
export class AccountDiscountsRepository {
  constructor(private readonly db: DatabaseService) {}

  findById(id: number): AccountDiscount | undefined {
    const row = this.db.connection.prepare(`${WITH_VOID_USER} WHERE ad.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<AccountDiscount>(row) : undefined;
  }

  findByPatient(patientId: number, limit = 100): AccountDiscount[] {
    const rows = this.db.connection
      .prepare(`${WITH_VOID_USER} WHERE ad.patient_id = ? ORDER BY ad.date DESC, ad.id DESC LIMIT ?`)
      .all(patientId, limit) as Record<string, unknown>[];
    return toCamelList<AccountDiscount>(rows);
  }

  totalForPatient(patientId: number): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as total FROM account_discounts ad
         WHERE ad.patient_id = ? AND ${ACTIVE_ACCOUNT_DISCOUNT_SQL}`,
      )
      .get(patientId) as { total: number };
    return row.total;
  }

  totalAll(): number {
    const row = this.db.connection
      .prepare(
        `SELECT COALESCE(SUM(ad.amount_cents), 0) as total FROM account_discounts ad
         WHERE ${ACTIVE_ACCOUNT_DISCOUNT_SQL}`,
      )
      .get() as { total: number };
    return row.total;
  }

  void(id: number, voidedById: number, reason: string): AccountDiscount | undefined {
    const result = this.db.connection
      .prepare(
        `UPDATE account_discounts SET status = 'VOID', voided_at = datetime('now'), voided_by_id = ?, void_reason = ?, updated_at = datetime('now')
         WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`,
      )
      .run(voidedById, reason, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }

  create(input: CreateAccountDiscountInput): AccountDiscount {
    const result = this.db.connection
      .prepare(
        `INSERT INTO account_discounts (patient_id, amount_cents, date, note, recorded_by_id, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      )
      .run(
        input.patientId,
        input.amountCents,
        input.date,
        input.note ?? null,
        input.recordedById ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }
}
