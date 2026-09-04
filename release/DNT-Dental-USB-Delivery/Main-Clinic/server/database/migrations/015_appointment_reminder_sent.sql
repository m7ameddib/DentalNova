-- DNT Dental Clinic Management System
-- Migration 015: Persist manual WhatsApp reminder timestamps on appointments.

PRAGMA foreign_keys = ON;

ALTER TABLE appointments ADD COLUMN reminder_sent_at TEXT;
