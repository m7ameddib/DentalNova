-- AI credit tracking for online clinics (platform.db columns added via PlatformService bootstrap).
-- Clinic-local mirror for offline display when synced from online subscription state.
ALTER TABLE clinic_settings ADD COLUMN ai_credits_allowance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clinic_settings ADD COLUMN ai_credits_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clinic_settings ADD COLUMN ai_credits_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clinic_settings ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 1;
