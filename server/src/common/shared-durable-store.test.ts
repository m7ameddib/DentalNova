import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { saveRateLimitWindows } from '../auth/auth-rate-limit.persist';
import { saveRevokedAdminJti } from '../dibnova-admin/admin-session.persist';
import {
  clearRateLimitWindow,
  closeSharedDurableStore,
  getRateLimitWindow,
  incrementRateLimitFailure,
  isAdminJtiRevoked,
  openSharedDurableStore,
  revokeAdminJti,
  sharedDurableDbPath,
} from './shared-durable-store';

test('rate-limit increments are visible to a second SQLite connection (multi-pod)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-shared-rl-'));
  const db1 = openSharedDurableStore(dir);
  const now = 5_000_000;
  incrementRateLimitFailure(db1, 'login:1.2.3.4:a', 60_000, now);
  incrementRateLimitFailure(db1, 'login:1.2.3.4:a', 60_000, now);

  const db2 = new Database(sharedDurableDbPath(dir));
  db2.pragma('busy_timeout = 5000');
  incrementRateLimitFailure(db2, 'login:1.2.3.4:a', 60_000, now);
  const window = getRateLimitWindow(db2, 'login:1.2.3.4:a', now);
  assert.equal(window?.count, 3);
  db2.close();
  closeSharedDurableStore(dir);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('admin JWT revoke is visible to a second process sharing the data dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-shared-jti-'));
  const db1 = openSharedDurableStore(dir);
  const exp = Date.now() + 60_000;
  revokeAdminJti(db1, 'jti-shared', exp);
  closeSharedDurableStore(dir);

  const db2 = openSharedDurableStore(dir);
  assert.equal(isAdminJtiRevoked(db2, 'jti-shared'), true);
  assert.equal(isAdminJtiRevoked(db2, 'other'), false);
  closeSharedDurableStore(dir);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('legacy JSON rate-limit and JTI files are imported once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnt-shared-import-'));
  const now = Date.now();
  saveRateLimitWindows(
    path.join(dir, 'auth-rate-limit.json'),
    new Map([['imported', { count: 4, resetAt: now + 60_000 }]]),
    now,
  );
  saveRevokedAdminJti(path.join(dir, 'admin-revoked-jti.json'), new Map([['old-jti', now + 60_000]]), now);
  const db = openSharedDurableStore(dir);
  assert.equal(getRateLimitWindow(db, 'imported', now)?.count, 4);
  assert.equal(isAdminJtiRevoked(db, 'old-jti', now), true);
  clearRateLimitWindow(db, 'imported');
  closeSharedDurableStore(dir);
  fs.rmSync(dir, { recursive: true, force: true });
});
