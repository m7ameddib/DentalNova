-- DNT Dental Clinic Management System
-- Migration 014: Follow-up history appointment/payment references.
--
-- SAFE / additive migration only.

PRAGMA foreign_keys = ON;

ALTER TABLE follow_up_history ADD COLUMN appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE follow_up_history ADD COLUMN appointment_summary TEXT;
ALTER TABLE follow_up_history ADD COLUMN payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE follow_up_history ADD COLUMN payment_amount_cents INTEGER;
