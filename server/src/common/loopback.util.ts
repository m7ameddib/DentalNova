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

export function requestClientIp(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const forwardedFirst = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return normalizeIp(
    req.ip || forwardedFirst?.trim() || req.socket?.remoteAddress || req.connection?.remoteAddress || '',
  );
}

export function isLoopbackRequest(req: Pick<Request, 'ip' | 'socket'> & {
  connection?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  return isLoopbackAddress(requestClientIp(req));
}
