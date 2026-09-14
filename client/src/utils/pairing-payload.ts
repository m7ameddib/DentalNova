/** Compact 8-character pairing code (dashes/spaces ignored). */
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

/** QR / copy payload. Never include device secrets. */
export function buildPairingPayload(onlineUrl: string, code: string): string {
  return `DNPAIR1|${onlineUrl.replace(/\/$/, '')}|${compactPairingCode(code)}`;
}

export function pairingSecondsLeft(expiresAt: string | undefined, nowMs = Date.now()): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - nowMs;
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor(ms / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
