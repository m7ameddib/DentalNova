import * as crypto from 'crypto';

/** Attachment blob sync helpers. Blobs stay on disk / object storage — never SQLite. */

export const FILE_INLINE_MAX_BYTES = 256 * 1024;
export const FILE_CHUNK_BYTES = 256 * 1024;
export const FILE_MAX_AUTO_ATTEMPTS = 8;
export const FILE_CHUNK_BASE64_MAX_CHARS = 400_000;
export const FILE_MAX_BYTES = 64 * 1024 * 1024;

const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 6_360_000];

export function fileRetryDelayMs(attempt: number): number {
  const idx = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, attempt));
  return RETRY_DELAYS_MS[idx];
}

export function nextAttachmentRetryAt(attempt: number, nowMs = Date.now()): string {
  return new Date(nowMs + fileRetryDelayMs(attempt)).toISOString();
}

export function shouldRetryAttachment(input: {
  uploadedAt?: string | null;
  attemptCount?: number | null;
  nextRetryAt?: string | null;
  force?: boolean;
  nowMs?: number;
}): boolean {
  if (input.uploadedAt) return false;
  const attempts = Number(input.attemptCount) || 0;
  if (input.force) return true;
  if (attempts >= FILE_MAX_AUTO_ATTEMPTS) return false;
  if (!input.nextRetryAt) return true;
  const when = new Date(input.nextRetryAt).getTime();
  if (Number.isNaN(when)) return true;
  return (input.nowMs ?? Date.now()) >= when;
}

export function sha256Hex(bytes: Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function decodeFileChunkBase64(contentBase64: string): Buffer {
  if (!contentBase64 || contentBase64.length > FILE_CHUNK_BASE64_MAX_CHARS) {
    throw new Error('File chunk is too large');
  }
  const bytes = Buffer.from(contentBase64, 'base64');
  if (bytes.length > FILE_CHUNK_BYTES) {
    throw new Error('File chunk exceeds the 256 KiB limit');
  }
  return bytes;
}
