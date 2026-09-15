/**
 * Manual WhatsApp helper — shared by every "Send via WhatsApp" action in the
 * app (patient conversation, appointment reminders, payment/receipt
 * confirmations, balance reminders, invoice summaries).
 *
 * This never sends anything automatically: it only builds a link with a
 * pre-filled message and opens it, letting the user review and hit send
 * themselves inside WhatsApp.
 */

/** Eastern Arabic-Indic (٠-٩) and Persian (۰-۹) digits → ASCII, so Arabic-locale entry still WhatsApps. */
const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function toAsciiPhoneDigits(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const arabic = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (arabic >= 0) {
      out += String(arabic);
      continue;
    }
    const persian = PERSIAN_DIGITS.indexOf(ch);
    if (persian >= 0) {
      out += String(persian);
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Normalizes a locally-entered phone number into digits-only international
 * format. Strips everything but digits/`+`, drops a leading `+` or local trunk
 * `0`, and prepends Lebanon country code `961` for common 7–8 digit local
 * mobiles (e.g. `81858501` → `96181858501`).
 * Returns null when the result is too short to be a usable number.
 */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = toAsciiPhoneDigits(String(raw)).trim().replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/^0+/, '');
  if (digits.length >= 7 && digits.length <= 8 && !digits.startsWith('961')) {
    digits = `961${digits}`;
  }
  return digits.length >= 7 ? digits : null;
}

/** Phone fields the reminder button may receive from schedule, GET-by-id, or a stale cache. */
export interface AppointmentReminderPhoneFields {
  patientPhone?: string | null;
  guestPhone?: string | null;
  phone?: string | null;
  patient_phone?: string | null;
  guest_phone?: string | null;
}

/** First non-empty phone string on the appointment, without WhatsApp normalization. */
export function appointmentReminderRawPhone(appt: AppointmentReminderPhoneFields): string | null {
  const candidates = [appt.patientPhone, appt.guestPhone, appt.phone, appt.patient_phone, appt.guest_phone];
  for (const value of candidates) {
    if (value == null) continue;
    const trimmed = String(value).trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** Linked patient phone, or walk-in guest phone — whichever is actually present. */
export function appointmentReminderPhone(appt: AppointmentReminderPhoneFields): string | null {
  return normalizeWhatsAppPhone(appointmentReminderRawPhone(appt));
}

export type AppointmentReminderDisableReason = 'missing' | 'invalid' | 'pending' | 'lookingUp';

export interface AppointmentReminderButtonState {
  phone: string | null;
  disabled: boolean;
  reason: AppointmentReminderDisableReason | null;
}

/**
 * Enable the Appointments "Open WhatsApp reminder" button only when a usable
 * patient/guest phone is already known. `lookingUp` covers the hydrate fetch
 * after opening a card whose schedule payload omitted `patientPhone`.
 */
export function appointmentReminderButtonState(
  appt: AppointmentReminderPhoneFields | null | undefined,
  opts: { mutationPending?: boolean; lookingUp?: boolean } = {},
): AppointmentReminderButtonState {
  if (opts.mutationPending) return { phone: null, disabled: true, reason: 'pending' };
  const phone = appt ? appointmentReminderPhone(appt) : null;
  if (phone) return { phone, disabled: false, reason: null };
  if (opts.lookingUp) return { phone: null, disabled: true, reason: 'lookingUp' };
  if (appt && appointmentReminderRawPhone(appt)) return { phone: null, disabled: true, reason: 'invalid' };
  return { phone: null, disabled: true, reason: 'missing' };
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

function clickHref(url: string, targetBlank: boolean): void {
  const link = document.createElement('a');
  link.href = url;
  if (targetBlank) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Opens WhatsApp Web via `wa.me`. Returns false if the phone number is unusable. */
export function openWhatsApp(phone: string | null | undefined, message?: string): boolean {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) return false;
  clickHref(url, true);
  return true;
}

/** Opens the installed WhatsApp Desktop app via `whatsapp://`. Returns false if the phone number is unusable. */
export function openWhatsAppDesktop(phone: string | null | undefined, message?: string): boolean {
  const url = buildWhatsAppDesktopUrl(phone, message);
  if (!url) return false;
  clickHref(url, false);
  return true;
}

export const DESKTOP_HANDOFF_MS = 1500;

export interface ReservedPopup {
  closed: boolean;
  close: () => void;
  assign: (url: string) => void;
}

/**
 * Prefer desktop WhatsApp, then wa.me. The wa.me tab MUST be reserved during
 * the click (user gesture). A delayed `window.open(wa.me)` after 1.5s is
 * eaten by popup blockers, which is why the appointment reminder button
 * appeared to do nothing when WhatsApp Desktop was not installed.
 */
export function openReservedWhatsAppFallback(input: {
  webUrl: string;
  desktopUrl: string | null;
  reserveBlank: () => ReservedPopup | null;
  openDesktop: () => void;
  openWebNow: (url: string) => void;
  subscribeHandoff: (onHandoff: () => void) => () => void;
  isHandedOff: () => boolean;
  schedule: (fn: () => void, ms: number) => void;
  delayMs?: number;
}): boolean {
  const reserved = input.reserveBlank();
  if (input.desktopUrl) input.openDesktop();

  if (!input.desktopUrl) {
    if (reserved && !reserved.closed) reserved.assign(input.webUrl);
    else input.openWebNow(input.webUrl);
    return true;
  }

  if (!reserved) {
    // Cannot delay a new popup. Open wa.me in this same click.
    input.openWebNow(input.webUrl);
    return true;
  }

  const delayMs = input.delayMs ?? DESKTOP_HANDOFF_MS;
  const unsubscribe = input.subscribeHandoff(() => undefined);
  input.schedule(() => {
    unsubscribe();
    if (input.isHandedOff() || reserved.closed) {
      try {
        reserved.close();
      } catch {
        /* ignore */
      }
      return;
    }
    reserved.assign(input.webUrl);
  }, delayMs);
  return true;
}

function reserveBlankPopup(): ReservedPopup | null {
  try {
    const win = window.open('about:blank', '_blank');
    if (!win) return null;
    return {
      get closed() {
        return win.closed;
      },
      close: () => {
        try {
          win.close();
        } catch {
          /* ignore */
        }
      },
      assign: (url: string) => {
        try {
          win.opener = null;
          win.location.href = url;
        } catch {
          clickHref(url, true);
        }
      },
    };
  } catch {
    return null;
  }
}

/**
 * Prefer the desktop protocol on machines that have WhatsApp installed,
 * then fall back to wa.me only if the page never loses focus/visibility
 * (handoff to the desktop app).
 *
 * The fallback tab is reserved during the click so popup blockers cannot
 * swallow wa.me 1.5s later.
 */
export function openWhatsAppPreferred(phone: string | null | undefined, message?: string): boolean {
  const webUrl = buildWhatsAppUrl(phone, message);
  if (!webUrl) return false;
  const desktopUrl = buildWhatsAppDesktopUrl(phone, message);

  let handedOff = false;
  const markHandoff = () => {
    handedOff = true;
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') markHandoff();
  };

  return openReservedWhatsAppFallback({
    webUrl,
    desktopUrl,
    reserveBlank: reserveBlankPopup,
    openDesktop: () => {
      if (desktopUrl) openWhatsAppDesktop(phone, message);
    },
    openWebNow: (url) => clickHref(url, true),
    subscribeHandoff: () => {
      window.addEventListener('blur', markHandoff);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        window.removeEventListener('blur', markHandoff);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    },
    isHandedOff: () =>
      handedOff || !document.hasFocus() || document.visibilityState === 'hidden',
    schedule: (fn, ms) => {
      window.setTimeout(fn, ms);
    },
  });
}
