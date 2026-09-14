import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLegacyDevLicensePayload,
  isLicenseExpiryDue,
  reconstructLicenseText,
  unsignedLicensePermitted,
} from './license-state.util';

test('reconstructLicenseText matches the on-disk payload.signature format', () => {
  const payload = '{"product":"DNT Dental"}';
  const text = reconstructLicenseText(payload, 'sig');
  const [b64, sig] = text.split('.');
  assert.equal(sig, 'sig');
  assert.equal(Buffer.from(b64, 'base64url').toString('utf8'), payload);
});

test('expiry treats missing expiresAt as not expired and past dates as expired', () => {
  assert.equal(isLicenseExpiryDue(null), false);
  assert.equal(isLicenseExpiryDue('1999-01-01T00:00:00.000Z', Date.parse('2000-01-01T00:00:00.000Z')), true);
  assert.equal(isLicenseExpiryDue('2099-01-01T00:00:00.000Z', Date.parse('2000-01-01T00:00:00.000Z')), false);
});

test('legacyDev payloads are detected; unsigned licenses are production-forbidden', () => {
  assert.equal(isLegacyDevLicensePayload('{"legacyDev":true,"product":"DNT Dental"}'), true);
  assert.equal(isLegacyDevLicensePayload('{"product":"DNT Dental"}'), false);
  assert.equal(unsignedLicensePermitted(true), false);
  assert.equal(unsignedLicensePermitted(false), true);
});
