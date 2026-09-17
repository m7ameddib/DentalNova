import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { consumeHashedOneTimeRow } from './one-time-token.util';

function pairingDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE sync_pairing_codes (
      code_hash TEXT PRIMARY KEY,
      clinic_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE clinic_signup_invites (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
  `);
  return db;
}

test('pairing code can be consumed only once', () => {
  const db = pairingDb();
  const now = '2026-09-17T12:00:00.000Z';
  db.prepare(`INSERT INTO sync_pairing_codes (code_hash, clinic_id, expires_at) VALUES (?, ?, ?)`).run(
    'hash-1',
    'clinic-a',
    '2026-09-17T12:10:00.000Z',
  );
  const first = consumeHashedOneTimeRow(db, { table: 'sync_pairing_codes', hash: 'hash-1', nowIso: now });
  const second = consumeHashedOneTimeRow(db, { table: 'sync_pairing_codes', hash: 'hash-1', nowIso: now });
  assert.deepEqual(first, { clinicId: 'clinic-a' });
  assert.equal(second, null);
  db.close();
});

test('expired or missing pairing codes are refused', () => {
  const db = pairingDb();
  db.prepare(`INSERT INTO sync_pairing_codes (code_hash, clinic_id, expires_at) VALUES (?, ?, ?)`).run(
    'hash-exp',
    'clinic-a',
    '2026-09-17T11:00:00.000Z',
  );
  assert.equal(
    consumeHashedOneTimeRow(db, {
      table: 'sync_pairing_codes',
      hash: 'hash-exp',
      nowIso: '2026-09-17T12:00:00.000Z',
    }),
    null,
  );
  assert.equal(
    consumeHashedOneTimeRow(db, {
      table: 'sync_pairing_codes',
      hash: 'missing',
      nowIso: '2026-09-17T12:00:00.000Z',
    }),
    null,
  );
  db.close();
});

test('signup invite can be consumed only once', () => {
  const db = pairingDb();
  const now = '2026-09-17T12:00:00.000Z';
  db.prepare(`INSERT INTO clinic_signup_invites (id, code_hash, expires_at) VALUES (?, ?, ?)`).run(
    'inv-1',
    'invite-hash',
    '2026-09-20T12:00:00.000Z',
  );
  assert.deepEqual(
    consumeHashedOneTimeRow(db, { table: 'clinic_signup_invites', hash: 'invite-hash', nowIso: now }),
    { clinicId: null },
  );
  assert.equal(
    consumeHashedOneTimeRow(db, { table: 'clinic_signup_invites', hash: 'invite-hash', nowIso: now }),
    null,
  );
  db.close();
});
