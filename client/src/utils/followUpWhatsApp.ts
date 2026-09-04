import { ClinicSettings, FollowUpWithPatient } from '@/types/domain';
import { formatDateDisplay } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import {
  buildClinicalFollowUpMessage,
  buildFinancialFollowUpMessage,
  resolveWhatsAppMessageLanguage,
} from '@/utils/whatsappTemplates';
import { normalizeWhatsAppPhone, openWhatsAppDesktop } from '@/utils/whatsapp';

export function buildFollowUpWhatsAppMessage(
  fu: FollowUpWithPatient,
  settings: ClinicSettings,
): string {
  const clinicName = settings.clinicName?.trim() || '';
  const msgLocale = resolveWhatsAppMessageLanguage(settings) === 'ar' ? 'ar' : 'en';

  if (fu.type === 'FINANCIAL') {
    return buildFinancialFollowUpMessage(settings, {
      clinicName,
      patientName: fu.patientName,
      balance: formatMoney(fu.remainingCents ?? 0),
    });
  }

  return buildClinicalFollowUpMessage(settings, {
    clinicName,
    patientName: fu.patientName,
    followUpReason: fu.reason,
    followUpDate: formatDateDisplay(fu.followUpDate, msgLocale),
  });
}

export function openFollowUpWhatsApp(fu: FollowUpWithPatient, settings: ClinicSettings): boolean {
  const message = buildFollowUpWhatsAppMessage(fu, settings);
  return openWhatsAppDesktop(fu.patientPhone, message);
}

const BULK_OPEN_DELAY_MS = 800;

/** Opens WhatsApp Desktop for each follow-up using that row's type-specific message. */
export function openFollowUpsWhatsAppBulk(
  items: FollowUpWithPatient[],
  settings: ClinicSettings,
): { opened: number; skipped: number } {
  const eligible = items.filter((fu) => normalizeWhatsAppPhone(fu.patientPhone));
  eligible.forEach((fu, index) => {
    setTimeout(() => {
      openFollowUpWhatsApp(fu, settings);
    }, index * BULK_OPEN_DELAY_MS);
  });
  return { opened: eligible.length, skipped: items.length - eligible.length };
}
