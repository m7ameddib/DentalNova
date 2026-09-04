import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { Area } from '../../common/types';

export interface CreateAreaInput {
  name: string;
  sortOrder?: number;
}

export interface UpdateAreaInput {
  name?: string;
  isActive?: boolean;
}

@Injectable()
export class AreasRepository {
  constructor(private readonly db: DatabaseService) {}

  findAll(): Area[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM areas ORDER BY sort_order, name COLLATE NOCASE')
      .all() as Record<string, unknown>[];
    return toCamelList<Area>(rows);
  }

  findAllActive(): Area[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM areas WHERE is_active = 1 ORDER BY sort_order, name COLLATE NOCASE')
      .all() as Record<string, unknown>[];
    return toCamelList<Area>(rows);
  }

  findById(id: number): Area | undefined {
    const row = this.db.connection.prepare('SELECT * FROM areas WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<Area>(row) : undefined;
  }

  nextSortOrder(): number {
    const row = this.db.connection.prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM areas').get() as {
      maxOrder: number;
    };
    return row.maxOrder + 1;
  }

  create(input: CreateAreaInput): Area {
    const result = this.db.connection
      .prepare('INSERT INTO areas (name, sort_order) VALUES (?, ?)')
      .run(input.name.trim(), input.sortOrder ?? this.nextSortOrder());
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdateAreaInput): Area | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const name = input.name?.trim() ?? existing.name;
    const isActive = input.isActive ?? existing.isActive;
    this.db.connection
      .prepare("UPDATE areas SET name = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, isActive ? 1 : 0, id);
    return this.findById(id);
  }

  delete(id: number): boolean {
    const used = this.db.connection.prepare('SELECT COUNT(*) as c FROM patients WHERE area_id = ?').get(id) as {
      c: number;
    };
    if (used.c > 0) {
      this.update(id, { isActive: false });
      return false;
    }
    const result = this.db.connection.prepare('DELETE FROM areas WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
