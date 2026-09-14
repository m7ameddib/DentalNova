-- Admin license history/payments (local clinic fallback) and account recovery.

ALTER TABLE clinic_settings ADD COLUMN account_recovery_code_hash TEXT;

CREATE TABLE IF NOT EXISTS license_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id TEXT,
  event_type TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS license_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id TEXT,
  amount_cents INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  method TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  void_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
