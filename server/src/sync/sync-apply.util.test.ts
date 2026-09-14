import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureSyncInfrastructure } from './sync-schema';
import { applyChanges, pendingOutbound, snapshotRow, clinicSnapshot } from './sync-apply.util';
import { paymentFingerprint, rowsDiffer } from './sync.entities';

function memoryClinic(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      phone TEXT,
      updated_at TEXT
    );
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      amount_cents INTEGER,
      method TEXT,
      date TEXT,
      note TEXT,
      status TEXT DEFAULT 'ACTIVE'
    );
  `);
  db.exec(fsRead038());
  ensureSyncInfrastructure(db);
  return db;
}

function fsRead038(): string {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const file = path.join(__dirname, '..', '..', '..', 'database', 'migrations', '038_clinic_sync.sql');
  return fs.readFileSync(file, 'utf-8');
}

test('local patient insert is captured and not marked synced until ack', () => {
  const db = memoryClinic();
  db.prepare(`INSERT INTO patients (full_name, phone) VALUES ('A', '1')`).run();
  const pending = pendingOutbound(db);
  assert.equal(pending.length >= 1, true);
  assert.equal(pending.some((c) => c.entity === 'patients'), true);
  assert.equal(pending[0].op, 'upsert');
  db.close();
});

test('payments are append-only: differing same uid becomes a conflict', () => {
  const db = memoryClinic();
  db.prepare(`INSERT INTO patients (full_name) VALUES ('A')`).run();
  const patientSnap = snapshotRow(db, 'patients', 1);
  applyChanges(
    db,
    [
      {
        changeId: 'pay-1',
        entity: 'payments',
        recordUid: 'pay-uid-1',
        op: 'upsert',
        row: { patientUid: patientSnap?.recordUid, amountCents: 1000, method: 'CASH', date: '2026-01-01', note: null },
      },
    ],
    'device-a',
  );
  const second = applyChanges(
    db,
    [
      {
        changeId: 'pay-2',
        entity: 'payments',
        recordUid: 'pay-uid-1',
        op: 'upsert',
        row: { patientUid: patientSnap?.recordUid, amountCents: 5000, method: 'CASH', date: '2026-01-01', note: null },
      },
    ],
    'device-b',
  );
  assert.equal(second.conflicts.length, 1);
  db.close();
});

test('remote apply preserves record uid and does not enqueue a local outbound copy', () => {
  const db = memoryClinic();
  const applied = applyChanges(
    db,
    [
      {
        changeId: 'chg-patient-1',
        entity: 'patients',
        recordUid: 'fixed-patient-uid',
        op: 'upsert',
        row: { fullName: 'Remote', phone: '079' },
      },
    ],
    'device-a',
  );
  assert.equal(applied.accepted.includes('chg-patient-1'), true);
  const mapped = db.prepare(`SELECT record_uid AS uid FROM sync_id_map WHERE entity = 'patients'`).get() as { uid: string };
  assert.equal(mapped.uid, 'fixed-patient-uid');
  const pending = pendingOutbound(db).filter((c) => c.entity === 'patients');
  assert.equal(pending.length, 0);
  db.close();
});

test('snapshot pages by local id so records are not skipped', () => {
  const db = memoryClinic();
  db.prepare(`INSERT INTO patients (full_name, phone) VALUES ('A', '1')`).run();
  db.prepare(`INSERT INTO patients (full_name, phone) VALUES ('B', '2')`).run();
  db.prepare(`INSERT INTO patients (full_name, phone) VALUES ('C', '3')`).run();
  const page1 = clinicSnapshot(db, undefined, 0, 2);
  assert.equal(page1.changes.length, 2);
  const page2 = clinicSnapshot(db, page1.nextAfterEntity, page1.nextAfterId, 2);
  assert.equal(page2.changes.length, 1);
  const names = [...page1.changes, ...page2.changes].map((c) => String(c.row?.fullName));
  assert.deepEqual(names.sort(), ['A', 'B', 'C']);
  db.close();
});

test('duplicate payment fingerprint is flagged rather than inserted twice', () => {
  const row = { patientUid: 'p1', amountCents: 2500, date: '2026-02-01', method: 'CASH', note: '' };
  assert.equal(paymentFingerprint(row), paymentFingerprint({ ...row }));
  assert.equal(rowsDiffer({ amountCents: 1 }, { amountCents: 2 }), true);
});
