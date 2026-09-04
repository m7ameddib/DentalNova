-- DNT Dental Clinic Management System
-- Migration 002: Treatment Catalog pricing + treatment entry pricing/multi-tooth.
--
-- SAFE / additive migration only:
--   * No tables are dropped, no existing rows are deleted.
--   * All new columns have defaults and are backfilled from existing data so
--     historical treatments and treatment types remain fully readable.
--
-- What changes:
--   * treatment_types gains a configurable `default_price_cents` (the
--     Treatment Catalog price used to auto-fill new treatment entries).
--   * patient_treatments gains entry-level pricing: base_amount_cents,
--     discount_cents, final_amount_cents (final_amount_cents is what feeds
--     the patient invoice total). Existing rows are backfilled from the
--     legacy `price_cents` column (base = final = price_cents, discount = 0).
--   * A new patient_treatment_teeth join table allows a single treatment
--     entry to cover multiple teeth (needed for multi-tooth treatments with
--     one shared discount/base/final amount). Existing per-tooth rows are
--     backfilled into this table so the dental chart keeps working exactly
--     as before for historical data.
--   * The `treatments.manage` permission is granted to the existing
--     "doctor" system role so Treatment Catalog management keeps working
--     immediately after this migration (data-only, no destructive change).

-- ======================================================
-- Treatment catalog: default price
-- ======================================================

ALTER TABLE treatment_types ADD COLUMN default_price_cents INTEGER NOT NULL DEFAULT 0;

UPDATE treatment_types SET default_price_cents = 5000   WHERE code = 'FILLING'      AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 30000  WHERE code = 'ROOT_CANAL'   AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 40000  WHERE code = 'CROWN'        AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 8000   WHERE code = 'EXTRACTION'   AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 3000   WHERE code = 'CLEANING'     AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 15000  WHERE code = 'WHITENING'    AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 60000  WHERE code = 'IMPLANT'      AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 45000  WHERE code = 'BRIDGE'       AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 35000  WHERE code = 'VENEER'       AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 200000 WHERE code = 'ORTHODONTIC'  AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 2000   WHERE code = 'TEMP_FILLING' AND default_price_cents = 0;
UPDATE treatment_types SET default_price_cents = 5000   WHERE code = 'OTHER'        AND default_price_cents = 0;

-- ======================================================
-- Treatment entries: base / discount / final pricing
-- ======================================================

ALTER TABLE patient_treatments ADD COLUMN base_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE patient_treatments ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE patient_treatments ADD COLUMN final_amount_cents INTEGER NOT NULL DEFAULT 0;

-- Backfill: historical rows had one row per tooth, each already carrying the
-- full price in price_cents. Treat that as both base and final with no
-- discount so existing invoice totals do not change.
UPDATE patient_treatments
SET base_amount_cents = price_cents,
    final_amount_cents = price_cents
WHERE base_amount_cents = 0 AND final_amount_cents = 0;

-- ======================================================
-- Multi-tooth support: one treatment entry, many teeth
-- ======================================================

CREATE TABLE IF NOT EXISTS patient_treatment_teeth (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  treatment_id  INTEGER NOT NULL REFERENCES patient_treatments(id) ON DELETE CASCADE,
  tooth_number  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ptt_treatment ON patient_treatment_teeth(treatment_id);
CREATE INDEX IF NOT EXISTS idx_ptt_tooth ON patient_treatment_teeth(tooth_number);

-- Backfill existing per-tooth treatment rows into the join table so the
-- dental chart and history keep showing historical teeth correctly.
INSERT INTO patient_treatment_teeth (treatment_id, tooth_number)
SELECT pt.id, pt.tooth_number
FROM patient_treatments pt
WHERE pt.tooth_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM patient_treatment_teeth ptt WHERE ptt.treatment_id = pt.id
  );

-- ======================================================
-- RBAC: Treatment Catalog management permission
-- ======================================================

INSERT OR IGNORE INTO permissions (key, label) VALUES ('treatments.manage', 'Manage treatment catalog');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.key = 'treatments.manage';
