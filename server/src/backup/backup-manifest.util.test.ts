import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backupClinicMismatch,
  backupHashMismatch,
  backupInstallationMismatch,
  sha256Buffer,
} from './backup-manifest.util';

test('clinic restore is refused when Online clinic ids differ', () => {
  assert.equal(backupClinicMismatch('clinic-a', 'clinic-b'), true);
  assert.equal(backupClinicMismatch('clinic-a', 'clinic-a'), false);
  assert.equal(backupClinicMismatch(null, 'clinic-a'), false);
  assert.equal(backupClinicMismatch('clinic-a', null), false);
});

test('legacy backups without a hash still restore; a present hash must match', () => {
  const hash = sha256Buffer(Buffer.from('clinic.db'));
  assert.equal(backupHashMismatch(undefined, hash), false);
  assert.equal(backupHashMismatch(hash, hash), false);
  assert.equal(backupHashMismatch('deadbeef', hash), true);
});

test('offline installation ids must match when both are present', () => {
  assert.equal(backupInstallationMismatch('inst-1', 'inst-2'), true);
  assert.equal(backupInstallationMismatch('inst-1', 'inst-1'), false);
});
