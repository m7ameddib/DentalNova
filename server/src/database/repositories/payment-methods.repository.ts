import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { PaymentMethodEntity } from '../../common/types';

export interface CreatePaymentMethodInput {
  code: string;
  label: string;
  sortOrder?: number;
}

export interface UpdatePaymentMethodInput {
  label?: string;
  isActive?: boolean;
}

@Injectable()
export class PaymentMethodsRepository {
  constructor(private readonly db: DatabaseService) {}

  findAll(): PaymentMethodEntity[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM payment_methods ORDER BY sort_order, id')
      .all() as Record<string, unknown>[];
    return toCamelList<PaymentMethodEntity>(rows);
  }

  findAllActive(): PaymentMethodEntity[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order, id')
      .all() as Record<string, unknown>[];
    return toCamelList<PaymentMethodEntity>(rows);
  }

  findById(id: number): PaymentMethodEntity | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM payment_methods WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<PaymentMethodEntity>(row) : undefined;
  }

  findByCode(code: string): PaymentMethodEntity | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM payment_methods WHERE code = ?')
      .get(code) as Record<string, unknown> | undefined;
    return row ? toCamel<PaymentMethodEntity>(row) : undefined;
  }

  nextSortOrder(): number {
    const row = this.db.connection
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM payment_methods')
      .get() as { maxOrder: number };
    return row.maxOrder + 1;
  }

  create(input: CreatePaymentMethodInput): PaymentMethodEntity {
    const result = this.db.connection
      .prepare(`INSERT INTO payment_methods (code, label, sort_order) VALUES (?, ?, ?)`)
      .run(input.code, input.label, input.sortOrder ?? this.nextSortOrder());
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdatePaymentMethodInput): PaymentMethodEntity | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const label = input.label ?? existing.label;
    const isActive = input.isActive ?? existing.isActive;
    this.db.connection
      .prepare('UPDATE payment_methods SET label = ?, is_active = ? WHERE id = ?')
      .run(label, isActive ? 1 : 0, id);
    return this.findById(id);
  }
}
