import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';

export interface ExpenseCategoryEntity {
  id: number;
  code: string;
  label: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

@Injectable()
export class ExpenseCategoriesRepository {
  constructor(private readonly db: DatabaseService) {}

  findAll(): ExpenseCategoryEntity[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM expense_categories ORDER BY sort_order, label')
      .all() as Record<string, unknown>[];
    return toCamelList<ExpenseCategoryEntity>(rows);
  }

  findAllActive(): ExpenseCategoryEntity[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY sort_order, label')
      .all() as Record<string, unknown>[];
    return toCamelList<ExpenseCategoryEntity>(rows);
  }

  findById(id: number): ExpenseCategoryEntity | undefined {
    const row = this.db.connection.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<ExpenseCategoryEntity>(row) : undefined;
  }

  findByCode(code: string): ExpenseCategoryEntity | undefined {
    const row = this.db.connection.prepare('SELECT * FROM expense_categories WHERE code = ?').get(code) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<ExpenseCategoryEntity>(row) : undefined;
  }

  create(label: string): ExpenseCategoryEntity {
    const code = label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const maxOrder = this.db.connection
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM expense_categories')
      .get() as { m: number };
    const result = this.db.connection
      .prepare('INSERT INTO expense_categories (code, label, sort_order) VALUES (?, ?, ?)')
      .run(code, label.trim(), maxOrder.m + 1);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: { label?: string; isActive?: boolean }): ExpenseCategoryEntity | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    this.db.connection
      .prepare('UPDATE expense_categories SET label = ?, is_active = ? WHERE id = ?')
      .run(input.label?.trim() ?? existing.label, (input.isActive ?? existing.isActive) ? 1 : 0, id);
    return this.findById(id);
  }
}
