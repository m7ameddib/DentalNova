import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { DiseaseCatalogItem } from '../../common/types';

export interface CreateDiseaseCatalogInput {
  name: string;
  sortOrder?: number;
}

export interface UpdateDiseaseCatalogInput {
  name?: string;
  isActive?: boolean;
}

@Injectable()
export class DiseaseCatalogRepository {
  constructor(private readonly db: DatabaseService) {}

  findAll(): DiseaseCatalogItem[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM disease_catalog ORDER BY sort_order, name COLLATE NOCASE')
      .all() as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  findAllActive(): DiseaseCatalogItem[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM disease_catalog WHERE is_active = 1 ORDER BY sort_order, name COLLATE NOCASE')
      .all() as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  findById(id: number): DiseaseCatalogItem | undefined {
    const row = this.db.connection.prepare('SELECT * FROM disease_catalog WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  nextSortOrder(): number {
    const row = this.db.connection
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM disease_catalog')
      .get() as { maxOrder: number };
    return row.maxOrder + 1;
  }

  create(input: CreateDiseaseCatalogInput): DiseaseCatalogItem {
    const result = this.db.connection
      .prepare('INSERT INTO disease_catalog (name, sort_order) VALUES (?, ?)')
      .run(input.name.trim(), input.sortOrder ?? this.nextSortOrder());
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdateDiseaseCatalogInput): DiseaseCatalogItem | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const name = input.name?.trim() ?? existing.name;
    const isActive = input.isActive ?? existing.isActive;
    this.db.connection
      .prepare("UPDATE disease_catalog SET name = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, isActive ? 1 : 0, id);
    return this.findById(id);
  }

  delete(id: number): boolean {
    const used = this.db.connection
      .prepare('SELECT COUNT(*) as c FROM medical_alerts WHERE disease_catalog_id = ?')
      .get(id) as { c: number };
    if (used.c > 0) {
      this.update(id, { isActive: false });
      return false;
    }
    const result = this.db.connection.prepare('DELETE FROM disease_catalog WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRow(row: Record<string, unknown>): DiseaseCatalogItem {
    const mapped = toCamel<DiseaseCatalogItem>(row);
    mapped.isActive = Boolean(row.is_active);
    return mapped;
  }
}
