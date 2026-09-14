import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAuthenticodeTrusted,
  inspectAuthenticodePayload,
  unsignedInstallerMessage,
} from './installer-authenticode.util';

test('unsigned Authenticode status is refused', () => {
  const inspection = inspectAuthenticodePayload({ Status: 'NotSigned' });
  assert.equal(inspection.status, 'NotSigned');
  assert.throws(
    () => assertAuthenticodeTrusted(inspection, 'setup.exe'),
    (err: Error) => err.message === unsignedInstallerMessage('setup.exe'),
  );
});

test('valid signature is accepted and publisher can be pinned', () => {
  const inspection = inspectAuthenticodePayload({
    Status: 'Valid',
    SignerCertificate: { Subject: 'CN=DibNova LLC, O=DibNova' },
  });
  assert.doesNotThrow(() => assertAuthenticodeTrusted(inspection, 'setup.exe'));
  assert.doesNotThrow(() => assertAuthenticodeTrusted(inspection, 'setup.exe', 'DibNova'));
  assert.throws(() => assertAuthenticodeTrusted(inspection, 'setup.exe', 'Contoso'));
});
