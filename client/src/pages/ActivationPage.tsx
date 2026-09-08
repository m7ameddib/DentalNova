import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Cloud, KeyRound } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { installationApi } from '@/api/installation.api';
import { useUiStore } from '@/store/ui.store';

type ActivationMode = 'manual' | 'online';

export function ActivationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useUiStore();
  const [mode, setMode] = useState<ActivationMode>('online');
  const [license, setLicense] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
  });

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await installationApi.activate(license.trim());
      navigate('/setup', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        t('installation.activateError');
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleOnlineSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await installationApi.activateOnline({
        activationCode: activationCode.trim(),
        clinicName: clinicName.trim() || undefined,
      });
      navigate('/setup', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        t('installation.activateOnlineError');
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__lang">
        <button
          className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('ar')}
        >
          AR
        </button>
      </div>

      <div className="login-card setup-card">
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
        </div>
        <p className="login-card__subtitle">{t('installation.activateTitle')}</p>
        <p className="muted setup-card__id">
          {t('installation.installationId')}: <code>{status?.installationId ?? '…'}</code>
        </p>

        <div className="activation-mode-tabs" role="tablist" aria-label={t('installation.activateTitle')}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'online'}
            className={mode === 'online' ? 'activation-mode-tabs__btn activation-mode-tabs__btn--active' : 'activation-mode-tabs__btn'}
            onClick={() => {
              setMode('online');
              setError(null);
            }}
          >
            <Cloud size={16} /> {t('installation.activateOnlineTab')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            className={mode === 'manual' ? 'activation-mode-tabs__btn activation-mode-tabs__btn--active' : 'activation-mode-tabs__btn'}
            onClick={() => {
              setMode('manual');
              setError(null);
            }}
          >
            <KeyRound size={16} /> {t('installation.activateManualTab')}
          </button>
        </div>

        {mode === 'online' ? (
          <form onSubmit={handleOnlineSubmit}>
            <p className="muted activation-mode-hint">{t('installation.activateOnlineHint')}</p>

            <label className="form-field">
              <span className="form-field__label">{t('installation.activationCode')}</span>
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder={t('installation.activationCodePlaceholder') ?? ''}
                autoComplete="off"
                required
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">{t('installation.clinicNameOptional')}</span>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder={t('installation.clinicNameOptionalPlaceholder') ?? ''}
              />
            </label>

            {error && <div className="form-error-banner">{error}</div>}

            <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
              {t('installation.activateOnlineAction')}
            </button>

            <p className="muted activation-mode-footnote">{t('installation.activateOnlineFootnote')}</p>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit}>
            <p className="muted activation-mode-hint">{t('installation.activateManualHint')}</p>

            <label className="form-field">
              <span className="form-field__label">
                <KeyRound size={14} /> {t('installation.licenseKey')}
              </span>
              <textarea
                rows={5}
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder={t('installation.licensePlaceholder') ?? ''}
                required
              />
            </label>

            {error && <div className="form-error-banner">{error}</div>}

            <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
              {t('installation.activateAction')}
            </button>
          </form>
        )}
      </div>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
