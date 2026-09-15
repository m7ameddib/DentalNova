/** Express/Nest `PayloadTooLargeError` is not an HttpException. */
export const PAYLOAD_TOO_LARGE_CODE = 'PAYLOAD_TOO_LARGE';

export const PAYLOAD_TOO_LARGE_MESSAGE =
  'This request is too large for the clinic server. Sync will retry in smaller batches. If an attachment is huge, use a smaller file.';

export function isPayloadTooLargeError(exception: unknown): boolean {
  if (!exception || typeof exception !== 'object') return false;
  const rec = exception as { type?: unknown; status?: unknown; statusCode?: unknown; message?: unknown };
  if (rec.type === 'entity.too.large') return true;
  if (rec.status === 413 || rec.statusCode === 413) return true;
  const message = String(rec.message || '').toLowerCase();
  return message.includes('request entity too large') || message.includes('payload too large');
}
