import { JwtPayload, PasswordResetJwtPayload } from './auth.types';

export const SESSION_JWT_ISSUER = 'dentalnova-session';
export const PASSWORD_RESET_JWT_ISSUER = 'dentalnova-password-reset';
export const SYNC_DEVICE_JWT_ISSUER = 'dentalnova-sync-device';

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

/** Session JWTs must never be password-reset or device-sync tokens. */
export function isSessionJwtPayload(payload: JwtPayload | Record<string, unknown>): boolean {
  if (isPasswordResetPayload(payload)) return false;
  if (isSyncDevicePayload(payload)) return false;
  return true;
}

export function isInsecureDevSecret(secret: string | undefined | null): boolean {
  const value = secret?.trim() || '';
  return !value || value === DEV_JWT_SECRET || value === 'change-this-in-production';
}
