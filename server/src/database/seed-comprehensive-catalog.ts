import Database from 'better-sqlite3';
import {
  COMPREHENSIVE_TREATMENT_CATALOG,
  LEGACY_TREATMENT_CATEGORIES,
  TREATMENT_CATEGORY_COLORS,
  TREATMENT_CATEGORY_ORDER,
} from '../common/treatment-catalog.constants';

/** Idempotent: adds comprehensive catalog entries (disabled, price 0) without touching existing rows. */
export function seedComprehensiveTreatmentCatalog(db: Database.Database): void {
  const updateLegacyCategory = db.prepare(
    `UPDATE treatment_types SET category = ? WHERE code = ? AND (category IS NULL OR category = '')`,
  );
  for (const [code, category] of Object.entries(LEGACY_TREATMENT_CATEGORIES)) {
    updateLegacyCategory.run(category, code);
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO treatment_types
       (code, abbreviation, label, color_hex, sort_order, default_price_cents, reference_price_cents, is_active, category)
     VALUES (?, ?, ?, ?, ?, 0, NULL, 0, ?)`,
  );

  for (const category of TREATMENT_CATEGORY_ORDER) {
    const base = TREATMENT_CATEGORY_ORDER.indexOf(category) * 100;
    const items = COMPREHENSIVE_TREATMENT_CATALOG.filter((t) => t.category === category);
    items.forEach((entry, index) => {
      insert.run(
        entry.code,
        entry.abbreviation,
        entry.label,
        TREATMENT_CATEGORY_COLORS[category],
        base + index + 1,
        category,
      );
    });
  }
}
