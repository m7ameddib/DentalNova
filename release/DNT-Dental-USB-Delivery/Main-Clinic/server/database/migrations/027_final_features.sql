-- DNT Dental — Final features migration (additive only)
-- Patient weight, guarantors, treatment scope/date, expense categories,
-- lab service costs, prescription doctor fields.

PRAGMA foreign_keys = ON;

-- ======================================================
-- Guarantors / Insurance
-- ======================================================

CREATE TABLE IF NOT EXISTS guarantors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guarantor_treatment_prices (
  guarantor_id        INTEGER NOT NULL REFERENCES guarantors(id) ON DELETE CASCADE,
  treatment_type_id   INTEGER NOT NULL REFERENCES treatment_types(id) ON DELETE CASCADE,
  price_cents         INTEGER NOT NULL,
  PRIMARY KEY (guarantor_id, treatment_type_id)
);

-- ======================================================
-- Patient extensions
-- ======================================================

ALTER TABLE patients ADD COLUMN weight_kg REAL;
ALTER TABLE patients ADD COLUMN guarantor_id INTEGER REFERENCES guarantors(id);

-- ======================================================
-- Treatment scope + editable treatment date
-- ======================================================

ALTER TABLE treatment_types ADD COLUMN scope TEXT NOT NULL DEFAULT 'SINGLE';
ALTER TABLE patient_treatments ADD COLUMN treatment_date TEXT;
ALTER TABLE patient_treatments ADD COLUMN treatment_scope TEXT;

UPDATE patient_treatments SET treatment_date = date(created_at) WHERE treatment_date IS NULL;

-- ======================================================
-- Expense categories (configurable from Settings)
-- ======================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  is_system   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO expense_categories (code, label, is_system, sort_order) VALUES
  ('ELECTRICITY', 'Electricity', 1, 1),
  ('INTERNET', 'Internet', 1, 2),
  ('RENT', 'Rent', 1, 3),
  ('MATERIALS', 'Materials / Companies', 1, 4),
  ('LAB', 'Laboratories', 1, 5),
  ('SALARIES', 'Salaries', 1, 6),
  ('MAINTENANCE', 'Maintenance', 1, 7),
  ('STATIONERY', 'Stationery', 1, 8),
  ('OTHER', 'Other', 1, 99);

ALTER TABLE clinic_expenses ADD COLUMN paid_to TEXT;
ALTER TABLE clinic_expenses ADD COLUMN expense_category_id INTEGER REFERENCES expense_categories(id);

-- Backfill category ids from legacy category codes
UPDATE clinic_expenses
SET expense_category_id = (
  SELECT ec.id FROM expense_categories ec
  WHERE ec.code = CASE clinic_expenses.category
    WHEN 'UTILITIES' THEN 'ELECTRICITY'
    ELSE clinic_expenses.category
  END
)
WHERE expense_category_id IS NULL;

-- ======================================================
-- Laboratory service costs per lab
-- ======================================================

CREATE TABLE IF NOT EXISTS lab_service_costs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_name_id     INTEGER NOT NULL REFERENCES lab_names(id) ON DELETE CASCADE,
  work_type_code  TEXT NOT NULL,
  cost_cents      INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lab_name_id, work_type_code)
);

-- ======================================================
-- Prescription / doctor branding fields
-- ======================================================

ALTER TABLE clinic_settings ADD COLUMN doctor_name_ar TEXT;
ALTER TABLE clinic_settings ADD COLUMN doctor_name_en TEXT;
ALTER TABLE clinic_settings ADD COLUMN doctor_title_ar TEXT;
ALTER TABLE clinic_settings ADD COLUMN doctor_title_en TEXT;
ALTER TABLE clinic_settings ADD COLUMN doctor_license_no TEXT;
