import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertInstallerChecksumPresent,
  assertSha256Match,
  missingInstallerChecksumMessage,
  parseSha256Text,
} from './installer-checksum.util';

test('updates refuse installers that have no published SHA-256 sidecar', () => {
  assert.throws(
    () => assertInstallerChecksumPresent(false, 'DNT-Dental-Main-Clinic-Setup-v1.1.17.exe'),
    /unsigned update/,
  );
  assert.doesNotThrow(() => assertInstallerChecksumPresent(true, 'DNT-Dental-Main-Clinic-Setup-v1.1.17.exe'));
  assert.match(missingInstallerChecksumMessage('setup.exe'), /\.sha256/);
});

test('launch path re-checks the stored SHA-256 sidecar', () => {
  assert.equal(parseSha256Text('abcDEF  setup.exe'), 'abcdef');
  assert.doesNotThrow(() => assertSha256Match('aa', 'aa', 'setup.exe'));
  assert.throws(() => assertSha256Match('aa', 'bb', 'setup.exe'), /SHA-256/);
});
