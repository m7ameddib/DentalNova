-- Laboratory account payments (lab-level ledger entries, separate from per-case lab_case_payments).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lab_account_payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_name_id       INTEGER NOT NULL REFERENCES lab_names(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL,
  payment_method    TEXT NOT NULL,
  payment_date      TEXT NOT NULL,
  note              TEXT,
  expense_id        INTEGER UNIQUE REFERENCES clinic_expenses(id),
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  voided_at         TEXT,
  voided_by_id      INTEGER REFERENCES users(id),
  void_reason       TEXT,
  recorded_by_id    INTEGER REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lab_account_payments_lab
  ON lab_account_payments (lab_name_id, payment_date DESC, id DESC);
