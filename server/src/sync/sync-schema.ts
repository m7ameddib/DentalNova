import Database from 'better-sqlite3';
import { SYNC_ENTITIES, tableExists } from './sync.entities';

export function ensureSyncInfrastructure(db: Database.Database): void {
  if (!tableExists(db, 'sync_change_log')) return;
  installTriggers(db);
  backfillIdMap(db);
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
