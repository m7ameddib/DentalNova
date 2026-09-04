import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Server } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { setApiBaseUrl } from '@/api/api-config';
import { checkServerHealth } from '@/api/installation.api';
import { useUiStore } from '@/store/ui.store';

export function ServerConfigPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, setLanguage } = useUiStore();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('4000');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedHost = host.trim().replace(/\/+$/, '');
    if (!trimmedHost) {
      setError(t('installation.serverHostRequired'));
      return;
    }
    const apiBase = `http://${trimmedHost}:${port.trim()}/api`;
    setApiBaseUrl(apiBase);
    setLoading(true);
    try {
      const ok = await checkServerHealth();
      if (!ok) {
        setError(t('installation.serverUnavailable'));
        return;
      }
      navigate('/', { replace: true });
    } catch {
      setError(t('installation.serverUnavailable'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__lang">
        <button className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'} onClick={() => setLanguage('en')}>EN</button>
        <button className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'} onClick={() => setLanguage('ar')}>AR</button>
      </div>

      <form className="login-card setup-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
        </div>
        <p className="login-card__subtitle">{t('installation.clientConnectTitle')}</p>

        <label className="form-field">
          <span className="form-field__label">
            <Server size={14} /> {t('installation.mainServerHost')}
          </span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="DNT-DENTAL-SERVER"
            required
          />
        </label>
        <label className="form-field">
          <span className="form-field__label">{t('installation.serverPort')}</span>
          <input value={port} onChange={(e) => setPort(e.target.value)} required />
        </label>

        {error && <div className="form-error-banner">{error}</div>}

        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {t('installation.connectServer')}
        </button>
      </form>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
