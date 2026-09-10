import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { LabName } from '../../common/types';

@Injectable()
export class LabNamesRepository {
  constructor(private readonly db: DatabaseService) {}

  findAllActive(): LabName[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM lab_names WHERE is_active = 1 ORDER BY sort_order, name')
      .all() as Record<string, unknown>[];
    return toCamelList<LabName>(rows);
  }

  findAll(): LabName[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM lab_names ORDER BY sort_order, name')
      .all() as Record<string, unknown>[];
    return toCamelList<LabName>(rows);
  }

  create(name: string, phone?: string | null): LabName {
    const maxOrder = this.db.connection
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM lab_names')
      .get() as { m: number };
    const result = this.db.connection
      .prepare('INSERT INTO lab_names (name, phone, sort_order) VALUES (?, ?, ?)')
      .run(name.trim(), phone?.trim() || null, maxOrder.m + 1);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  findById(id: number): LabName | undefined {
    const row = this.db.connection.prepare('SELECT * FROM lab_names WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<LabName>(row) : undefined;
  }

  update(
    id: number,
    input: { name?: string; phone?: string | null; isActive?: boolean; sortOrder?: number },
  ): LabName | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = {
      ...existing,
      ...input,
      name: input.name?.trim() ?? existing.name,
      phone: input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
    };
    this.db.connection
      .prepare('UPDATE lab_names SET name = ?, phone = ?, is_active = ?, sort_order = ? WHERE id = ?')
      .run(merged.name, merged.phone, merged.isActive ? 1 : 0, merged.sortOrder, id);
    return this.findById(id);
  }
}
