import * as crypto from 'crypto';
import { EmptyClinicCensusPayload } from './clinic-census.util';

/** Bump when the Offline ↔ Online wire format changes incompatibly. */
export const SYNC_PROTOCOL_VERSION = 3;
/** Existing paired devices may still speak v2 until they register a device key. */
export const SYNC_PROTOCOL_MIN_VERSION = 2;
export const SYNC_PROTOCOL_HEADER = 'x-dentalnova-sync-protocol';
/** New pairings must use v3 (device key + license attestation). */
export const SYNC_PROTOCOL_PAIRING_MIN_VERSION = 3;

export const SYNC_PROTOCOL_MISMATCH =
  'This Offline app and the Online clinic use incompatible sync versions. Update both to the same DentalNova version, then pair again.';

export const CENSUS_PROOF_INVALID =
  'Pairing was refused because the Offline empty-clinic proof did not match. Use the official Offline app, start a new pairing code, and try again.';

export type CensusCounts = EmptyClinicCensusPayload;

export type CensusProofInput = {
  protocolVersion: number;
  challenge: string;
  installationId: string;
  emptyClinic: boolean;
  census: CensusCounts;
  devicePublicKey: string;
  licenseId: string;
};

export function parseSyncProtocolVersion(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function isCompatibleSyncProtocol(version: number): boolean {
  return version >= SYNC_PROTOCOL_MIN_VERSION && version <= SYNC_PROTOCOL_VERSION;
}

export function isPairingSyncProtocol(version: number): boolean {
  return version >= SYNC_PROTOCOL_PAIRING_MIN_VERSION && version <= SYNC_PROTOCOL_VERSION;
}

export function syncProtocolHeaders(): Record<string, string> {
  return { [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION) };
}

export function protocolVersionFromHeaders(headers: Record<string, unknown> | undefined): number {
  if (!headers) return 0;
  const raw =
    headers[SYNC_PROTOCOL_HEADER] ??
    headers['X-Dentalnova-Sync-Protocol'] ??
    headers['X-DENTALNOVA-SYNC-PROTOCOL'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parseSyncProtocolVersion(value);
}

function censusField(census: CensusCounts | null | undefined, key: keyof CensusCounts): number {
  return Number(census?.[key]) || 0;
}

/** Stable HMAC payload. Missing optional census fields hash as 0. */
export function canonicalCensusProofPayload(input: CensusProofInput): string {
  const census = {
    appointments: censusField(input.census, 'appointments'),
    expenses: censusField(input.census, 'expenses'),
    labCases: censusField(input.census, 'labCases'),
    notes: censusField(input.census, 'notes'),
    patients: censusField(input.census, 'patients'),
    payments: censusField(input.census, 'payments'),
    prescriptions: censusField(input.census, 'prescriptions'),
    total: censusField(input.census, 'total'),
    treatments: censusField(input.census, 'treatments'),
  };
  return JSON.stringify({
    census,
    challenge: String(input.challenge || ''),
    devicePublicKey: String(input.devicePublicKey || ''),
    emptyClinic: input.emptyClinic === true,
    installationId: String(input.installationId || ''),
    licenseId: String(input.licenseId || ''),
    protocolVersion: Number(input.protocolVersion) || 0,
  });
}

/**
 * HMAC key is the pairing *challenge* (256-bit), never the short pairing code.
 * The payload also binds the Offline Ed25519 device public key and license id.
 * Pairing still requires a DibNova-signed license and a pairingSignature from that key.
 */
export function signCensusProof(hmacSecret: string, input: CensusProofInput): string {
  return crypto
    .createHmac('sha256', String(hmacSecret || ''))
    .update(canonicalCensusProofPayload(input))
    .digest('hex');
}

export function verifyCensusProof(hmacSecret: string, input: CensusProofInput, proof: string): boolean {
  const expected = signCensusProof(hmacSecret, input);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(proof || ''), 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function challengesMatch(stored: string | null | undefined, presented: string | null | undefined): boolean {
  const a = Buffer.from(String(stored || ''), 'utf8');
  const b = Buffer.from(String(presented || ''), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function newPairingChallenge(): string {
  return crypto.randomBytes(32).toString('hex');
}
