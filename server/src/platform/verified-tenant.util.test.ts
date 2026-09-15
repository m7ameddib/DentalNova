import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import {
  ADMIN_JWT_AUDIENCE,
  ADMIN_JWT_ISSUER,
  ADMIN_JWT_PURPOSE,
  PASSWORD_RESET_JWT_ISSUER,
  SESSION_JWT_ISSUER,
  SYNC_DEVICE_JWT_ISSUER,
} from '../auth/jwt-payload.util';
import { clinicIdFromVerifiedBearer } from './verified-tenant.util';

const SESSION_SECRET = 'session-secret-for-tenant-tests';
const DEVICE_SECRET = 'device-secret-for-tenant-tests';
const ADMIN_SECRET = 'admin-secret-for-tenant-tests';
const RESET_SECRET = 'reset-secret-for-tenant-tests';

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyHs256(token: string, secret: string, issuer: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const actual = parts[2];
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length || !a.equals(b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    if (payload.iss !== issuer) return null;
    return payload;
  } catch {
    return null;
  }
}

function clinicId(authorization: string | undefined): string | undefined {
  return clinicIdFromVerifiedBearer(
    authorization,
    { sessionSecret: SESSION_SECRET, deviceSecret: DEVICE_SECRET },
    verifyHs256,
  );
}

test('verified session JWT binds clinicId', () => {
  const token = signHs256(
    { sub: 1, username: 'doc', roleName: 'doctor', clinicId: 'clinic-a', iss: SESSION_JWT_ISSUER },
    SESSION_SECRET,
  );
  assert.equal(clinicId(`Bearer ${token}`), 'clinic-a');
});

test('verified sync-device JWT binds clinicId', () => {
  const token = signHs256(
    { typ: 'sync-device', deviceId: 'dev-1', clinicId: 'clinic-b', iss: SYNC_DEVICE_JWT_ISSUER },
    DEVICE_SECRET,
  );
  assert.equal(clinicId(`Bearer ${token}`), 'clinic-b');
});

test('unsigned / forged Bearer payload does not bind a clinic', () => {
  const token = signHs256(
    { sub: 1, username: 'doc', roleName: 'doctor', clinicId: 'clinic-a', iss: SESSION_JWT_ISSUER },
    'wrong-secret',
  );
  assert.equal(clinicId(`Bearer ${token}`), undefined);
});

test('admin JWT does not bind a clinic tenant', () => {
  const token = signHs256(
    {
      sub: 0,
      username: 'dibadmin',
      roleName: 'dibnova_admin',
      dibnovaAdmin: true,
      purpose: ADMIN_JWT_PURPOSE,
      typ: 'dibnova-admin',
      iss: ADMIN_JWT_ISSUER,
      aud: ADMIN_JWT_AUDIENCE,
      clinicId: 'clinic-a',
    },
    ADMIN_SECRET,
  );
  assert.equal(clinicId(`Bearer ${token}`), undefined);
});

test('password-reset JWT does not bind a clinic tenant', () => {
  const token = signHs256(
    { sub: 1, username: 'doc', purpose: 'password_reset', clinicId: 'clinic-a', iss: PASSWORD_RESET_JWT_ISSUER },
    RESET_SECRET,
  );
  assert.equal(clinicId(`Bearer ${token}`), undefined);
});

test('missing Authorization does not bind a clinic', () => {
  assert.equal(clinicId(undefined), undefined);
  assert.equal(clinicId(''), undefined);
  assert.equal(clinicId('Basic abc'), undefined);
});
