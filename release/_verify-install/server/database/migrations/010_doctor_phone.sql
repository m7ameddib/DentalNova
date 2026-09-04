-- DNT Dental Clinic Management System
-- Migration 010: Dedicated "Doctor phone" field in Clinic Settings.
--
-- Used as the WhatsApp destination for the "Send Today's Appointments"
-- button on the Appointments page (manual send only — no automatic
-- messaging). Kept separate from clinic_phone so the clinic's public
-- contact number and the doctor's personal WhatsApp number can differ.

PRAGMA foreign_keys = ON;

ALTER TABLE clinic_settings ADD COLUMN doctor_phone TEXT;
