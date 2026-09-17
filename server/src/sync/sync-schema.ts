import Database from 'better-sqlite3';
import {
  PRE_BOOTSTRAP_HOLD_ENTITIES,
  REFERENCE_CATALOG_ENTITIES,
  SYNC_ENTITIES,
  tableExists,
} from './sync.entities';

const SEED_CATALOG_ACK_KEY = 'seed_catalog_outbound_acked_v1';

export function ensureSyncInfrastructure(db: Database.Database): void {
  if (!tableExists(db, 'sync_change_log')) return;
  installTriggers(db);
  backfillIdMap(db);
  ackLegacySeedCatalogOutbound(db);
}

function installTriggers(db: Database.Database): void {
  for (const entity of SYNC_ENTITIES) {
    if (!tableExists(db, entity.table)) continue;
    const insertName = `trg_sync_${entity.table}_ai`;
    const updateName = `trg_sync_${entity.table}_au`;
    const deleteName = `trg_sync_${entity.table}_ad`;
    db.exec(`DROP TRIGGER IF EXISTS ${insertName}`);
    db.exec(`DROP TRIGGER IF EXISTS ${updateName}`);
    db.exec(`DROP TRIGGER IF EXISTS ${deleteName}`);

    db.exec(`
      CREATE TRIGGER ${insertName} AFTER INSERT ON ${entity.table}
      WHEN COALESCE((SELECT active FROM sync_apply_guard WHERE id = 1), 0) = 0
      BEGIN
        INSERT OR IGNORE INTO sync_id_map (entity, local_id, record_uid)
          VALUES ('${entity.name}', NEW.id, lower(hex(randomblob(16))));
        INSERT INTO sync_change_log (change_id, entity, record_uid, local_id, op, origin)
        SELECT lower(hex(randomblob(16))), '${entity.name}', m.record_uid, NEW.id, 'upsert', 'local'
        FROM sync_id_map m WHERE m.entity = '${entity.name}' AND m.local_id = NEW.id;
      END;
    `);

    db.exec(`
      CREATE TRIGGER ${updateName} AFTER UPDATE ON ${entity.table}
      WHEN COALESCE((SELECT active FROM sync_apply_guard WHERE id = 1), 0) = 0
      BEGIN
        INSERT OR IGNORE INTO sync_id_map (entity, local_id, record_uid)
          VALUES ('${entity.name}', NEW.id, lower(hex(randomblob(16))));
        INSERT INTO sync_change_log (change_id, entity, record_uid, local_id, op, origin)
        SELECT lower(hex(randomblob(16))), '${entity.name}', m.record_uid, NEW.id, 'upsert', 'local'
        FROM sync_id_map m WHERE m.entity = '${entity.name}' AND m.local_id = NEW.id;
      END;
    `);

    db.exec(`
      CREATE TRIGGER ${deleteName} AFTER DELETE ON ${entity.table}
      WHEN COALESCE((SELECT active FROM sync_apply_guard WHERE id = 1), 0) = 0
      BEGIN
        INSERT INTO sync_tombstones (entity, record_uid, deleted_at)
        SELECT '${entity.name}', m.record_uid, datetime('now')
        FROM sync_id_map m WHERE m.entity = '${entity.name}' AND m.local_id = OLD.id
        ON CONFLICT(entity, record_uid) DO UPDATE SET deleted_at = excluded.deleted_at;
        INSERT INTO sync_change_log (change_id, entity, record_uid, local_id, op, origin)
        SELECT lower(hex(randomblob(16))), '${entity.name}', m.record_uid, OLD.id, 'delete', 'local'
        FROM sync_id_map m WHERE m.entity = '${entity.name}' AND m.local_id = OLD.id;
      END;
    `);
  }
}

function backfillIdMap(db: Database.Database): void {
  for (const entity of SYNC_ENTITIES) {
    if (!tableExists(db, entity.table)) continue;
    db.prepare(
      `INSERT OR IGNORE INTO sync_id_map (entity, local_id, record_uid)
       SELECT ?, id, lower(hex(randomblob(16))) FROM ${entity.table}`,
    ).run(entity.name);
  }
}

function peerFlag(db: Database.Database, key: string): string | null {
  if (!tableExists(db, 'sync_peer_state')) return null;
  const row = db.prepare(`SELECT value FROM sync_peer_state WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setPeerFlag(db: Database.Database, key: string, value: string): void {
  if (!tableExists(db, 'sync_peer_state')) return;
  db.prepare(
    `INSERT INTO sync_peer_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

function ackPendingLocalEntities(db: Database.Database, entities: readonly string[]): void {
  if (!tableExists(db, 'sync_change_log') || entities.length === 0) return;
  const placeholders = entities.map(() => '?').join(', ');
  db.prepare(
    `UPDATE sync_change_log SET acked_at = datetime('now')
     WHERE acked_at IS NULL AND origin = 'local' AND entity IN (${placeholders})`,
  ).run(...entities);
}

/**
 * Existing installs logged comprehensive catalog seed as local outbound.
 * Ack those rows once so they cannot wedge Offline → Online push.
 * Later doctor catalog edits still flow through triggers.
 */
export function ackLegacySeedCatalogOutbound(db: Database.Database): void {
  if (!tableExists(db, 'sync_change_log')) return;
  if (peerFlag(db, SEED_CATALOG_ACK_KEY) === '1') return;
  ackPendingLocalEntities(db, REFERENCE_CATALOG_ENTITIES);
  setPeerFlag(db, SEED_CATALOG_ACK_KEY, '1');
}

/** After first Online snapshot, drop setup-time settings/users/hours from the outbox. */
export function ackPreBootstrapHoldOutbound(db: Database.Database): void {
  ackPendingLocalEntities(db, PRE_BOOTSTRAP_HOLD_ENTITIES);
  ackPendingLocalEntities(db, REFERENCE_CATALOG_ENTITIES);
}
