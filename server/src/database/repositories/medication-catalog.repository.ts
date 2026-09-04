import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { MedicationCatalogItem } from '../../common/types';

export interface CreateMedicationCatalogInput {
  name: string;
  strengthForm?: string | null;
  category: string;
  defaultDose?: string | null;
  defaultFrequency?: string | null;
  defaultDuration?: string | null;
  defaultInstructions?: string | null;
  sortOrder?: number;
}

export interface UpdateMedicationCatalogInput {
  name?: string;
  strengthForm?: string | null;
  category?: string;
  defaultDose?: string | null;
  defaultFrequency?: string | null;
  defaultDuration?: string | null;
  defaultInstructions?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable()
export class MedicationCatalogRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Full catalog (active + inactive) — the Prescription screen filters active-only for the button grid. */
  findAll(): MedicationCatalogItem[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM medication_catalog ORDER BY category, sort_order, name')
      .all() as Record<string, unknown>[];
    return toCamelList<MedicationCatalogItem>(rows);
  }

  findById(id: number): MedicationCatalogItem | undefined {
    const row = this.db.connection.prepare('SELECT * FROM medication_catalog WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<MedicationCatalogItem>(row) : undefined;
  }

  nextSortOrder(): number {
    const row = this.db.connection
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM medication_catalog')
      .get() as { maxOrder: number };
    return row.maxOrder + 1;
  }

  create(input: CreateMedicationCatalogInput): MedicationCatalogItem {
    const result = this.db.connection
      .prepare(
        `INSERT INTO medication_catalog
          (name, strength_form, category, default_dose, default_frequency, default_duration, default_instructions, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.strengthForm ?? null,
        input.category,
        input.defaultDose ?? null,
        input.defaultFrequency ?? null,
        input.defaultDuration ?? null,
        input.defaultInstructions ?? null,
        input.sortOrder ?? this.nextSortOrder(),
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  /**
   * Hard-deletes a catalog entry. Safe to call at any time — prescription
   * items store their own copy of the medicine name/dose/etc at save time
   * (see `prescription_items`), so deleting a catalog entry never touches
   * previously-saved prescriptions.
   */
  delete(id: number): boolean {
    const result = this.db.connection.prepare('DELETE FROM medication_catalog WHERE id = ?').run(id);
    return result.changes > 0;
  }

  update(id: number, input: UpdateMedicationCatalogInput): MedicationCatalogItem | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    // Merge field-by-field (not via object spread) so DTO keys that are
    // present-but-undefined never blank out an existing value.
    const name = input.name ?? existing.name;
    const strengthForm = input.strengthForm !== undefined ? input.strengthForm : existing.strengthForm;
    const category = input.category ?? existing.category;
    const defaultDose = input.defaultDose !== undefined ? input.defaultDose : existing.defaultDose;
    const defaultFrequency = input.defaultFrequency !== undefined ? input.defaultFrequency : existing.defaultFrequency;
    const defaultDuration = input.defaultDuration !== undefined ? input.defaultDuration : existing.defaultDuration;
    const defaultInstructions =
      input.defaultInstructions !== undefined ? input.defaultInstructions : existing.defaultInstructions;
    const sortOrder = input.sortOrder ?? existing.sortOrder;
    const isActive = input.isActive ?? existing.isActive;

    this.db.connection
      .prepare(
        `UPDATE medication_catalog SET
          name = ?, strength_form = ?, category = ?, default_dose = ?, default_frequency = ?,
          default_duration = ?, default_instructions = ?, sort_order = ?, is_active = ?
         WHERE id = ?`,
      )
      .run(
        name,
        strengthForm,
        category,
        defaultDose,
        defaultFrequency,
        defaultDuration,
        defaultInstructions,
        sortOrder,
        isActive ? 1 : 0,
        id,
      );
    return this.findById(id);
  }
}
