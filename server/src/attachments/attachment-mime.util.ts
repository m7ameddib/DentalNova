import * as path from 'path';

export const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/dicom',
  'application/dicom+json',
]);

const INLINE_SAFE_IMAGES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

const EXT_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.dcm': 'application/dicom',
};

export function normalizeUploadMime(reported: string | undefined, originalName: string): string {
  const fromName = EXT_MIME[path.extname(originalName || '').toLowerCase()] || '';
  const raw = (reported || fromName || 'application/octet-stream').toLowerCase().split(';')[0].trim();
  if (raw === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_ATTACHMENT_MIMES.has(raw)) return raw;
  if (fromName && ALLOWED_ATTACHMENT_MIMES.has(fromName)) return fromName;
  return raw;
}

export function isInlineSafeImage(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const raw = mimeType.toLowerCase().split(';')[0].trim();
  return INLINE_SAFE_IMAGES.has(raw);
}

export function contentDispositionFor(fileName: string, inline: boolean): string {
  const encoded = encodeURIComponent(fileName || 'download');
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}
