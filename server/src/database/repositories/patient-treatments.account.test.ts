import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { DatabaseService } from '../database.service';
import { PatientTreatmentsRepository } from './patient-treatments.repository';
import { PatientsRepository } from './patients.repository';
import { remainingCents } from '../../common/money.util';

function memoryRepos() {
  const connection = new Database(':memory:');
  connection.exec(`
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_number TEXT UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      archived_at TEXT
    );
    CREATE TABLE treatment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      abbreviation TEXT,
      label TEXT,
      color_hex TEXT DEFAULT '#000000'
    );
    CREATE TABLE patient_treatments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      treatment_type_id INTEGER NOT NULL REFERENCES treatment_types(id),
      tooth_number INTEGER,
      price_cents INTEGER NOT NULL DEFAULT 0,
      base_amount_cents INTEGER NOT NULL DEFAULT 0,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      final_amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE patient_treatment_teeth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      treatment_id INTEGER NOT NULL REFERENCES patient_treatments(id) ON DELETE CASCADE,
      tooth_number INTEGER NOT NULL
    );
    CREATE TABLE account_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
  `);
  connection.prepare(`INSERT INTO treatment_types (code, abbreviation, label) VALUES ('FILLING', 'F', 'Filling')`).run();
  const db = { connection } as DatabaseService;
  return {
    connection,
    treatments: new PatientTreatmentsRepository(db),
    patients: new PatientsRepository(db),
  };
}

function insertPatient(connection: Database.Database, name = 'Ada'): number {
  const result = connection
    .prepare(`INSERT INTO patients (file_number, full_name, phone) VALUES (?, ?, ?)`)
    .run(`P-${name}`, name, '0500000000');
  return Number(result.lastInsertRowid);
}

function insertTreatment(
  connection: Database.Database,
  patientId: number,
  amountCents: number,
  status: string,
): number {
  const result = connection
    .prepare(
      `INSERT INTO patient_treatments
        (patient_id, treatment_type_id, price_cents, base_amount_cents, final_amount_cents, status)
       VALUES (?, 1, ?, ?, ?, ?)`,
    )
    .run(patientId, amountCents, amountCents, amountCents, status);
  return Number(result.lastInsertRowid);
}

test('adding a planned treatment immediately includes its amount in account due', () => {
  const { connection, treatments, patients } = memoryRepos();
  const patientId = insertPatient(connection);
  insertTreatment(connection, patientId, 12_000, 'PLANNED');
  assert.equal(treatments.totalCostForPatient(patientId), 12_000);
  const outstanding = patients.findOutstanding();
  assert.equal(outstanding.length, 1);
  assert.equal(outstanding[0].remainingCents, 12_000);
  connection.close();
});

test('completing a treatment does not create another charge', () => {
  const { connection, treatments } = memoryRepos();
  const patientId = insertPatient(connection);
  const treatmentId = insertTreatment(connection, patientId, 12_000, 'PLANNED');
  assert.equal(treatments.totalCostForPatient(patientId), 12_000);
  connection.prepare(`UPDATE patient_treatments SET status = 'COMPLETED' WHERE id = ?`).run(treatmentId);
  assert.equal(treatments.totalCostForPatient(patientId), 12_000);
  connection.prepare(`UPDATE patient_treatments SET status = 'COMPLETED' WHERE id = ?`).run(treatmentId);
  assert.equal(treatments.totalCostForPatient(patientId), 12_000);
  connection.close();
});

test('reloading the patient still counts the same treatment once', () => {
  const { connection, treatments } = memoryRepos();
  const patientId = insertPatient(connection);
  insertTreatment(connection, patientId, 9_000, 'IN_PROGRESS');
  assert.equal(treatments.totalCostForPatient(patientId), 9_000);
  assert.equal(treatments.totalCostForPatient(patientId), 9_000);
  connection.close();
});

test('editing a treatment updates the existing charge instead of adding another', () => {
  const { connection, treatments } = memoryRepos();
  const patientId = insertPatient(connection);
  const treatmentId = insertTreatment(connection, patientId, 8_000, 'PLANNED');
  connection
    .prepare(`UPDATE patient_treatments SET final_amount_cents = ?, price_cents = ?, base_amount_cents = ? WHERE id = ?`)
    .run(11_000, 11_000, 11_000, treatmentId);
  assert.equal(treatments.totalCostForPatient(patientId), 11_000);
  connection.close();
});

test('void and delete remove the associated amount; remaining stays >= 0', () => {
  const { connection, treatments, patients } = memoryRepos();
  const patientId = insertPatient(connection);
  const first = insertTreatment(connection, patientId, 5_000, 'PLANNED');
  const second = insertTreatment(connection, patientId, 7_000, 'COMPLETED');
  assert.equal(treatments.totalCostForPatient(patientId), 12_000);
  connection.prepare(`UPDATE patient_treatments SET status = 'VOID' WHERE id = ?`).run(first);
  assert.equal(treatments.totalCostForPatient(patientId), 7_000);
  treatments.delete(second);
  assert.equal(treatments.totalCostForPatient(patientId), 0);
  connection.prepare(`INSERT INTO payments (patient_id, amount_cents) VALUES (?, ?)`).run(patientId, 4_000);
  const outstanding = patients.findOutstanding();
  assert.equal(outstanding.length, 0);
  assert.equal(remainingCents(treatments.totalCostForPatient(patientId), 4_000), 0);
  connection.close();
});

test('the same treatment is never counted twice even with mixed statuses', () => {
  const { connection, treatments } = memoryRepos();
  const patientId = insertPatient(connection);
  insertTreatment(connection, patientId, 3_000, 'PLANNED');
  insertTreatment(connection, patientId, 4_000, 'COMPLETED');
  insertTreatment(connection, patientId, 2_000, 'VOID');
  assert.equal(treatments.totalCostForPatient(patientId), 7_000);
  assert.equal(treatments.totalFinalAmountAll(), 7_000);
  connection.close();
});
