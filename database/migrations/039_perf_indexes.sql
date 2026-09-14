-- Query indexes for reports, outstanding balances, and patient lists.
-- UNIQUE(file_number) already indexes file_number.

CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at);
CREATE INDEX IF NOT EXISTS idx_patients_archived_at ON patients (archived_at);
CREATE INDEX IF NOT EXISTS idx_payments_patient_status ON payments (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_status ON patient_treatments (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_account_discounts_patient_status ON account_discounts (patient_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments (date, status);
