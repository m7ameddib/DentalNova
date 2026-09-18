import { AdminJwtPayload, JwtPayload, PasswordResetJwtPayload } from './auth.types';

export const SESSION_JWT_ISSUER = 'dentalnova-session';
export const PASSWORD_RESET_JWT_ISSUER = 'dentalnova-password-reset';
export const SYNC_DEVICE_JWT_ISSUER = 'dentalnova-sync-device';
export const ADMIN_JWT_ISSUER = 'dentalnova-admin';
export const ADMIN_JWT_AUDIENCE = 'dibnova-admin';
export const ADMIN_JWT_PURPOSE = 'dibnova_admin';
export const ADMIN_JWT_ROLE = 'dibnova_admin';

export const DEV_JWT_SECRET = 'dev-secret';

export function isPasswordResetPayload(payload: unknown): payload is PasswordResetJwtPayload {
  if (!payload || typeof payload !== 'object') return false;
  const rec = payload as Record<string, unknown>;
  return rec.purpose === 'password_reset' || rec.iss === PASSWORD_RESET_JWT_ISSUER;
}

export function isSyncDevicePayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const rec = payload as Record<string, unknown>;
  return rec.typ === 'sync-device' || rec.iss === SYNC_DEVICE_JWT_ISSUER;
}

export function isAdminJwtPayload(payload: unknown): payload is AdminJwtPayload {
  if (!payload || typeof payload !== 'object') return false;
  const rec = payload as Record<string, unknown>;
  if (rec.iss === ADMIN_JWT_ISSUER) return true;
  if (rec.aud === ADMIN_JWT_AUDIENCE) return true;
  if (rec.purpose === ADMIN_JWT_PURPOSE) return true;
  if (rec.typ === 'dibnova-admin') return true;
  return rec.dibnovaAdmin === true;
}

/** Session JWTs must never be password-reset, device-sync, or DibNova admin tokens. */
export function isSessionJwtPayload(payload: JwtPayload | Record<string, unknown>): boolean {
  if (isPasswordResetPayload(payload)) return false;
  if (isSyncDevicePayload(payload)) return false;
  if (isAdminJwtPayload(payload)) return false;
  return true;
}

export function isValidAdminJwtPayload(payload: unknown): payload is AdminJwtPayload {
  if (!isAdminJwtPayload(payload)) return false;
  const rec = payload as AdminJwtPayload;
  if (rec.dibnovaAdmin !== true) return false;
  if (rec.purpose !== ADMIN_JWT_PURPOSE) return false;
  if (rec.roleName !== ADMIN_JWT_ROLE) return false;
  if (rec.iss && rec.iss !== ADMIN_JWT_ISSUER) return false;
  const aud = rec.aud;
  if (typeof aud === 'string' && aud !== ADMIN_JWT_AUDIENCE) return false;
  if (Array.isArray(aud) && !aud.includes(ADMIN_JWT_AUDIENCE)) return false;
  return Boolean(rec.username && String(rec.username).trim());
}

export function isInsecureDevSecret(secret: string | undefined | null): boolean {
  const value = secret?.trim() || '';
  return !value || value === DEV_JWT_SECRET || value === 'change-this-in-production';
}

export const MIN_JWT_SECRET_LENGTH = 32;

/** Production Online must not boot with a short or placeholder JWT_SECRET. */
export function isWeakJwtSecret(secret: string | undefined | null): boolean {
  if (isInsecureDevSecret(secret)) return true;
  return (secret?.trim() || '').length < MIN_JWT_SECRET_LENGTH;
}
