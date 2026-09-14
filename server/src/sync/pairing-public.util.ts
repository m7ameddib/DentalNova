import { BadRequestException } from '@nestjs/common';

export type PeerConfigPublicSource = {
  deviceId: string;
  deviceSecret?: string;
  onlineBaseUrl: string;
  onlineClinicId: string;
  clinicName: string;
  pairedAt: string;
};

const SECRET_KEYS = new Set([
  'deviceSecret',
  'devicesecret',
  'secretHash',
  'secrethash',
  'secret',
]);

/** Doctor-facing connect/status payloads must never include device credentials. */
export function publicPeerInfo(stored: PeerConfigPublicSource): {
  deviceId: string;
  clinicId: string;
  clinicName: string;
  onlineUrl: string;
  pairedAt: string;
} {
  return {
    deviceId: stored.deviceId,
    clinicId: stored.onlineClinicId,
    clinicName: stored.clinicName,
    onlineUrl: stored.onlineBaseUrl,
    pairedAt: stored.pairedAt,
  };
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

export function normalizeOnlineBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new BadRequestException('Enter a valid Online address (https://...)');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException('Online address must start with http:// or https://');
  }
  if (!parsed.hostname) {
    throw new BadRequestException('Enter a valid Online address (https://...)');
  }
  return parsed.origin.replace(/\/$/, '');
}
