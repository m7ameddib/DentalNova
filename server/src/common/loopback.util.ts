import { Request } from 'express';

export function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return '';
  return ip.trim().replace(/^::ffff:/i, '');
}

export function isLoopbackAddress(ip: string | undefined | null): boolean {
  const v = normalizeIp(ip);
  if (!v) return false;
  if (v === '127.0.0.1' || v === '::1' || v === 'localhost') return true;
  if (v.startsWith('127.')) return true;
  return false;
}

/** Hostnames that may use HTTP during local pairing tests (never LAN/public HTTP). */
export function isLoopbackHostname(hostname: string | undefined | null): boolean {
  const raw = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!raw) return false;
  if (raw === 'localhost') return true;
  return isLoopbackAddress(raw);
}

/**
 * Client IP for rate limits. Uses Express `req.ip` (honours `trust proxy`) then the
 * socket. Does **not** read `X-Forwarded-For` directly — that header is spoofable
 * when the Node process is reachable without a trusted reverse proxy.
 */
export function requestClientIp(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}): string {
  return normalizeIp(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '');
}

export function isLoopbackRequest(req: Pick<Request, 'ip' | 'socket'> & {
  connection?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  return isLoopbackAddress(requestClientIp(req));
}
