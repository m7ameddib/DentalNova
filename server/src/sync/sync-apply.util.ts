import Database from 'better-sqlite3';
import {
  camelToSnake,
  ConflictPolicy,
  fkColumnToUidField,
  newChangeId,
  newUid,
  paymentFingerprint,
  rowsDiffer,
  SYNC_ENTITIES,
  SYNC_ENTITY_BY_NAME,
  SyncChangePayload,
  SyncOp,
  tableExists,
} from './sync.entities';

export interface ApplyResult {
  accepted: string[];
  conflicts: Array<{ changeId: string; entity: string; recordUid: string; reason: string }>;
  skipped: string[];
}

function columnsOf(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

function getUid(db: Database.Database, entity: string, localId: number | null | undefined): string | null {
  if (localId == null) return null;
  const row = db.prepare('SELECT record_uid FROM sync_id_map WHERE entity = ? AND local_id = ?').get(entity, localId) as
    | { record_uid: string }
    | undefined;
  if (row) return row.record_uid;
  const uid = newUid();
  db.prepare('INSERT OR IGNORE INTO sync_id_map (entity, local_id, record_uid) VALUES (?, ?, ?)').run(entity, localId, uid);
  return uid;
}

function getLocalId(db: Database.Database, entity: string, uid: string | null | undefined): number | null {
  if (!uid) return null;
  const row = db.prepare('SELECT local_id FROM sync_id_map WHERE entity = ? AND record_uid = ?').get(entity, uid) as
    | { local_id: number }
    | undefined;
  return row?.local_id ?? null;
}

export function snapshotRow(db: Database.Database, entityName: string, localId: number): Record<string, unknown> | null {
  const def = SYNC_ENTITY_BY_NAME[entityName];
  if (!def || !tableExists(db, def.table)) return null;
  const row = db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(localId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const skip = new Set(['id', ...(def.skipColumns ?? [])]);
  const out: Record<string, unknown> = {};
  for (const [col, value] of Object.entries(row)) {
    if (skip.has(col)) continue;
    if (def.fks[col]) {
      out[fkColumnToUidField(col)] = getUid(db, def.fks[col], value as number | null);
      continue;
    }
    const camel = col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  out.recordUid = getUid(db, entityName, localId);
  return out;
}

export function pendingOutbound(db: Database.Database, limit = 200): SyncChangePayload[] {
  const rows = db
    .prepare(
      `SELECT change_id, entity, record_uid, local_id, op
       FROM sync_change_log
       WHERE acked_at IS NULL AND origin = 'local'
       ORDER BY seq ASC
       LIMIT ?`,
    )
    .all(limit) as Array<{ change_id: string; entity: string; record_uid: string; local_id: number | null; op: SyncOp }>;

  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    latest.set(`${row.entity}:${row.record_uid}`, row);
  }

  const payload: SyncChangePayload[] = [];
  for (const row of latest.values()) {
    if (row.op === 'delete') {
      payload.push({ changeId: row.change_id, entity: row.entity, recordUid: row.record_uid, op: 'delete', row: null });
      continue;
    }
    const snap = row.local_id != null ? snapshotRow(db, row.entity, row.local_id) : null;
    payload.push({
      changeId: row.change_id,
      entity: row.entity,
      recordUid: row.record_uid,
      op: row.op,
      row: snap,
      updatedAt: snap?.updatedAt as string | undefined,
    });
  }

  payload.sort((a, b) => entityOrder(a.entity) - entityOrder(b.entity));
  return payload;
}

function entityOrder(name: string): number {
  const idx = SYNC_ENTITIES.findIndex((e) => e.name === name);
  return idx < 0 ? 999 : idx;
}

function nextPatientFileNumber(db: Database.Database): string {
  const row = db.prepare(`SELECT file_number FROM patients ORDER BY id DESC LIMIT 1`).get() as { file_number?: string } | undefined;
  const lastSeq = row?.file_number ? parseInt(String(row.file_number).replace(/\D/g, ''), 10) || 0 : 0;
  return `P-${String(lastSeq + 1).padStart(6, '0')}`;
}

export function markAcked(db: Database.Database, changeIds: string[]): void {
  const stmt = db.prepare(`UPDATE sync_change_log SET acked_at = datetime('now') WHERE change_id = ?`);
  for (const id of changeIds) stmt.run(id);
}

export function currentCheckpoint(db: Database.Database): number {
  const row = db.prepare(`SELECT value FROM sync_peer_state WHERE key = 'pull_checkpoint'`).get() as { value: string } | undefined;
  return row ? Number(row.value) || 0 : 0;
}

export function setCheckpoint(db: Database.Database, seq: number): void {
  db.prepare(`INSERT INTO sync_peer_state (key, value) VALUES ('pull_checkpoint', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(
    String(seq),
  );
}

export function maxSeq(db: Database.Database): number {
  const row = db.prepare(`SELECT COALESCE(MAX(seq), 0) AS m FROM sync_change_log`).get() as { m: number };
  return row.m;
}

export function changesSince(db: Database.Database, since: number, excludeDeviceId: string | null, limit = 200): {
  changes: SyncChangePayload[];
  until: number;
} {
  const rows = db
    .prepare(
      `SELECT seq, change_id, entity, record_uid, local_id, op, device_id
       FROM sync_change_log
       WHERE seq > ? AND (? IS NULL OR COALESCE(device_id, '') != ?)
       ORDER BY seq ASC
       LIMIT ?`,
    )
    .all(since, excludeDeviceId, excludeDeviceId ?? '', limit) as Array<{
    seq: number;
    change_id: string;
    entity: string;
    record_uid: string;
    local_id: number | null;
    op: SyncOp;
    device_id: string | null;
  }>;

  const changes: SyncChangePayload[] = [];
  let until = since;
  for (const row of rows) {
    until = row.seq;
    if (row.op === 'delete') {
      changes.push({ changeId: row.change_id, entity: row.entity, recordUid: row.record_uid, op: 'delete', row: null });
      continue;
    }
    const snap = row.local_id != null ? snapshotRow(db, row.entity, row.local_id) : null;
    changes.push({
      changeId: row.change_id,
      entity: row.entity,
      recordUid: row.record_uid,
      op: row.op,
      row: snap,
    });
  }
  return { changes, until };
}

export function withRemoteApply<T>(db: Database.Database, fn: () => T): T {
  db.prepare(`UPDATE sync_apply_guard SET active = 1 WHERE id = 1`).run();
  try {
    return fn();
  } finally {
    db.prepare(`UPDATE sync_apply_guard SET active = 0 WHERE id = 1`).run();
  }
}

function recordConflict(
  db: Database.Database,
  entity: string,
  recordUid: string,
  reason: string,
  localJson: unknown,
  remoteJson: unknown,
): void {
  db.prepare(
    `INSERT INTO sync_conflicts (conflict_id, entity, record_uid, local_json, remote_json, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(newChangeId(), entity, recordUid, JSON.stringify(localJson ?? null), JSON.stringify(remoteJson ?? null), reason);
}

export function applyChanges(
  db: Database.Database,
  changes: SyncChangePayload[],
  deviceId: string | null,
): ApplyResult {
  const accepted: string[] = [];
  const skipped: string[] = [];
  const conflicts: ApplyResult['conflicts'] = [];

  const ordered = [...changes].sort((a, b) => entityOrder(a.entity) - entityOrder(b.entity));

  withRemoteApply(db, () => {
    const txn = db.transaction(() => {
      for (const change of ordered) {
        try {
          const applyRow = db.transaction(() => applyOne(db, change, deviceId));
          const result = applyRow();
          if (result === 'accepted') accepted.push(change.changeId);
          else if (result === 'skipped') skipped.push(change.changeId);
          else {
            conflicts.push({
              changeId: change.changeId,
              entity: change.entity,
              recordUid: change.recordUid,
              reason: result,
            });
          }
        } catch (err) {
          recordConflict(db, change.entity, change.recordUid, 'apply-error', null, {
            message: (err as Error).message,
            row: change.row ?? null,
          });
          conflicts.push({
            changeId: change.changeId,
            entity: change.entity,
            recordUid: change.recordUid,
            reason: 'apply-error',
          });
        }
      }
    });
    txn();
  });

  return { accepted, skipped, conflicts };
}

function applyOne(db: Database.Database, change: SyncChangePayload, deviceId: string | null): 'accepted' | 'skipped' | string {
  const existingChange = db.prepare('SELECT change_id FROM sync_change_log WHERE change_id = ?').get(change.changeId);
  if (existingChange) return 'skipped';

  const def = SYNC_ENTITY_BY_NAME[change.entity];
  if (!def || !tableExists(db, def.table)) return 'skipped';

  if (change.op === 'delete') {
    const localId = getLocalId(db, change.entity, change.recordUid);
    if (localId != null) {
      if (columnsOf(db, def.table).includes('archived_at')) {
        db.prepare(`UPDATE ${def.table} SET archived_at = COALESCE(archived_at, datetime('now')) WHERE id = ?`).run(localId);
      } else if (columnsOf(db, def.table).includes('status')) {
        db.prepare(`UPDATE ${def.table} SET status = 'VOID' WHERE id = ? AND COALESCE(status, 'ACTIVE') != 'VOID'`).run(localId);
      } else {
        db.prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(localId);
      }
    }
    db.prepare(
      `INSERT OR IGNORE INTO sync_tombstones (entity, record_uid) VALUES (?, ?)`,
    ).run(change.entity, change.recordUid);
    appendRemoteLog(db, change, deviceId, localId);
    return 'accepted';
  }

  if (!change.row) return 'skipped';

  const localId = getLocalId(db, change.entity, change.recordUid);
  const policy: ConflictPolicy = def.conflict;

  if (policy === 'immutable' && localId != null) {
    const current = snapshotRow(db, change.entity, localId);
    if (current && rowsDiffer(current, change.row, def.skipColumns)) {
      recordConflict(db, change.entity, change.recordUid, 'immutable-row-differs', current, change.row);
      appendRemoteLog(db, change, deviceId, localId);
      return 'immutable-row-differs';
    }
    appendRemoteLog(db, change, deviceId, localId);
    return 'skipped';
  }

  if (change.entity === 'payments' && localId == null) {
    const fp = paymentFingerprint(change.row);
    const candidates = db.prepare(`SELECT local_id FROM sync_id_map WHERE entity = 'payments'`).all() as { local_id: number }[];
    for (const cand of candidates) {
      const snap = snapshotRow(db, 'payments', cand.local_id);
      if (snap && paymentFingerprint(snap) === fp) {
        recordConflict(db, 'payments', change.recordUid, 'duplicate-payment-fingerprint', snap, change.row);
        return 'duplicate-payment-fingerprint';
      }
    }
  }

  if (policy === 'review' && localId != null) {
    const pendingLocal = db
      .prepare(
        `SELECT 1 FROM sync_change_log WHERE entity = ? AND record_uid = ? AND origin = 'local' AND acked_at IS NULL LIMIT 1`,
      )
      .get(change.entity, change.recordUid);
    if (pendingLocal) {
      const current = snapshotRow(db, change.entity, localId);
      if (current && rowsDiffer(current, change.row, def.skipColumns)) {
        recordConflict(db, change.entity, change.recordUid, 'concurrent-edit', current, change.row);
        return 'concurrent-edit';
      }
    }
  }

  const cols = columnsOf(db, def.table);
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(change.row)) {
    if (key === 'recordUid') continue;
    if (key.endsWith('Uid')) {
      const camelCol = key.replace(/Uid$/, 'Id');
      const snake = camelToSnake(camelCol);
      const fkEntity = Object.entries(def.fks).find(([col]) => col === snake)?.[1];
      if (fkEntity && cols.includes(snake)) {
        values[snake] = getLocalId(db, fkEntity, value as string | null);
      }
      continue;
    }
    const snake = camelToSnake(key);
    if (cols.includes(snake) && snake !== 'id' && !(def.skipColumns ?? []).includes(snake)) {
      values[snake] = value;
    }
  }

  if (change.entity === 'patients' && localId == null && cols.includes('file_number') && !values.file_number) {
    values.file_number = nextPatientFileNumber(db);
  }

  let appliedId = localId;
  if (localId == null) {
    const insertCols = Object.keys(values);
    if (insertCols.length === 0) return 'skipped';
    const placeholders = insertCols.map(() => '?').join(', ');
    const info = db
      .prepare(`INSERT INTO ${def.table} (${insertCols.join(', ')}) VALUES (${placeholders})`)
      .run(...insertCols.map((c) => values[c] ?? null));
    appliedId = Number(info.lastInsertRowid);
    db.prepare('DELETE FROM sync_id_map WHERE entity = ? AND local_id = ?').run(change.entity, appliedId);
    db.prepare('INSERT INTO sync_id_map (entity, local_id, record_uid) VALUES (?, ?, ?)').run(
      change.entity,
      appliedId,
      change.recordUid,
    );
  } else {
    const assignments = Object.keys(values)
      .map((c) => `${c} = ?`)
      .join(', ');
    if (assignments) {
      db.prepare(`UPDATE ${def.table} SET ${assignments} WHERE id = ?`).run(...Object.keys(values).map((c) => values[c] ?? null), localId);
    }
  }

  appendRemoteLog(db, change, deviceId, appliedId);
  return 'accepted';
}

function appendRemoteLog(
  db: Database.Database,
  change: SyncChangePayload,
  deviceId: string | null,
  localId: number | null,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO sync_change_log (change_id, entity, record_uid, local_id, op, origin, device_id, acked_at)
     VALUES (?, ?, ?, ?, ?, 'remote', ?, datetime('now'))`,
  ).run(change.changeId, change.entity, change.recordUid, localId, change.op, deviceId);
}

export function unresolvedConflictCount(db: Database.Database): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM sync_conflicts WHERE resolved_at IS NULL`).get() as { c: number };
  return row.c;
}

export function pendingCount(db: Database.Database): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM sync_change_log WHERE acked_at IS NULL AND origin = 'local'`)
    .get() as { c: number };
  return row.c;
}

export function listConflicts(db: Database.Database) {
  return db
    .prepare(
      `SELECT conflict_id AS conflictId, entity, record_uid AS recordUid, reason, local_json AS localJson, remote_json AS remoteJson, created_at AS createdAt, resolved_at AS resolvedAt, resolution
       FROM sync_conflicts ORDER BY id DESC LIMIT 100`,
    )
    .all();
}

export function resolveConflict(
  db: Database.Database,
  conflictId: string,
  resolution: 'keep_local' | 'keep_remote',
): void {
  const row = db
    .prepare(`SELECT * FROM sync_conflicts WHERE conflict_id = ?`)
    .get(conflictId) as
    | { entity: string; record_uid: string; local_json: string; remote_json: string; resolved_at: string | null }
    | undefined;
  if (!row || row.resolved_at) return;
  if (resolution === 'keep_remote') {
    const remote = JSON.parse(row.remote_json || 'null') as Record<string, unknown> | null;
    if (remote) {
      applyChanges(db, [
        {
          changeId: newChangeId(),
          entity: row.entity,
          recordUid: row.record_uid,
          op: 'upsert',
          row: remote,
        },
      ], 'conflict-resolution');
    }
  }
  db.prepare(`UPDATE sync_conflicts SET resolved_at = datetime('now'), resolution = ? WHERE conflict_id = ?`).run(
    resolution,
    conflictId,
  );
}

export function clinicSnapshot(
  db: Database.Database,
  afterEntity?: string,
  afterId = 0,
  limit = 100,
): { changes: SyncChangePayload[]; nextAfterEntity?: string; nextAfterId?: number } {
  const start = afterEntity ? entityOrder(afterEntity) : 0;
  const out: SyncChangePayload[] = [];
  let nextAfterEntity: string | undefined;
  let nextAfterId: number | undefined;
  for (const entity of SYNC_ENTITIES) {
    if (entityOrder(entity.name) < start) continue;
    if (!tableExists(db, entity.table)) continue;
    const minId = entity.name === afterEntity ? afterId : 0;
    const rows = db.prepare(`SELECT id FROM ${entity.table} WHERE id > ? ORDER BY id`).all(minId) as { id: number }[];
    for (const row of rows) {
      const uid = getUid(db, entity.name, row.id);
      if (!uid) continue;
      const snap = snapshotRow(db, entity.name, row.id);
      out.push({
        changeId: `snap-${uid}`,
        entity: entity.name,
        recordUid: uid,
        op: 'upsert',
        row: snap,
      });
      nextAfterEntity = entity.name;
      nextAfterId = row.id;
      if (out.length >= limit) return { changes: out, nextAfterEntity, nextAfterId };
    }
  }
  return { changes: out, nextAfterEntity, nextAfterId };
}
