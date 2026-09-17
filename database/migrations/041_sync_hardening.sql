-- Sync hardening: unique medication catalog names so sync adopts instead of duplicating.

PRAGMA foreign_keys = ON;

UPDATE medication_catalog
SET name = name || ' [' || id || ']'
WHERE id NOT IN (
  SELECT MIN(id) FROM medication_catalog GROUP BY lower(trim(name))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_catalog_name_nocase
  ON medication_catalog(name COLLATE NOCASE);
