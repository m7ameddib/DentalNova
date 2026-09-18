import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { loadRateLimitWindows, rateLimitFilePath, RateLimitWindow } from '../auth/auth-rate-limit.persist';
import { adminRevokedFilePath, loadRevokedAdminJti } from '../dibnova-admin/admin-session.persist';

export const SHARED_DURABLE_FILE = 'shared-durable.db';

const OPEN = new Map<string, Database.Database>();

export function sharedDurableDbPath(configDir: string): string {
  return path.join(configDir, SHARED_DURABLE_FILE);
}

/**
 * Process-shared SQLite used for auth rate limits and admin JWT revocation.
 * Multiple Online processes that share DNT_DATA_DIR see the same counters
 * (WAL + busy_timeout). JSON files from earlier builds are imported once.
 */
export function openSharedDurableStore(configDir: string): Database.Database {
  const resolved = path.resolve(configDir);
  const existing = OPEN.get(resolved);
  if (existing) return existing;
  fs.mkdirSync(resolved, { recursive: true });
  const db = new Database(sharedDurableDbPath(resolved));
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_windows (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_revoked_jti (
      jti TEXT PRIMARY KEY,
      exp_ms INTEGER NOT NULL
    );
  `);
  importLegacyJson(db, resolved);
  OPEN.set(resolved, db);
  return db;
}

export function closeSharedDurableStore(configDir: string): void {
  const resolved = path.resolve(configDir);
  const db = OPEN.get(resolved);
  if (!db) return;
  db.close();
  OPEN.delete(resolved);
}

function importLegacyJson(db: Database.Database, configDir: string): void {
  const now = Date.now();
  const rateCount = (db.prepare(`SELECT COUNT(*) AS c FROM rate_limit_windows`).get() as { c: number }).c;
  if (rateCount === 0) {
    const windows = loadRateLimitWindows(rateLimitFilePath(configDir), now);
    const insert = db.prepare(`INSERT OR REPLACE INTO rate_limit_windows (key, count, reset_at) VALUES (?, ?, ?)`);
    const txn = db.transaction(() => {
      for (const [key, value] of windows) {
        insert.run(key, value.count, value.resetAt);
      }
    });
    txn();
  }
  const jtiCount = (db.prepare(`SELECT COUNT(*) AS c FROM admin_revoked_jti`).get() as { c: number }).c;
  if (jtiCount === 0) {
    const revoked = loadRevokedAdminJti(adminRevokedFilePath(configDir), now);
    const insert = db.prepare(`INSERT OR REPLACE INTO admin_revoked_jti (jti, exp_ms) VALUES (?, ?)`);
    const txn = db.transaction(() => {
      for (const [jti, expMs] of revoked) {
        insert.run(jti, expMs);
      }
    });
    txn();
  }
}

export function getRateLimitWindow(db: Database.Database, key: string, now = Date.now()): RateLimitWindow | null {
  const row = db.prepare(`SELECT count, reset_at AS resetAt FROM rate_limit_windows WHERE key = ?`).get(key) as
    | { count: number; resetAt: number }
    | undefined;
  if (!row || row.resetAt <= now) return null;
  return { count: row.count, resetAt: row.resetAt };
}

export function incrementRateLimitFailure(
  db: Database.Database,
  key: string,
  windowMs: number,
  now = Date.now(),
): RateLimitWindow {
  const resetAt = now + windowMs;
  db.prepare(
    `INSERT INTO rate_limit_windows (key, count, reset_at) VALUES (@key, 1, @resetAt)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limit_windows.reset_at <= @now THEN 1 ELSE rate_limit_windows.count + 1 END,
       reset_at = CASE WHEN rate_limit_windows.reset_at <= @now THEN @resetAt ELSE rate_limit_windows.reset_at END`,
  ).run({ key, resetAt, now });
  return getRateLimitWindow(db, key, now) ?? { count: 1, resetAt };
}

export function clearRateLimitWindow(db: Database.Database, key: string): void {
  db.prepare(`DELETE FROM rate_limit_windows WHERE key = ?`).run(key);
}

export function pruneExpiredRateLimits(db: Database.Database, now = Date.now()): void {
  db.prepare(`DELETE FROM rate_limit_windows WHERE reset_at <= ?`).run(now);
}

export function revokeAdminJti(db: Database.Database, jti: string, expMs: number): void {
  const id = jti.trim();
  if (!id) return;
  db.prepare(`INSERT OR REPLACE INTO admin_revoked_jti (jti, exp_ms) VALUES (?, ?)`).run(id, expMs);
}

export function isAdminJtiRevoked(db: Database.Database, jti: string | undefined | null, now = Date.now()): boolean {
  if (!jti?.trim()) return false;
  const row = db.prepare(`SELECT exp_ms AS expMs FROM admin_revoked_jti WHERE jti = ?`).get(jti.trim()) as
    | { expMs: number }
    | undefined;
  if (!row) return false;
  if (row.expMs <= now) {
    db.prepare(`DELETE FROM admin_revoked_jti WHERE jti = ?`).run(jti.trim());
    return false;
  }
  return true;
}

export function pruneExpiredAdminJti(db: Database.Database, now = Date.now()): void {
  db.prepare(`DELETE FROM admin_revoked_jti WHERE exp_ms <= ?`).run(now);
}
