import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { isFileNumberCollision, nextPatientFileNumber } from './file-number.util';

test('next file number uses MAX numeric suffix, not last row id', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE patients (id INTEGER PRIMARY KEY AUTOINCREMENT, file_number TEXT UNIQUE)`);
  db.prepare(`INSERT INTO patients (id, file_number) VALUES (1, 'P-000099')`).run();
  db.prepare(`INSERT INTO patients (id, file_number) VALUES (2, 'P-000001')`).run();
  assert.equal(nextPatientFileNumber(db), 'P-000100');
  db.close();
});

test('empty patients table starts at P-000001', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE patients (id INTEGER PRIMARY KEY, file_number TEXT)`);
  assert.equal(nextPatientFileNumber(db), 'P-000001');
  db.close();
});

test('file-number unique collisions are detected without treating other constraints as retries', () => {
  assert.equal(
    isFileNumberCollision(
      Object.assign(new Error('UNIQUE constraint failed: patients.file_number'), {
        code: 'SQLITE_CONSTRAINT_UNIQUE',
      }),
    ),
    true,
  );
  assert.equal(
    isFileNumberCollision(
      Object.assign(new Error('UNIQUE constraint failed: patients.phone'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }),
    ),
    false,
  );
});
