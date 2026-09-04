import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WHATSAPP_PREVIEW_SAMPLES,
  WHATSAPP_TEMPLATE_DEFAULTS,
  WhatsAppMessageLanguage,
  WhatsAppTemplateKey,
} from '@/constants/whatsappTemplates';
import { settingsApi } from '@/api/settings.api';
import { getErrorMessage } from '@/utils/errors';
import { renderWhatsAppTemplate } from '@/utils/whatsappTemplates';

type TemplateFields = {
  appointmentReminderEn: string;
  appointmentReminderAr: string;
  clinicalFollowupEn: string;
  clinicalFollowupAr: string;
  financialFollowupEn: string;
  financialFollowupAr: string;
};

function defaultFields(): TemplateFields {
  return {
    appointmentReminderEn: WHATSAPP_TEMPLATE_DEFAULTS.appointmentReminder.en,
    appointmentReminderAr: WHATSAPP_TEMPLATE_DEFAULTS.appointmentReminder.ar,
    clinicalFollowupEn: WHATSAPP_TEMPLATE_DEFAULTS.clinicalFollowup.en,
    clinicalFollowupAr: WHATSAPP_TEMPLATE_DEFAULTS.clinicalFollowup.ar,
    financialFollowupEn: WHATSAPP_TEMPLATE_DEFAULTS.financialFollowup.en,
    financialFollowupAr: WHATSAPP_TEMPLATE_DEFAULTS.financialFollowup.ar,
  };
}

function fieldsFromSettings(settings: NonNullable<Awaited<ReturnType<typeof settingsApi.getClinic>>>): TemplateFields {
  const defaults = defaultFields();
  return {
    appointmentReminderEn: settings.whatsappAppointmentReminderEn?.trim() || defaults.appointmentReminderEn,
    appointmentReminderAr: settings.whatsappAppointmentReminderAr?.trim() || defaults.appointmentReminderAr,
    clinicalFollowupEn: settings.whatsappClinicalFollowupEn?.trim() || defaults.clinicalFollowupEn,
    clinicalFollowupAr: settings.whatsappClinicalFollowupAr?.trim() || defaults.clinicalFollowupAr,
    financialFollowupEn: settings.whatsappFinancialFollowupEn?.trim() || defaults.financialFollowupEn,
    financialFollowupAr: settings.whatsappFinancialFollowupAr?.trim() || defaults.financialFollowupAr,
  };
}

function TemplateBlock({
  title,
  variablesHint,
  enValue,
  arValue,
  onEnChange,
  onArChange,
  preview,
  onReset,
}: {
  title: string;
  variablesHint: string;
  enValue: string;
  arValue: string;
  onEnChange: (value: string) => void;
  onArChange: (value: string) => void;
  preview: string;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="whatsapp-template-block">
      <h3 className="whatsapp-template-block__title">{title}</h3>
      <p className="muted whatsapp-template-block__vars">{variablesHint}</p>
      <label className="form-field">
        <span className="form-field__label">English</span>
        <textarea rows={3} value={enValue} onChange={(e) => onEnChange(e.target.value)} />
      </label>
      <label className="form-field">
        <span className="form-field__label">العربية</span>
        <textarea rows={3} value={arValue} onChange={(e) => onArChange(e.target.value)} dir="rtl" />
      </label>
      <div className="whatsapp-template-block__preview">
        <span className="form-field__label">{t('settings.whatsappMessages.preview')}</span>
        <p className="whatsapp-template-block__preview-text">{preview}</p>
      </div>
      <button type="button" className="link-btn whatsapp-template-block__reset" onClick={onReset}>
        {t('settings.whatsappMessages.resetToDefault')}
      </button>
    </div>
  );
}

export function WhatsAppMessagesSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  const [whatsappLanguage, setWhatsappLanguage] = useState<WhatsAppMessageLanguage>('en');
  const [fields, setFields] = useState<TemplateFields>(defaultFields);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    if (settings) {
      setWhatsappLanguage(settings.whatsappMessageLanguage === 'ar' ? 'ar' : 'en');
      setFields(fieldsFromSettings(settings));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: settingsApi.updateClinic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      setError(null);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const clinicNamePreview = settings?.clinicName?.trim() || WHATSAPP_PREVIEW_SAMPLES.en.clinicName;

  const previews = useMemo(() => {
    const samples = {
      ...WHATSAPP_PREVIEW_SAMPLES[whatsappLanguage],
      clinicName: clinicNamePreview,
    };
    const template = (key: WhatsAppTemplateKey) =>
      whatsappLanguage === 'ar'
        ? key === 'appointmentReminder'
          ? fields.appointmentReminderAr
          : key === 'clinicalFollowup'
            ? fields.clinicalFollowupAr
            : fields.financialFollowupAr
        : key === 'appointmentReminder'
          ? fields.appointmentReminderEn
          : key === 'clinicalFollowup'
            ? fields.clinicalFollowupEn
            : fields.financialFollowupEn;

    return {
      appointmentReminder: renderWhatsAppTemplate(template('appointmentReminder'), samples),
      clinicalFollowup: renderWhatsAppTemplate(template('clinicalFollowup'), samples),
      financialFollowup: renderWhatsAppTemplate(template('financialFollowup'), samples),
    };
  }, [fields, whatsappLanguage, clinicNamePreview]);

  function resetTemplate(key: WhatsAppTemplateKey) {
    setFields((prev) => {
      if (key === 'appointmentReminder') {
        return {
          ...prev,
          appointmentReminderEn: WHATSAPP_TEMPLATE_DEFAULTS.appointmentReminder.en,
          appointmentReminderAr: WHATSAPP_TEMPLATE_DEFAULTS.appointmentReminder.ar,
        };
      }
      if (key === 'clinicalFollowup') {
        return {
          ...prev,
          clinicalFollowupEn: WHATSAPP_TEMPLATE_DEFAULTS.clinicalFollowup.en,
          clinicalFollowupAr: WHATSAPP_TEMPLATE_DEFAULTS.clinicalFollowup.ar,
        };
      }
      return {
        ...prev,
        financialFollowupEn: WHATSAPP_TEMPLATE_DEFAULTS.financialFollowup.en,
        financialFollowupAr: WHATSAPP_TEMPLATE_DEFAULTS.financialFollowup.ar,
      };
    });
  }

  function handleSave() {
    saveMutation.mutate({
      whatsappMessageLanguage: whatsappLanguage,
      whatsappAppointmentReminderEn: fields.appointmentReminderEn.trim(),
      whatsappAppointmentReminderAr: fields.appointmentReminderAr.trim(),
      whatsappClinicalFollowupEn: fields.clinicalFollowupEn.trim(),
      whatsappClinicalFollowupAr: fields.clinicalFollowupAr.trim(),
      whatsappFinancialFollowupEn: fields.financialFollowupEn.trim(),
      whatsappFinancialFollowupAr: fields.financialFollowupAr.trim(),
    });
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.whatsappMessages.title')}</h2>

      <div className="form-field">
        <span className="form-field__label">{t('settings.whatsappMessages.language')}</span>
        <div className="lang-switch-group">
          <button
            type="button"
            className={whatsappLanguage === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
            onClick={() => setWhatsappLanguage('en')}
          >
            English
          </button>
          <button
            type="button"
            className={whatsappLanguage === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
            onClick={() => setWhatsappLanguage('ar')}
          >
            العربية
          </button>
        </div>
        <p className="muted whatsapp-template-block__hint">{t('settings.whatsappMessages.languageHint')}</p>
      </div>

      <TemplateBlock
        title={t('settings.whatsappMessages.appointmentReminder')}
        variablesHint={t('settings.whatsappMessages.vars.appointment')}
        enValue={fields.appointmentReminderEn}
        arValue={fields.appointmentReminderAr}
        onEnChange={(value) => setFields((prev) => ({ ...prev, appointmentReminderEn: value }))}
        onArChange={(value) => setFields((prev) => ({ ...prev, appointmentReminderAr: value }))}
        preview={previews.appointmentReminder}
        onReset={() => resetTemplate('appointmentReminder')}
      />

      <TemplateBlock
        title={t('settings.whatsappMessages.clinicalFollowup')}
        variablesHint={t('settings.whatsappMessages.vars.clinical')}
        enValue={fields.clinicalFollowupEn}
        arValue={fields.clinicalFollowupAr}
        onEnChange={(value) => setFields((prev) => ({ ...prev, clinicalFollowupEn: value }))}
        onArChange={(value) => setFields((prev) => ({ ...prev, clinicalFollowupAr: value }))}
        preview={previews.clinicalFollowup}
        onReset={() => resetTemplate('clinicalFollowup')}
      />

      <TemplateBlock
        title={t('settings.whatsappMessages.financialFollowup')}
        variablesHint={t('settings.whatsappMessages.vars.financial')}
        enValue={fields.financialFollowupEn}
        arValue={fields.financialFollowupAr}
        onEnChange={(value) => setFields((prev) => ({ ...prev, financialFollowupEn: value }))}
        onArChange={(value) => setFields((prev) => ({ ...prev, financialFollowupAr: value }))}
        preview={previews.financialFollowup}
        onReset={() => resetTemplate('financialFollowup')}
      />

      {error && <div className="form-error-banner">{error}</div>}

      <div className="form-actions form-actions--start">
        {savedMessage && <span className="muted settings-saved-hint">{t('settings.whatsappMessages.saved')}</span>}
        <button type="button" className="btn btn--primary btn--small" onClick={handleSave} disabled={saveMutation.isPending}>
          {t('common.save')}
        </button>
      </div>
    </section>
  );
}
