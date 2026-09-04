import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/common/BrandLogo';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { language, setLanguage } = useUiStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.login(username, password);
      setSession(accessToken, user);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth.invalidCredentials'));
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

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
        </div>
        <p className="login-card__subtitle">{t('auth.subtitle')}</p>

        <label className="form-field">
          <span className="form-field__label">{t('auth.username')}</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-field__label">{t('auth.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="form-error-banner">{error}</div>}

        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {t('auth.signIn')}
        </button>
      </form>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
