/**
 * Manual WhatsApp helper — shared by every "Send via WhatsApp" action in the
 * app (patient conversation, appointment reminders, payment/receipt
 * confirmations, balance reminders, invoice summaries).
 *
 * This never sends anything automatically: it only builds a link with a
 * pre-filled message and opens it, letting the user review and hit send
 * themselves inside WhatsApp.
 */

/**
 * Normalizes a locally-entered phone number into digits-only international
 * format. Strips everything but digits/`+`, drops a leading `+` or local trunk
 * `0`, and prepends Lebanon country code `961` for common 7–8 digit local
 * mobiles (e.g. `81858501` → `96181858501`).
 * Returns null when the result is too short to be a usable number.
 */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/^0+/, '');
  if (digits.length >= 7 && digits.length <= 8 && !digits.startsWith('961')) {
    digits = `961${digits}`;
  }
  return digits.length >= 7 ? digits : null;
}

/** Builds a `wa.me` link, or null when the phone number isn't usable. */
export function buildWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Builds a `whatsapp://` desktop link, or null when the phone number isn't usable. */
export function buildWhatsAppDesktopUrl(phone: string | null | undefined, message?: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const params = new URLSearchParams({ phone: normalized });
  if (message) params.set('text', message);
  return `whatsapp://send?${params.toString()}`;
}

/** Opens WhatsApp Web via `wa.me`. Returns false if the phone number is unusable. */
export function openWhatsApp(phone: string | null | undefined, message?: string): boolean {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Opens the installed WhatsApp Desktop app via `whatsapp://`. Returns false if the phone number is unusable. */
export function openWhatsAppDesktop(phone: string | null | undefined, message?: string): boolean {
  const url = buildWhatsAppDesktopUrl(phone, message);
  if (!url) return false;
  const link = document.createElement('a');
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}
