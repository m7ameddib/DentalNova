-- DNT Dental — installation & license metadata (production delivery)
-- Safe additive migration. Existing dev databases with users are backfilled as ready.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_installation (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  installation_id       TEXT NOT NULL,
  license_payload       TEXT,
  license_signature     TEXT,
  license_activated_at  TEXT,
  setup_completed_at    TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fresh install: create installation row with unique ID
INSERT OR IGNORE INTO app_installation (id, installation_id)
VALUES (1, lower(hex(randomblob(16))));

-- Existing dev/production DBs that already have users: mark as setup-complete
-- so development workflow is not interrupted.
UPDATE app_installation
SET
  license_activated_at = COALESCE(license_activated_at, datetime('now')),
  setup_completed_at = COALESCE(setup_completed_at, datetime('now')),
  license_payload = COALESCE(license_payload, '{"legacyDev":true,"product":"DNT Dental"}')
WHERE id = 1
  AND setup_completed_at IS NULL
  AND EXISTS (SELECT 1 FROM users LIMIT 1);
