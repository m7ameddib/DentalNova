import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings.api';
import { getErrorMessage } from '@/utils/errors';

export function ClinicInfoSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [address, setAddress] = useState('');
  const [doctorNameAr, setDoctorNameAr] = useState('');
  const [doctorNameEn, setDoctorNameEn] = useState('');
  const [doctorTitleAr, setDoctorTitleAr] = useState('');
  const [doctorTitleEn, setDoctorTitleEn] = useState('');
  const [doctorLicenseNo, setDoctorLicenseNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setClinicName(settings.clinicName ?? '');
      setClinicPhone(settings.clinicPhone ?? '');
      setDoctorPhone(settings.doctorPhone ?? '');
      setAddress(settings.address ?? '');
      setDoctorNameAr(settings.doctorNameAr ?? '');
      setDoctorNameEn(settings.doctorNameEn ?? '');
      setDoctorTitleAr(settings.doctorTitleAr ?? '');
      setDoctorTitleEn(settings.doctorTitleEn ?? '');
      setDoctorLicenseNo(settings.doctorLicenseNo ?? '');
    }
  }, [settings]);

  useEffect(() => {
    if (!settings?.logoPath) {
      setLogoUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    settingsApi.fetchLogoBlob().then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setLogoUrl(objectUrl);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [settings?.logoPath]);

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

  const logoMutation = useMutation({
    mutationFn: settingsApi.uploadLogo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic-settings'] }),
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function handleSave() {
    saveMutation.mutate({
      clinicName: clinicName.trim(),
      clinicPhone: clinicPhone.trim(),
      doctorPhone: doctorPhone.trim(),
      address: address.trim(),
      doctorNameAr: doctorNameAr.trim(),
      doctorNameEn: doctorNameEn.trim(),
      doctorTitleAr: doctorTitleAr.trim(),
      doctorTitleEn: doctorTitleEn.trim(),
      doctorLicenseNo: doctorLicenseNo.trim(),
    });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) logoMutation.mutate(file);
    e.target.value = '';
  }

  return (
    <section className="settings-section">
      <h2>{t('settings.clinicInfo.title')}</h2>

      <div className="clinic-info-form">
        <div className="clinic-info-form__logo">
          {logoUrl ? (
            <img src={logoUrl} alt={t('settings.clinicInfo.logo') ?? ''} className="clinic-logo-preview" />
          ) : (
            <div className="clinic-logo-preview clinic-logo-preview--empty">
              {t('settings.clinicInfo.noLogo')}
            </div>
          )}
          <label className="btn btn--ghost btn--small clinic-info-form__logo-btn">
            {settings?.logoPath ? t('settings.clinicInfo.changeLogo') : t('settings.clinicInfo.uploadLogo')}
            <input type="file" accept="image/*" hidden onChange={handleLogoChange} />
          </label>
        </div>

        <div className="clinic-info-form__fields">
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.clinicInfo.clinicName')}</span>
              <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </label>
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.clinicInfo.clinicPhone')}</span>
              <input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} />
            </label>
          </div>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.clinicInfo.doctorPhone')}</span>
              <input
                value={doctorPhone}
                onChange={(e) => setDoctorPhone(e.target.value)}
                placeholder={t('settings.clinicInfo.doctorPhonePlaceholder') ?? ''}
              />
            </label>
          </div>
          <label className="form-field">
            <span className="form-field__label">{t('settings.clinicInfo.address')}</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>

          <h3 className="settings-section__sub-title">{t('settings.clinicInfo.prescriptionHeader')}</h3>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.clinicInfo.doctorNameAr')}</span>
              <input value={doctorNameAr} onChange={(e) => setDoctorNameAr(e.target.value)} dir="rtl" />
            </label>
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.clinicInfo.doctorNameEn')}</span>
              <input value={doctorNameEn} onChange={(e) => setDoctorNameEn(e.target.value)} />
            </label>
          </div>
          <div className="inline-form__row">
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.clinicInfo.doctorTitleAr')}</span>
              <input value={doctorTitleAr} onChange={(e) => setDoctorTitleAr(e.target.value)} dir="rtl" />
            </label>
            <label className="form-field inline-form__col">
              <span className="form-field__label">{t('settings.clinicInfo.doctorTitleEn')}</span>
              <input value={doctorTitleEn} onChange={(e) => setDoctorTitleEn(e.target.value)} />
            </label>
          </div>
          <label className="form-field">
            <span className="form-field__label">{t('settings.clinicInfo.doctorLicenseNo')}</span>
            <input value={doctorLicenseNo} onChange={(e) => setDoctorLicenseNo(e.target.value)} />
          </label>

          {error && <div className="form-error-banner">{error}</div>}

          <div className="form-actions form-actions--start">
            {savedMessage && <span className="muted settings-saved-hint">{t('settings.clinicInfo.saved')}</span>}
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
