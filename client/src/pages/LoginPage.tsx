import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Building2, Lock, LogIn, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { authApi } from '@/api/auth.api';
import { installationApi } from '@/api/installation.api';
import {
  getRememberedUsername,
  setRememberedUsername,
  clearRememberedUsername,
  useAuthStore,
} from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { language, setLanguage } = useUiStore();

  const [username, setUsername] = useState(getRememberedUsername);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(getRememberedUsername()));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: installStatus, isFetched: installReady } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });

  const isOnline = installStatus?.deploymentMode === 'online';
  const canCreateClinic = isOnline && installStatus?.phase === 'setup';
  const clinicReady = installStatus?.phase === 'ready';

  // Stale clinic JWT while server is still in setup causes /login ↔ / redirect loop (blank page).
  useEffect(() => {
    if (!installReady || !isAuthenticated) return;
    if (installStatus?.phase === 'setup') {
      logout();
    }
  }, [installReady, installStatus?.phase, isAuthenticated, logout]);

  if (installReady && isAuthenticated && clinicReady) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.login(username, password);
      if (rememberMe) {
        setRememberedUsername(username);
      } else {
        clearRememberedUsername();
      }
      setSession(accessToken, user, rememberMe);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page login-page--entry">
      <div className="login-page__lang">
        <button
          type="button"
          className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          type="button"
          className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('ar')}
        >
          AR
        </button>
      </div>

      <div className="login-entry">
        <aside className="login-entry__hero" aria-hidden="true">
          <BrandLogo variant="auth" />
          <h2 className="login-entry__hero-title">{t('auth.heroTitle')}</h2>
          <p className="login-entry__hero-text">{t('auth.heroSubtitle')}</p>
          <ul className="login-entry__hero-list">
            <li>{t('auth.heroFeaturePatients')}</li>
            <li>{t('auth.heroFeatureAppointments')}</li>
            <li>{t('auth.heroFeatureRecords')}</li>
          </ul>
        </aside>

        <div className="login-entry__main">
          <form className="login-card login-card--entry" onSubmit={handleSubmit}>
            <div className="login-card__brand">
              <BrandLogo variant="auth" />
              <h1>{t('auth.title')}</h1>
            </div>
            <p className="login-card__subtitle">{t('auth.subtitle')}</p>

            <label className="form-field">
              <span className="form-field__label">
                <UserRound size={14} /> {t('auth.username')}
              </span>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder={t('auth.usernamePlaceholder')}
                required
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">
                <Lock size={14} /> {t('auth.password')}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
            </label>

            <div className="login-card__options">
              <label className="login-card__remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>{t('auth.rememberMe')}</span>
              </label>
              <span className="login-card__forgot-hint" title={t('auth.forgotPasswordHint')}>
                {t('auth.forgotPassword')}
              </span>
            </div>

            {error && <div className="form-error-banner">{error}</div>}

            <button className="btn btn--primary btn--block login-card__submit" type="submit" disabled={loading}>
              <LogIn size={16} />
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>

            {canCreateClinic && (
              <>
                <div className="login-card__divider">
                  <span>{t('auth.or')}</span>
                </div>
                <div className="login-card__secondary">
                  <p className="login-card__secondary-label">{t('auth.newClinicPrompt')}</p>
                  <Link to="/setup" className="btn btn--secondary btn--block login-card__create-clinic">
                    <Building2 size={16} />
                    {t('auth.createNewClinic')}
                  </Link>
                </div>
              </>
            )}
          </form>
        </div>
      </div>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
