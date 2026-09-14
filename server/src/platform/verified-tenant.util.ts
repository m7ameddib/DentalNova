import {
  isSessionJwtPayload,
  isSyncDevicePayload,
  SESSION_JWT_ISSUER,
  SYNC_DEVICE_JWT_ISSUER,
} from '../auth/jwt-payload.util';

export type AccessTokenVerifier = (
  token: string,
  secret: string,
  issuer: string,
) => Record<string, unknown> | null;

/**
 * Bind tenant context only from a signature-verified session or sync-device JWT.
 * Unverified payload decode must not open another clinic's SQLite file.
 */
export function clinicIdFromVerifiedBearer(
  authorization: string | undefined,
  secrets: { sessionSecret: string; deviceSecret: string },
  verify: AccessTokenVerifier,
): string | undefined {
  if (!authorization?.startsWith('Bearer ')) return undefined;
  const token = authorization.slice(7).trim();
  if (!token) return undefined;

  const session = verify(token, secrets.sessionSecret, SESSION_JWT_ISSUER);
  if (session && isSessionJwtPayload(session)) {
    const clinicId = typeof session.clinicId === 'string' ? session.clinicId.trim() : '';
    if (clinicId) return clinicId;
  }

  const device = verify(token, secrets.deviceSecret, SYNC_DEVICE_JWT_ISSUER);
  if (device && isSyncDevicePayload(device)) {
    const clinicId = typeof device.clinicId === 'string' ? device.clinicId.trim() : '';
    if (clinicId) return clinicId;
  }

  return undefined;
}
