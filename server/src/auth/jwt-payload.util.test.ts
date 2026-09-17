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
  isWeakJwtSecret,
  SYNC_DEVICE_JWT_ISSUER,
} from './jwt-payload.util';

test('password-reset tokens are not session JWTs', () => {
  const reset = { sub: 1, username: 'doc', purpose: 'password_reset' };
  assert.equal(isPasswordResetPayload(reset), true);
  assert.equal(isSessionJwtPayload(reset), false);
});

test('device sync tokens with dentalnova-sync-device issuer are not session JWTs', () => {
  const device = { sub: 0, typ: 'sync-device', clinicId: 'abc', deviceId: 'd1' };
  assert.equal(isSyncDevicePayload(device), true);
  assert.equal(isSessionJwtPayload(device), false);
  assert.equal(isSyncDevicePayload({ iss: SYNC_DEVICE_JWT_ISSUER, sub: 0 }), true);
  assert.equal(isSessionJwtPayload({ iss: SYNC_DEVICE_JWT_ISSUER, sub: 1, username: 'doc', roleName: 'doctor' }), false);
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

test('weak JWT secrets include placeholders and short values', () => {
  assert.equal(isWeakJwtSecret(''), true);
  assert.equal(isWeakJwtSecret('dev-secret'), true);
  assert.equal(isWeakJwtSecret('short'), true);
  assert.equal(isWeakJwtSecret('security-sync-test-jwt-secret-value-32ch'), false);
});
