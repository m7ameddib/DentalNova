import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { clinicOperationalCensus } from './clinic-census.util';

test('empty clinic with only catalogs is not populated', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE treatment_types (id INTEGER PRIMARY KEY, label TEXT);
    INSERT INTO treatment_types (label) VALUES ('Exam');
    CREATE TABLE patients (id INTEGER PRIMARY KEY, full_name TEXT, archived_at TEXT);
  `);
  const census = clinicOperationalCensus(db);
  assert.equal(census.populated, false);
  assert.equal(census.counts.patients, 0);
  db.close();
});

test('a patient row blocks automatic pairing', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patients (id INTEGER PRIMARY KEY, full_name TEXT, archived_at TEXT);
    INSERT INTO patients (full_name) VALUES ('A');
  `);
  const census = clinicOperationalCensus(db);
  assert.equal(census.populated, true);
  assert.equal(census.counts.patients, 1);
  db.close();
});

test('archived-only patients do not count as populated', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE patients (id INTEGER PRIMARY KEY, full_name TEXT, archived_at TEXT);
    INSERT INTO patients (full_name, archived_at) VALUES ('Old', datetime('now'));
  `);
  assert.equal(clinicOperationalCensus(db).populated, false);
  db.close();
});
