import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_JWT_AUDIENCE,
  ADMIN_JWT_ISSUER,
  ADMIN_JWT_PURPOSE,
  ADMIN_JWT_ROLE,
  isAdminJwtPayload,
  isPasswordResetPayload,
  isSessionJwtPayload,
  isSyncDevicePayload,
  isValidAdminJwtPayload,
} from './jwt-payload.util';

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

test('DibNova admin tokens are not clinic session JWTs', () => {
  const admin = {
    sub: 0,
    username: 'dibadmin',
    roleName: ADMIN_JWT_ROLE,
    dibnovaAdmin: true,
    purpose: ADMIN_JWT_PURPOSE,
    typ: 'dibnova-admin',
    iss: ADMIN_JWT_ISSUER,
    aud: ADMIN_JWT_AUDIENCE,
  };
  assert.equal(isAdminJwtPayload(admin), true);
  assert.equal(isValidAdminJwtPayload(admin), true);
  assert.equal(isSessionJwtPayload(admin), false);
});

test('clinic session payload with forged admin flag is still not a valid admin JWT', () => {
  const forged = { sub: 1, username: 'doc', roleName: 'doctor', clinicId: 'c1', dibnovaAdmin: true };
  assert.equal(isAdminJwtPayload(forged), true);
  assert.equal(isValidAdminJwtPayload(forged), false);
  assert.equal(isSessionJwtPayload(forged), false);
});

test('normal clinic session payload is accepted', () => {
  assert.equal(isSessionJwtPayload({ sub: 1, username: 'doc', roleName: 'doctor', clinicId: 'c1' }), true);
  assert.equal(isAdminJwtPayload({ sub: 1, username: 'doc', roleName: 'doctor', clinicId: 'c1' }), false);
});
