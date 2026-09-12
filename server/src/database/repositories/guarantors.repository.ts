import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';

export interface Guarantor {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface GuarantorTreatmentPrice {
  guarantorId: number;
  treatmentTypeId: number;
  priceCents: number;
}

@Injectable()
export class GuarantorsRepository {
  constructor(private readonly db: DatabaseService) {}

  findAll(): Guarantor[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM guarantors ORDER BY sort_order, name')
      .all() as Record<string, unknown>[];
    return toCamelList<Guarantor>(rows);
  }

  findAllActive(): Guarantor[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM guarantors WHERE is_active = 1 ORDER BY sort_order, name')
      .all() as Record<string, unknown>[];
    return toCamelList<Guarantor>(rows);
  }

  findById(id: number): Guarantor | undefined {
    const row = this.db.connection.prepare('SELECT * FROM guarantors WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<Guarantor>(row) : undefined;
  }

  create(name: string): Guarantor {
    const maxOrder = this.db.connection
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM guarantors')
      .get() as { m: number };
    const result = this.db.connection
      .prepare('INSERT INTO guarantors (name, sort_order) VALUES (?, ?)')
      .run(name.trim(), maxOrder.m + 1);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: { name?: string; isActive?: boolean; sortOrder?: number }): Guarantor | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    this.db.connection
      .prepare('UPDATE guarantors SET name = ?, is_active = ?, sort_order = ? WHERE id = ?')
      .run(
        input.name?.trim() ?? existing.name,
        (input.isActive ?? existing.isActive) ? 1 : 0,
        input.sortOrder ?? existing.sortOrder,
        id,
      );
    return this.findById(id);
  }

  listPrices(guarantorId: number): GuarantorTreatmentPrice[] {
    const rows = this.db.connection
      .prepare(
        'SELECT guarantor_id, treatment_type_id, price_cents FROM guarantor_treatment_prices WHERE guarantor_id = ?',
      )
      .all(guarantorId) as Record<string, unknown>[];
    return toCamelList<GuarantorTreatmentPrice>(rows);
  }

  upsertPrice(guarantorId: number, treatmentTypeId: number, priceCents: number): void {
    this.db.connection
      .prepare(
        `INSERT INTO guarantor_treatment_prices (guarantor_id, treatment_type_id, price_cents)
         VALUES (?, ?, ?)
         ON CONFLICT(guarantor_id, treatment_type_id) DO UPDATE SET price_cents = excluded.price_cents`,
      )
      .run(guarantorId, treatmentTypeId, priceCents);
  }

  deletePrice(guarantorId: number, treatmentTypeId: number): void {
    this.db.connection
      .prepare('DELETE FROM guarantor_treatment_prices WHERE guarantor_id = ? AND treatment_type_id = ?')
      .run(guarantorId, treatmentTypeId);
  }

  delete(id: number): boolean {
    const existing = this.findById(id);
    if (!existing) return false;
    const tx = this.db.connection.transaction(() => {
      this.db.connection.prepare('UPDATE patients SET guarantor_id = NULL WHERE guarantor_id = ?').run(id);
      this.db.connection.prepare('DELETE FROM guarantor_treatment_prices WHERE guarantor_id = ?').run(id);
      return this.db.connection.prepare('DELETE FROM guarantors WHERE id = ?').run(id);
    });
    return tx().changes > 0;
  }

  findPrice(guarantorId: number, treatmentTypeId: number): number | undefined {
    const row = this.db.connection
      .prepare(
        'SELECT price_cents FROM guarantor_treatment_prices WHERE guarantor_id = ? AND treatment_type_id = ?',
      )
      .get(guarantorId, treatmentTypeId) as { price_cents: number } | undefined;
    return row?.price_cents;
  }
}
