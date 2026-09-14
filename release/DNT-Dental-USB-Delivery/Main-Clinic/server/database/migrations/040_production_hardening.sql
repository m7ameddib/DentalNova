-- Production hardening:
-- 1. Give guarantor_treatment_prices a surrogate id so Online ↔ Offline sync can map rows.
-- 2. Clear unsigned legacyDev license backfill so production Offline requires a signed license.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guarantor_treatment_prices_v2 (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  guarantor_id        INTEGER NOT NULL REFERENCES guarantors(id) ON DELETE CASCADE,
  treatment_type_id   INTEGER NOT NULL REFERENCES treatment_types(id) ON DELETE CASCADE,
  price_cents         INTEGER NOT NULL,
  UNIQUE(guarantor_id, treatment_type_id)
);

INSERT INTO guarantor_treatment_prices_v2 (guarantor_id, treatment_type_id, price_cents)
SELECT guarantor_id, treatment_type_id, price_cents FROM guarantor_treatment_prices;

DROP TABLE guarantor_treatment_prices;
ALTER TABLE guarantor_treatment_prices_v2 RENAME TO guarantor_treatment_prices;

UPDATE app_installation
SET
  license_activated_at = NULL,
  license_payload = NULL
WHERE id = 1
  AND license_signature IS NULL
  AND license_payload LIKE '%legacyDev%';
