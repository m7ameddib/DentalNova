-- DNT Dental Clinic Management System
-- Migration 016: Editable WhatsApp message templates in clinic settings.

PRAGMA foreign_keys = ON;

ALTER TABLE clinic_settings ADD COLUMN whatsapp_message_language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE clinic_settings ADD COLUMN whatsapp_appointment_reminder_en TEXT;
ALTER TABLE clinic_settings ADD COLUMN whatsapp_appointment_reminder_ar TEXT;
ALTER TABLE clinic_settings ADD COLUMN whatsapp_clinical_followup_en TEXT;
ALTER TABLE clinic_settings ADD COLUMN whatsapp_clinical_followup_ar TEXT;
ALTER TABLE clinic_settings ADD COLUMN whatsapp_financial_followup_en TEXT;
ALTER TABLE clinic_settings ADD COLUMN whatsapp_financial_followup_ar TEXT;
