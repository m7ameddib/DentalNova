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

test('user apply links by username and never writes password_hash or role_id', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      full_name TEXT
    );
    CREATE TABLE patients (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT, phone TEXT);
    CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER, amount_cents INTEGER, method TEXT, date TEXT, note TEXT, status TEXT DEFAULT 'ACTIVE');
  `);
  db.exec(fsRead038());
  ensureSyncInfrastructure(db);
  db.prepare(`INSERT INTO users (username, password_hash, role_id, full_name) VALUES ('doc', 'LOCAL-HASH', 1, 'Local Doctor')`).run();
  const result = applyChanges(
    db,
    [
      {
        changeId: 'user-1',
        entity: 'users',
        recordUid: 'user-uid-online',
        op: 'upsert',
        row: { username: 'doc', passwordHash: 'REMOTE-HASH', roleId: 99, fullName: 'Remote Doctor' },
      },
    ],
    'device-a',
  );
  assert.equal(result.accepted.includes('user-1'), true);
  const user = db.prepare(`SELECT password_hash AS hash, role_id AS roleId, full_name AS name FROM users WHERE username = 'doc'`).get() as {
    hash: string;
    roleId: number;
    name: string;
  };
  assert.equal(user.hash, 'LOCAL-HASH');
  assert.equal(user.roleId, 1);
  assert.equal(user.name, 'Local Doctor');
  const mapped = db.prepare(`SELECT record_uid AS uid FROM sync_id_map WHERE entity = 'users' AND local_id = 1`).get() as { uid: string };
  assert.equal(mapped.uid, 'user-uid-online');
  db.close();
});

test('unknown remote usernames are not inserted', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL
    );
    CREATE TABLE patients (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT);
    CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER);
  `);
  db.exec(fsRead038());
  ensureSyncInfrastructure(db);
  const result = applyChanges(
    db,
    [
      {
        changeId: 'user-new',
        entity: 'users',
        recordUid: 'user-uid-new',
        op: 'upsert',
        row: { username: 'stranger', passwordHash: 'x', roleId: 1, fullName: 'Stranger' },
      },
    ],
    'device-a',
  );
  assert.equal(result.conflicts.some((c) => c.reason === 'user-unlinked'), true);
  const count = db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number };
  assert.equal(count.c, 0);
  db.close();
});

test('file_number collision remints instead of failing UNIQUE', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      phone TEXT,
      file_number TEXT UNIQUE
    );
    CREATE TABLE payments (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER);
  `);
  db.exec(fsRead038());
  ensureSyncInfrastructure(db);
  db.prepare(`INSERT INTO patients (full_name, phone, file_number) VALUES ('Local', '1', 'P-000007')`).run();
  const result = applyChanges(
    db,
    [
      {
        changeId: 'p-collide',
        entity: 'patients',
        recordUid: 'patient-uid-b',
        op: 'upsert',
        row: { fullName: 'Remote', phone: '2', fileNumber: 'P-000007' },
      },
    ],
    'device-a',
  );
  assert.equal(result.conflicts.some((c) => c.reason === 'file-number-collision'), true);
  const files = db.prepare(`SELECT file_number AS n FROM patients ORDER BY id`).all() as { n: string }[];
  assert.deepEqual(files.map((r) => r.n).sort(), ['P-000007', 'P-000008']);
  db.close();
});

test('tombstoned records are not resurrected by a later upsert', () => {
  const db = memoryClinic();
  applyChanges(
    db,
    [
      {
        changeId: 'del-1',
        entity: 'patients',
        recordUid: 'gone-uid',
        op: 'delete',
        row: null,
      },
    ],
    'device-a',
  );
  const resurrect = applyChanges(
    db,
    [
      {
        changeId: 'up-1',
        entity: 'patients',
        recordUid: 'gone-uid',
        op: 'upsert',
        row: { fullName: 'Zombie', phone: '000' },
      },
    ],
    'device-a',
  );
  assert.equal(resurrect.conflicts.some((c) => c.reason === 'tombstone-block'), true);
  const count = db.prepare(`SELECT COUNT(*) AS c FROM patients`).get() as { c: number };
  assert.equal(count.c, 0);
  db.close();
});

test('syncing a treatment then completing the same uid does not duplicate the charge', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      phone TEXT,
      updated_at TEXT
    );
    CREATE TABLE treatment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT
    );
    CREATE TABLE patient_treatments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      treatment_type_id INTEGER,
      final_amount_cents INTEGER,
      status TEXT,
      updated_at TEXT
    );
  `);
  db.exec(fsRead038());
  ensureSyncInfrastructure(db);
  db.prepare(`INSERT INTO patients (full_name) VALUES ('Ada')`).run();
  db.prepare(`INSERT INTO treatment_types (label) VALUES ('Filling')`).run();
  const patientSnap = snapshotRow(db, 'patients', 1);
  const typeSnap = snapshotRow(db, 'treatment_types', 1);
  const first = applyChanges(
    db,
    [
      {
        changeId: 'tx-1',
        entity: 'patient_treatments',
        recordUid: 'tx-uid-1',
        op: 'upsert',
        row: {
          patientUid: patientSnap?.recordUid,
          treatmentTypeUid: typeSnap?.recordUid,
          finalAmountCents: 12000,
          status: 'PLANNED',
        },
      },
    ],
    'device-a',
  );
  assert.equal(first.accepted.includes('tx-1'), true);
  const afterAdd = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(final_amount_cents), 0) AS total
       FROM patient_treatments WHERE status != 'VOID'`,
    )
    .get() as { c: number; total: number };
  assert.equal(afterAdd.c, 1);
  assert.equal(afterAdd.total, 12000);

  const complete = applyChanges(
    db,
    [
      {
        changeId: 'tx-2',
        entity: 'patient_treatments',
        recordUid: 'tx-uid-1',
        op: 'upsert',
        row: {
          patientUid: patientSnap?.recordUid,
          treatmentTypeUid: typeSnap?.recordUid,
          finalAmountCents: 12000,
          status: 'COMPLETED',
        },
      },
    ],
    'device-b',
  );
  assert.equal(complete.conflicts.length, 0);
  const afterComplete = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(final_amount_cents), 0) AS total, status
       FROM patient_treatments WHERE status != 'VOID'`,
    )
    .get() as { c: number; total: number; status: string };
  assert.equal(afterComplete.c, 1);
  assert.equal(afterComplete.total, 12000);
  assert.equal(afterComplete.status, 'COMPLETED');
  db.close();
});

test('treatment teeth snapshot maps treatment_id to treatmentUid, not the local integer id', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT,
      phone TEXT
    );
    CREATE TABLE treatment_types (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT);
    CREATE TABLE patient_treatments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      treatment_type_id INTEGER,
      final_amount_cents INTEGER,
      status TEXT
    );
    CREATE TABLE patient_treatment_teeth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      treatment_id INTEGER NOT NULL,
      tooth_number INTEGER NOT NULL
    );
    CREATE TABLE lab_names (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);
    CREATE TABLE lab_account_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lab_name_id INTEGER NOT NULL,
      amount_cents INTEGER,
      payment_method TEXT,
      payment_date TEXT
    );
  `);
  db.exec(fsRead038());
  ensureSyncInfrastructure(db);
  db.prepare(`INSERT INTO patients (full_name) VALUES ('Ada')`).run();
  db.prepare(`INSERT INTO treatment_types (label) VALUES ('Filling')`).run();
  db.prepare(
    `INSERT INTO patient_treatments (patient_id, treatment_type_id, final_amount_cents, status) VALUES (1, 1, 5000, 'PLANNED')`,
  ).run();
  db.prepare(`INSERT INTO patient_treatment_teeth (treatment_id, tooth_number) VALUES (1, 16)`).run();
  const treatmentSnap = snapshotRow(db, 'patient_treatments', 1);
  const toothSnap = snapshotRow(db, 'patient_treatment_teeth', 1);
  assert.equal(toothSnap?.treatmentUid, treatmentSnap?.recordUid);
  assert.equal(toothSnap?.treatmentId, undefined);

  db.prepare(`INSERT INTO lab_names (name) VALUES ('Cairo Lab')`).run();
  db.prepare(
    `INSERT INTO lab_account_payments (lab_name_id, amount_cents, payment_method, payment_date) VALUES (1, 1000, 'CASH', '2026-01-01')`,
  ).run();
  const labSnap = snapshotRow(db, 'lab_names', 1);
  const paySnap = snapshotRow(db, 'lab_account_payments', 1);
  assert.equal(paySnap?.labNameUid, labSnap?.recordUid);
  assert.equal(paySnap?.laboratoryId, undefined);
  db.close();
});


