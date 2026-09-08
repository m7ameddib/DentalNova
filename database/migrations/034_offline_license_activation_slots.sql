-- DibNova-controlled offline license activation slots (licensing server only).
-- Each slot represents one approved offline clinic license redeemable once via activation code.

CREATE TABLE IF NOT EXISTS offline_license_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  license_id TEXT NOT NULL,
  activation_code_lookup TEXT NOT NULL UNIQUE,
  installation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'revoked')),
  slot_expires_at TEXT,
  license_expires_at TEXT,
  redeemed_at TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_license_slots_clinic_id
  ON offline_license_slots (clinic_id);

CREATE INDEX IF NOT EXISTS idx_offline_license_slots_installation_id
  ON offline_license_slots (installation_id);
