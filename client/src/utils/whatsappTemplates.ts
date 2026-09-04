import {
  WHATSAPP_TEMPLATE_DEFAULTS,
  WhatsAppMessageLanguage,
  WhatsAppTemplateKey,
} from '@/constants/whatsappTemplates';
import { ClinicSettings } from '@/types/domain';

/** Replaces `{variable}` placeholders safely; unknown keys become empty strings. */
export function renderWhatsAppTemplate(
  template: string,
  variables: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (_match, key: string) => {
    const value = variables[key];
    return value != null ? String(value) : '';
  });
}

export function resolveWhatsAppMessageLanguage(settings: ClinicSettings): WhatsAppMessageLanguage {
  return settings.whatsappMessageLanguage === 'ar' ? 'ar' : 'en';
}

function storedTemplate(
  settings: ClinicSettings,
  key: WhatsAppTemplateKey,
  language: WhatsAppMessageLanguage,
): string | null | undefined {
  switch (key) {
    case 'appointmentReminder':
      return language === 'ar'
        ? settings.whatsappAppointmentReminderAr
        : settings.whatsappAppointmentReminderEn;
    case 'clinicalFollowup':
      return language === 'ar' ? settings.whatsappClinicalFollowupAr : settings.whatsappClinicalFollowupEn;
    case 'financialFollowup':
      return language === 'ar' ? settings.whatsappFinancialFollowupAr : settings.whatsappFinancialFollowupEn;
    default:
      return undefined;
  }
}

export function getWhatsAppTemplateText(
  settings: ClinicSettings,
  key: WhatsAppTemplateKey,
  language?: WhatsAppMessageLanguage,
): string {
  const lang = language ?? resolveWhatsAppMessageLanguage(settings);
  return storedTemplate(settings, key, lang)?.trim() || WHATSAPP_TEMPLATE_DEFAULTS[key][lang];
}

export function buildAppointmentReminderMessage(
  settings: ClinicSettings,
  variables: {
    clinicName: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    appointmentReason?: string | null;
  },
): string {
  const template = getWhatsAppTemplateText(settings, 'appointmentReminder');
  return renderWhatsAppTemplate(template, variables);
}

export function buildClinicalFollowUpMessage(
  settings: ClinicSettings,
  variables: {
    clinicName: string;
    patientName: string;
    followUpReason: string;
    followUpDate?: string | null;
  },
): string {
  const template = getWhatsAppTemplateText(settings, 'clinicalFollowup');
  return renderWhatsAppTemplate(template, variables);
}

export function buildFinancialFollowUpMessage(
  settings: ClinicSettings,
  variables: {
    clinicName: string;
    patientName: string;
    balance: string;
  },
): string {
  const template = getWhatsAppTemplateText(settings, 'financialFollowup');
  return renderWhatsAppTemplate(template, variables);
}
