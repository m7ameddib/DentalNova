-- Account discounts as dated entries (like payments), replacing the lump-sum column.
CREATE TABLE IF NOT EXISTS account_discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  recorded_by_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  voided_at TEXT,
  voided_by_id INTEGER REFERENCES users(id),
  void_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_discounts_patient_date
  ON account_discounts (patient_id, date DESC, id DESC);

-- Migrate existing lump-sum discounts into one entry per patient.
INSERT INTO account_discounts (patient_id, amount_cents, date, note, status)
SELECT id, account_discount_cents, date('now'), 'Migrated account discount', 'ACTIVE'
FROM patients
WHERE account_discount_cents > 0;
