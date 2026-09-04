import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { installationApi } from '@/api/installation.api';
import { useUiStore } from '@/store/ui.store';

export function ActivationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useUiStore();
  const [license, setLicense] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
  });

  async function handleSubmit(e: FormEvent) {
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

      <form className="login-card setup-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
        </div>
        <p className="login-card__subtitle">{t('installation.activateTitle')}</p>
        <p className="muted setup-card__id">
          {t('installation.installationId')}: <code>{status?.installationId ?? '…'}</code>
        </p>

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

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
