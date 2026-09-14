-- Bidirectional Online ↔ Offline change-sync infrastructure.
-- Integer primary keys stay; stable UUIDs live in sync_id_map.

CREATE TABLE IF NOT EXISTS sync_id_map (
  entity TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  record_uid TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entity, local_id)
);

CREATE TABLE IF NOT EXISTS sync_change_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id TEXT NOT NULL UNIQUE,
  entity TEXT NOT NULL,
  record_uid TEXT NOT NULL,
  local_id INTEGER,
  op TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'local',
  device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  acked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_change_log_pending
  ON sync_change_log (acked_at, origin, seq);
CREATE INDEX IF NOT EXISTS idx_sync_change_log_uid
  ON sync_change_log (entity, record_uid, seq);

CREATE TABLE IF NOT EXISTS sync_tombstones (
  entity TEXT NOT NULL,
  record_uid TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entity, record_uid)
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conflict_id TEXT NOT NULL UNIQUE,
  entity TEXT NOT NULL,
  record_uid TEXT NOT NULL,
  local_json TEXT,
  remote_json TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolution TEXT
);

CREATE TABLE IF NOT EXISTS sync_peer_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_apply_guard (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sync_apply_guard (id, active) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS sync_file_objects (
  record_uid TEXT PRIMARY KEY,
  relative_path TEXT NOT NULL,
  mime_type TEXT,
  byte_size INTEGER,
  sha256 TEXT,
  uploaded_at TEXT,
  last_error TEXT
);
