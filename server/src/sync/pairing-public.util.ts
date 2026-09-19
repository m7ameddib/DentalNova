import { isLoopbackHostname } from '../common/loopback.util';

export interface StoredPeerConfig {
  deviceId: string;
  deviceSecret: string;
  onlineBaseUrl: string;
  onlineClinicId: string;
  clinicName: string;
  pairedAt: string;
  /** Ed25519 PKCS8 DER, base64url. Never sent to the UI or Online. */
  devicePrivateKey?: string;
  /** Ed25519 SPKI DER, base64url. Registered with Online at pairing. */
  devicePublicKey?: string;
}

export interface PublicPeerInfo {
  paired: true;
  deviceId: string;
  onlineBaseUrl: string;
  clinicId: string;
  clinicName: string;
  pairedAt: string;
}

export const INVALID_ONLINE_URL = 'INVALID_ONLINE_URL';

/** Legacy/marketing hostnames that resolve to the canonical online clinic origin. */
const ONLINE_CLINIC_ORIGIN_ALIASES: Record<string, string> = {
  'https://dental.dibnova.com': 'https://dentalnova.dibnova.com',
  'http://dental.dibnova.com': 'https://dentalnova.dibnova.com',
};

const SECRET_KEYS = new Set([
  'deviceSecret',
  'devicesecret',
  'secretHash',
  'secrethash',
  'secret',
  'devicePrivateKey',
  'deviceprivatekey',
  'privateKey',
  'privatekey',
]);

/** Accept http(s) clinic addresses only. Drop userinfo and keep origin (scheme + host + port). */
export function normalizeOnlineBaseUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(INVALID_ONLINE_URL);
  }
  if (parsed.protocol === 'https:') {
    // ok
  } else if (parsed.protocol === 'http:') {
    if (!isLoopbackHostname(parsed.hostname)) {
      throw new Error(INVALID_ONLINE_URL);
    }
  } else {
    throw new Error(INVALID_ONLINE_URL);
  }
  if (parsed.username || parsed.password) {
    throw new Error(INVALID_ONLINE_URL);
  }
  if (!parsed.hostname) {
    throw new Error(INVALID_ONLINE_URL);
  }
  const origin = parsed.origin;
  return ONLINE_CLINIC_ORIGIN_ALIASES[origin] ?? origin;
}

/** Doctor-facing connect/status payloads must never include device credentials. */
export function toPublicPeerInfo(stored: StoredPeerConfig): PublicPeerInfo {
  return {
    paired: true,
    deviceId: stored.deviceId,
    onlineBaseUrl: stored.onlineBaseUrl,
    clinicId: stored.onlineClinicId,
    clinicName: stored.clinicName,
    pairedAt: stored.pairedAt,
  };
}

export function publicPeerInfo(stored: StoredPeerConfig): PublicPeerInfo {
  return toPublicPeerInfo(stored);
}

export function payloadContainsDeviceSecret(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(rec)) {
    if (SECRET_KEYS.has(key) && nested != null && nested !== '') return true;
    if (nested && typeof nested === 'object' && payloadContainsDeviceSecret(nested)) return true;
  }
  return false;
}

export function compactPairingCode(raw: string): string {
  return String(raw || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

export function formatPairingCodeDisplay(code: string): string {
  const compact = compactPairingCode(code);
  if (compact.length === 8) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return compact;
}

/** One-time pairing payload shown as QR / copy text. Never includes device secrets. */
export function buildPairingPayload(onlineUrl: string, code: string): string {
  return `DNPAIR1|${onlineUrl.replace(/\/$/, '')}|${compactPairingCode(code)}`;
}
