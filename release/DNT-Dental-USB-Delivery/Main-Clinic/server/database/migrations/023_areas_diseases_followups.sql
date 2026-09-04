-- Areas / regions, disease catalog, treatment follow-up slots, patient area link

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS areas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS disease_catalog (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE patients ADD COLUMN area_id INTEGER REFERENCES areas(id);

ALTER TABLE medical_alerts ADD COLUMN disease_catalog_id INTEGER REFERENCES disease_catalog(id);

ALTER TABLE patient_treatments ADD COLUMN follow_up_1_days INTEGER;
ALTER TABLE patient_treatments ADD COLUMN follow_up_2_days INTEGER;
ALTER TABLE patient_treatments ADD COLUMN follow_up_3_days INTEGER;
