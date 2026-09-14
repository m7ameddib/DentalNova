import test from 'node:test';
import assert from 'node:assert/strict';
import { isPasswordResetPayload, isSessionJwtPayload, isSyncDevicePayload } from './jwt-payload.util';

test('password-reset tokens are not session JWTs', () => {
  const reset = { sub: 1, username: 'doc', purpose: 'password_reset' };
  assert.equal(isPasswordResetPayload(reset), true);
  assert.equal(isSessionJwtPayload(reset), false);
});

test('device sync tokens are not session JWTs', () => {
  const device = { sub: 0, typ: 'sync-device', clinicId: 'abc', deviceId: 'd1' };
  assert.equal(isSyncDevicePayload(device), true);
  assert.equal(isSessionJwtPayload(device), false);
});

test('normal clinic session payload is accepted', () => {
  assert.equal(isSessionJwtPayload({ sub: 1, username: 'doc', roleName: 'doctor', clinicId: 'c1' }), true);
});
