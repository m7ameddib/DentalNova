-- DNT Dental Clinic Management System
-- Migration 009: Medication Catalog for the Prescription screen.
--
-- SAFE / additive migration only — no existing tables/rows are touched.
-- Medications are shown as buttons/cards on the Prescription screen instead
-- of a search box; the catalog stays editable by the Doctor (add/edit) from
-- inside that screen, gated by the existing "prescriptions.manage"
-- permission (doctor only) — no new permission is introduced.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS medication_catalog (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  strength_form         TEXT,
  category              TEXT NOT NULL DEFAULT 'OTHER', -- ANTIBIOTICS|PAINKILLERS|ANTI_INFLAMMATORY|MOUTHWASH|OTHER
  default_dose          TEXT,
  default_frequency     TEXT,
  default_duration      TEXT,
  default_instructions  TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medication_catalog_category ON medication_catalog(category);

-- Small starter catalog so the Prescription screen isn't empty on first use.
-- The Doctor can edit/add to this list at any time from the screen itself.
INSERT OR IGNORE INTO medication_catalog
  (id, name, strength_form, category, default_dose, default_frequency, default_duration, default_instructions, sort_order)
VALUES
  (1, 'Amoxicillin', '500mg capsule', 'ANTIBIOTICS', '1 capsule', '3 times a day', '7 days', 'Take after meals', 1),
  (2, 'Amoxicillin/Clavulanate', '625mg tablet', 'ANTIBIOTICS', '1 tablet', '2 times a day', '7 days', 'Take after meals', 2),
  (3, 'Metronidazole', '400mg tablet', 'ANTIBIOTICS', '1 tablet', '3 times a day', '5 days', 'Avoid alcohol', 3),
  (4, 'Clindamycin', '300mg capsule', 'ANTIBIOTICS', '1 capsule', '3 times a day', '7 days', 'Take with water', 4),
  (5, 'Ibuprofen', '400mg tablet', 'PAINKILLERS', '1 tablet', 'Every 8 hours as needed', '5 days', 'Take after food', 5),
  (6, 'Paracetamol', '500mg tablet', 'PAINKILLERS', '1-2 tablets', 'Every 6 hours as needed', '5 days', 'Do not exceed 8 tablets/day', 6),
  (7, 'Diclofenac Potassium', '50mg tablet', 'ANTI_INFLAMMATORY', '1 tablet', '2 times a day', '5 days', 'Take after meals', 7),
  (8, 'Dexamethasone', '4mg tablet', 'ANTI_INFLAMMATORY', '1 tablet', 'Once a day', '3 days', 'Take in the morning', 8),
  (9, 'Chlorhexidine Mouthwash', '0.12%', 'MOUTHWASH', '15 ml rinse', '2 times a day', '7 days', 'Do not swallow; avoid food/drink for 30 min after', 9),
  (10, 'Warm Saline Rinse', 'salt water', 'MOUTHWASH', 'Rinse', '3-4 times a day', '5 days', 'Warm water with a pinch of salt', 10);
