-- Admin account phone + online clinic registry + password reset OTP tokens

PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN phone_normalized TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_normalized
  ON users(phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS online_clinic_accounts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  username          TEXT NOT NULL COLLATE NOCASE UNIQUE,
  phone_normalized  TEXT NOT NULL UNIQUE,
  installation_id   TEXT NOT NULL UNIQUE,
  admin_user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_normalized  TEXT NOT NULL,
  code_hash         TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  used_at           TEXT,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_active
  ON password_reset_otps(user_id, used_at, expires_at);
