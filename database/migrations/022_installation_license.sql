-- DNT Dental — installation & license metadata (production delivery)
-- Safe additive migration. Existing databases with users are marked setup-complete
-- so they skip the first-run wizard. A signed license is still required in
-- production Offline (see installation.service isLicenseExpired).

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

-- Existing DBs that already have users: skip the first-setup wizard.
-- Do NOT invent a fake license payload — production Offline verifies signatures.
UPDATE app_installation
SET setup_completed_at = COALESCE(setup_completed_at, datetime('now'))
WHERE id = 1
  AND setup_completed_at IS NULL
  AND EXISTS (SELECT 1 FROM users LIMIT 1);
