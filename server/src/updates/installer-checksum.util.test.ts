import test from 'node:test';
import assert from 'node:assert/strict';
import { assertInstallerChecksumPresent, missingInstallerChecksumMessage } from './installer-checksum.util';

test('updates refuse installers that have no published SHA-256 sidecar', () => {
  assert.throws(
    () => assertInstallerChecksumPresent(false, 'DNT-Dental-Main-Clinic-Setup-v1.1.17.exe'),
    /unsigned update/,
  );
  assert.doesNotThrow(() => assertInstallerChecksumPresent(true, 'DNT-Dental-Main-Clinic-Setup-v1.1.17.exe'));
  assert.match(missingInstallerChecksumMessage('setup.exe'), /\.sha256/);
});
