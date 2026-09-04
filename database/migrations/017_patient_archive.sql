-- Archive patients instead of hard-deleting medical/financial history.
-- Safe additive migration — existing rows keep archived_at NULL (active).

ALTER TABLE patients ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_patients_archived_at ON patients(archived_at);
