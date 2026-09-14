import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAdminAuditDetails } from './admin-audit.util';

test('redacts passwords, tokens, and API secrets from admin audit details', () => {
  const details = sanitizeAdminAuditDetails({
    clinicId: 'abc',
    newPassword: 'SuperSecret1',
    recoveryCode: 'DN-111-222',
    notes: 'support reset',
  });
  assert.ok(details);
  assert.match(details!, /abc/);
  assert.match(details!, /support reset/);
  assert.doesNotMatch(details!, /SuperSecret1/);
  assert.doesNotMatch(details!, /DN-111-222/);
  assert.match(details!, /\[redacted\]/);
});

test('returns null for empty details', () => {
  assert.equal(sanitizeAdminAuditDetails(null), null);
  assert.equal(sanitizeAdminAuditDetails(''), null);
  assert.equal(sanitizeAdminAuditDetails({}), null);
});
