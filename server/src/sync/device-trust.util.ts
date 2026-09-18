import * as crypto from 'crypto';
import { CensusCounts } from './sync-protocol.util';

export const DEVICE_TRUST_REQUIRED_CODE = 'DEVICE_TRUST_REQUIRED';
export const DEVICE_TRUST_REQUIRED =
  'Pairing was refused because this computer did not prove it is a licensed DentalNova Offline install. Use the official Offline app with a valid license, start a new pairing code, and try again.';

export const DEVICE_SIGNATURE_INVALID_CODE = 'DEVICE_SIGNATURE_INVALID';
export const DEVICE_SIGNATURE_INVALID =
  'This computer could not prove it holds the paired device key. Pair again from the official Offline app if this PC was reset.';

export const DEVICE_KEY_ALREADY_REGISTERED_CODE = 'DEVICE_KEY_ALREADY_REGISTERED';
export const DEVICE_KEY_ALREADY_REGISTERED =
  'This device already has a registered key. Disconnect and pair again to replace it.';

export const DEVICE_INSTALL_ALREADY_PAIRED_CODE = 'DEVICE_INSTALL_ALREADY_PAIRED';
export const DEVICE_INSTALL_ALREADY_PAIRED =
  'This Offline installation is already paired with an Online clinic. Disconnect the existing device first.';

export const DEVICE_SIG_HEADER = 'x-dentalnova-device-sig';
export const DEVICE_TS_HEADER = 'x-dentalnova-device-ts';
export const DEVICE_REQUEST_MAX_SKEW_MS = 5 * 60 * 1000;

export type DeviceKeypair = {
  publicKey: string;
  privateKey: string;
};

export type PairingTranscriptInput = {
  protocolVersion: number;
  challenge: string;
  installationId: string;
  licenseId: string;
  devicePublicKey: string;
  emptyClinic: boolean;
  census: CensusCounts;
};

export function generateDeviceKeypair(): DeviceKeypair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64url'),
  };
}

function publicKeyObject(publicKey: string): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.from(String(publicKey || ''), 'base64url'),
    type: 'spki',
    format: 'der',
  });
}

function privateKeyObject(privateKey: string): crypto.KeyObject {
  return crypto.createPrivateKey({
    key: Buffer.from(String(privateKey || ''), 'base64url'),
    type: 'pkcs8',
    format: 'der',
  });
}

export function isDevicePublicKeyFormat(publicKey: string | null | undefined): boolean {
  try {
    const key = publicKeyObject(String(publicKey || ''));
    return key.asymmetricKeyType === 'ed25519';
  } catch {
    return false;
  }
}

export function signWithDeviceKey(privateKey: string, payload: string | Buffer): string {
  const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  return crypto.sign(null, data, privateKeyObject(privateKey)).toString('base64url');
}

export function verifyDeviceSignature(
  publicKey: string,
  payload: string | Buffer,
  signature: string,
): boolean {
  try {
    const data = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
    const sig = Buffer.from(String(signature || ''), 'base64url');
    if (sig.length !== 64) return false;
    return crypto.verify(null, data, publicKeyObject(publicKey), sig);
  } catch {
    return false;
  }
}

export function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function censusField(census: CensusCounts | null | undefined, key: keyof CensusCounts): number {
  return Number(census?.[key]) || 0;
}

function canonicalCensus(census: CensusCounts | null | undefined) {
  return {
    appointments: censusField(census, 'appointments'),
    expenses: censusField(census, 'expenses'),
    labCases: censusField(census, 'labCases'),
    notes: censusField(census, 'notes'),
    patients: censusField(census, 'patients'),
    payments: censusField(census, 'payments'),
    prescriptions: censusField(census, 'prescriptions'),
    total: censusField(census, 'total'),
    treatments: censusField(census, 'treatments'),
  };
}

/** Stable pairing transcript signed by the Offline-held Ed25519 device key. */
export function canonicalPairingTranscript(input: PairingTranscriptInput): string {
  return JSON.stringify({
    census: canonicalCensus(input.census),
    challenge: String(input.challenge || ''),
    devicePublicKey: String(input.devicePublicKey || ''),
    emptyClinic: input.emptyClinic === true,
    installationId: String(input.installationId || ''),
    licenseId: String(input.licenseId || ''),
    protocolVersion: Number(input.protocolVersion) || 0,
  });
}

export function canonicalDeviceRequestPayload(input: {
  timestamp: string;
  method: string;
  path: string;
  bodySha256: string;
}): string {
  return [
    'DNDEV1',
    String(input.timestamp || ''),
    String(input.method || '').toUpperCase(),
    String(input.path || ''),
    String(input.bodySha256 || ''),
  ].join('\n');
}

export function deviceTimestampFresh(timestamp: string | number | null | undefined, nowMs = Date.now()): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Math.abs(nowMs - ts) <= DEVICE_REQUEST_MAX_SKEW_MS;
}

export function headerValue(
  headers: Record<string, unknown> | undefined,
  name: string,
): string {
  if (!headers) return '';
  const lower = name.toLowerCase();
  for (const [key, raw] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value ?? '');
  }
  return '';
}

export function deviceTrustHeaders(
  privateKey: string,
  method: string,
  path: string,
  body: Buffer | string = '',
  nowMs = Date.now(),
): Record<string, string> {
  const timestamp = String(nowMs);
  const payload = canonicalDeviceRequestPayload({
    timestamp,
    method,
    path,
    bodySha256: sha256Hex(body || ''),
  });
  return {
    [DEVICE_TS_HEADER]: timestamp,
    [DEVICE_SIG_HEADER]: signWithDeviceKey(privateKey, payload),
  };
}

export function verifyDeviceRequestSignature(input: {
  publicKey: string;
  method: string;
  path: string;
  body: Buffer | string;
  timestamp: string;
  signature: string;
  nowMs?: number;
}): boolean {
  if (!isDevicePublicKeyFormat(input.publicKey)) return false;
  if (!deviceTimestampFresh(input.timestamp, input.nowMs)) return false;
  const payload = canonicalDeviceRequestPayload({
    timestamp: String(input.timestamp || ''),
    method: input.method,
    path: input.path,
    bodySha256: sha256Hex(input.body || ''),
  });
  return verifyDeviceSignature(input.publicKey, payload, input.signature);
}

export function verifyExpressDeviceRequest(
  req:
    | {
        method?: string;
        originalUrl?: string;
        url?: string;
        headers?: Record<string, unknown>;
        rawBody?: Buffer;
      }
    | undefined,
  publicKey: string,
): boolean {
  const timestamp = headerValue(req?.headers, DEVICE_TS_HEADER);
  const signature = headerValue(req?.headers, DEVICE_SIG_HEADER);
  const method = String(req?.method || '');
  const raw = req?.rawBody;
  const body: Buffer | string = raw && raw.length > 0 ? raw : '';
  const path = String(req?.originalUrl || req?.url || '');
  return verifyDeviceRequestSignature({
    publicKey,
    method,
    path,
    body,
    timestamp,
    signature,
  });
}
