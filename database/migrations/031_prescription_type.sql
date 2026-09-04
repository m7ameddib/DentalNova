-- Migration 031: Prescription type (medication vs x-ray imaging request).
-- SAFE / additive: existing rows default to MEDICATION.

PRAGMA foreign_keys = ON;

ALTER TABLE prescriptions ADD COLUMN type TEXT NOT NULL DEFAULT 'MEDICATION';
