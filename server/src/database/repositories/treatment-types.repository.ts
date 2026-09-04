import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { TreatmentType } from '../../common/types';

export interface CreateTreatmentTypeInput {
  code: string;
  abbreviation: string;
  label: string;
  colorHex?: string;
  sortOrder?: number;
  defaultPriceCents: number;
  followUpDays?: number | null;
  followUp1Days?: number | null;
  followUp2Days?: number | null;
  followUp3Days?: number | null;
  category?: string | null;
  referencePriceCents?: number | null;
  scope?: string | null;
  isActive?: boolean;
}

export interface UpdateTreatmentTypeInput {
  abbreviation?: string;
  label?: string;
  colorHex?: string;
  sortOrder?: number;
  defaultPriceCents?: number;
  isActive?: boolean;
  followUpDays?: number | null;
  followUp1Days?: number | null;
  followUp2Days?: number | null;
  followUp3Days?: number | null;
  category?: string | null;
  referencePriceCents?: number | null;
  scope?: string | null;
}

@Injectable()
export class TreatmentTypesRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Active types only — used wherever a treatment type is being selected for a new entry. */
  findAllActive(): TreatmentType[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM treatment_types WHERE is_active = 1 ORDER BY sort_order')
      .all() as Record<string, unknown>[];
    return toCamelList<TreatmentType>(rows);
  }

  /** Full catalog (active + inactive) — used by the Settings > Treatment Catalog screen. */
  findAll(): TreatmentType[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM treatment_types ORDER BY sort_order')
      .all() as Record<string, unknown>[];
    return toCamelList<TreatmentType>(rows);
  }

  findById(id: number): TreatmentType | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM treatment_types WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? toCamel<TreatmentType>(row) : undefined;
  }

  findByCode(code: string): TreatmentType | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM treatment_types WHERE code = ?')
      .get(code) as Record<string, unknown> | undefined;
    return row ? toCamel<TreatmentType>(row) : undefined;
  }

  nextSortOrder(): number {
    const row = this.db.connection
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM treatment_types')
      .get() as { maxOrder: number };
    return row.maxOrder + 1;
  }

  create(input: CreateTreatmentTypeInput): TreatmentType {
    const result = this.db.connection
      .prepare(
        `INSERT INTO treatment_types (code, abbreviation, label, color_hex, sort_order, default_price_cents, reference_price_cents, is_active, category, scope, follow_up_days, follow_up_1_days, follow_up_2_days, follow_up_3_days)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.code,
        input.abbreviation,
        input.label,
        input.colorHex ?? '#2563EB',
        input.sortOrder ?? this.nextSortOrder(),
        input.defaultPriceCents,
        input.referencePriceCents ?? null,
        input.isActive === false ? 0 : 1,
        input.category ?? null,
        input.scope ?? 'SINGLE',
        input.followUp1Days ?? input.followUpDays ?? null,
        input.followUp1Days ?? input.followUpDays ?? null,
        input.followUp2Days ?? null,
        input.followUp3Days ?? null,
      );
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, input: UpdateTreatmentTypeInput): TreatmentType | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    // Merge field-by-field (not via object spread) so DTO keys that are
    // present-but-undefined never blank out an existing value.
    const abbreviation = input.abbreviation ?? existing.abbreviation;
    const label = input.label ?? existing.label;
    const colorHex = input.colorHex ?? existing.colorHex;
    const sortOrder = input.sortOrder ?? existing.sortOrder;
    const defaultPriceCents = input.defaultPriceCents ?? existing.defaultPriceCents;
    const isActive = input.isActive ?? existing.isActive;
    const followUpDays = input.followUpDays !== undefined ? input.followUpDays : existing.followUpDays;
    const followUp1Days = input.followUp1Days !== undefined ? input.followUp1Days : existing.followUp1Days;
    const followUp2Days = input.followUp2Days !== undefined ? input.followUp2Days : existing.followUp2Days;
    const followUp3Days = input.followUp3Days !== undefined ? input.followUp3Days : existing.followUp3Days;
    const category = input.category !== undefined ? input.category : existing.category;
    const scope = input.scope !== undefined ? input.scope : (existing as { scope?: string }).scope ?? 'SINGLE';
    const referencePriceCents =
      input.referencePriceCents !== undefined ? input.referencePriceCents : existing.referencePriceCents;
    const legacyFollowUpDays = followUp1Days ?? followUpDays;

    this.db.connection
      .prepare(
        `UPDATE treatment_types SET
          abbreviation = ?, label = ?, color_hex = ?, sort_order = ?,
          default_price_cents = ?, reference_price_cents = ?, is_active = ?, category = ?, scope = ?,
          follow_up_days = ?, follow_up_1_days = ?, follow_up_2_days = ?, follow_up_3_days = ?
         WHERE id = ?`,
      )
      .run(
        abbreviation,
        label,
        colorHex,
        sortOrder,
        defaultPriceCents,
        referencePriceCents,
        isActive ? 1 : 0,
        category,
        scope,
        legacyFollowUpDays,
        followUp1Days,
        followUp2Days,
        followUp3Days,
        id,
      );
    return this.findById(id);
  }
}
