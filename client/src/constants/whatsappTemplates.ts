export type WhatsAppMessageLanguage = 'en' | 'ar';

export type WhatsAppTemplateKey = 'appointmentReminder' | 'clinicalFollowup' | 'financialFollowup';

export const WHATSAPP_TEMPLATE_DEFAULTS: Record<
  WhatsAppTemplateKey,
  Record<WhatsAppMessageLanguage, string>
> = {
  appointmentReminder: {
    en: '{clinicName} — Hello {patientName}, this is a reminder of your appointment on {appointmentDate} at {appointmentTime}. We look forward to seeing you. Thank you.',
    ar: '{clinicName} — مرحباً {patientName}، نذكّرك بموعدك بتاريخ {appointmentDate} الساعة {appointmentTime}. بانتظارك، وشكراً.',
  },
  clinicalFollowup: {
    en: "{clinicName} — Hello {patientName}, we're checking in to see how you're doing after your {followUpReason}. If you have any pain, discomfort, or concerns, please let us know. Thank you.",
    ar: '{clinicName} — مرحباً {patientName}، حابين نطمن عليك بعد {followUpReason}. إذا في أي ألم أو انزعاج أو ملاحظة، خبرنا. شكراً.',
  },
  financialFollowup: {
    en: '{clinicName} — Hello {patientName}, this is a friendly reminder that you have an outstanding balance of {balance}. Please contact us if you have any questions. Thank you.',
    ar: '{clinicName} — مرحباً {patientName}، نذكّرك بأن الرصيد المتبقي على حسابك هو {balance}. إذا كان لديك أي استفسار، يرجى التواصل معنا. شكراً.',
  },
};

export const WHATSAPP_PREVIEW_SAMPLES: Record<WhatsAppMessageLanguage, Record<string, string>> = {
  en: {
    clinicName: 'Ali Salmen Clinic',
    patientName: 'Mohammad',
    appointmentDate: '18/08/2026',
    appointmentTime: '10:30',
    appointmentReason: 'Checkup',
    followUpReason: 'Orthodontic follow-up',
    followUpDate: '20/08/2026',
    balance: '$120.00',
  },
  ar: {
    clinicName: 'Ali Salmen Clinic',
    patientName: 'محمد',
    appointmentDate: '18/08/2026',
    appointmentTime: '10:30',
    appointmentReason: 'كشف',
    followUpReason: 'متابعة تقويم',
    followUpDate: '20/08/2026',
    balance: '$120.00',
  },
};
