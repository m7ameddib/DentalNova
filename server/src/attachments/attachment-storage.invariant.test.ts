import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function repoRoot(): string {
  const candidates = [process.cwd(), join(process.cwd(), '..'), join(process.cwd(), '../..')];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'database/migrations/004_settings_payments_files.sql'))) return dir;
  }
  throw new Error('DentalNova repo root not found');
}

test('patient_attachments stores path metadata only — no SQLite BLOBs', () => {
  const sql = readFileSync(join(repoRoot(), 'database/migrations/004_settings_payments_files.sql'), 'utf8');
  const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS patient_attachments \(([\s\S]*?)\);/);
  assert.ok(tableMatch, 'patient_attachments table is defined');
  const body = tableMatch[1];
  assert.match(body, /stored_path\s+TEXT NOT NULL/);
  assert.doesNotMatch(body, /\bBLOB\b/i);
  assert.doesNotMatch(body, /file_bytes|content_base64|file_data|image_blob/i);
  assert.match(sql, /only metadata \+ relative path is stored here \(never file contents\)/);
});

test('attachment insert SQL writes stored_path, not file bytes', () => {
  const source = readFileSync(
    join(repoRoot(), 'server/src/database/repositories/patient-attachments.repository.ts'),
    'utf8',
  );
  assert.match(source, /INSERT INTO patient_attachments/);
  assert.match(source, /stored_path/);
  assert.doesNotMatch(source, /file_bytes|content_base64|BLOB/i);
});
