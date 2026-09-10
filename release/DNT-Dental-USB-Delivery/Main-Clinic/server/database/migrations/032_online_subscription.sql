-- Online subscription lifecycle (online deployment mode only).
-- Offline installations keep these columns NULL.

PRAGMA foreign_keys = ON;

ALTER TABLE app_installation ADD COLUMN online_subscription_status TEXT;
ALTER TABLE app_installation ADD COLUMN online_subscription_started_at TEXT;
ALTER TABLE app_installation ADD COLUMN online_subscription_expires_at TEXT;
ALTER TABLE app_installation ADD COLUMN online_subscription_suspended_at TEXT;
ALTER TABLE app_installation ADD COLUMN online_subscription_suspended_reason TEXT;
ALTER TABLE app_installation ADD COLUMN online_admin_notes TEXT;
