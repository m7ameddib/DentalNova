import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Building2, Eye, EyeOff, Globe, Lock, LogIn, UserRound } from 'lucide-react';
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
import { apiClient } from '@/api/client';
import { syncWhenOnline } from '@/offline/intercept';
import { useOfflineStatusStore } from '@/offline/status.store';
import { defaultLandingPath } from '@/utils/landingPath';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { language, setLanguage } = useUiStore();

  const [username, setUsername] = useState(getRememberedUsername);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(getRememberedUsername()));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: installStatus, isFetched: installReady } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });

  const isOnline = installStatus?.deploymentMode === 'online';
  const canCreateClinic = Boolean(isOnline && installStatus?.canCreateClinic !== false);
  const clinicReady = installStatus?.phase === 'ready';

  useEffect(() => {
    if ((location.state as { resetSuccess?: boolean } | null)?.resetSuccess) {
      setSuccess(t('auth.resetSuccess'));
      navigate('/login', { replace: true, state: null });
    }
  }, [location.state, navigate, t]);

  useEffect(() => {
    if (!installReady || !isAuthenticated) return;
    if (installStatus?.phase === 'setup') {
      logout();
    }
  }, [installReady, installStatus?.phase, isAuthenticated, logout]);

  if (installReady && isAuthenticated && clinicReady) {
    const landing = defaultLandingPath(useAuthStore.getState().user?.permissions);
    return <Navigate to={landing} replace />;
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
      useOfflineStatusStore.getState().setNeedsReauth(false);
      void syncWhenOnline(apiClient);
      navigate(defaultLandingPath(user.permissions), { replace: true });
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page login-page--entry">
      <div className="login-page__lang">
        <Globe size={14} />
        <button
          type="button"
          className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <span className="login-page__lang-sep">|</span>
        <button
          type="button"
          className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
          onClick={() => setLanguage('ar')}
        >
          عربي
        </button>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        {isOnline && (
          <Link to="/" className="setup-back-link">
            {t('auth.backToHome')}
          </Link>
        )}
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
          <h1>{t('auth.welcomeBack')}</h1>
          <p className="login-card__subtitle">{t('auth.welcomeBackSubtitle')}</p>
        </div>

        <label className="form-field">
          <span className="form-field__label">{t('auth.username')}</span>
          <span className="login-form-panel__control">
            <UserRound size={16} />
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder={t('auth.usernamePlaceholder')}
              required
            />
          </span>
        </label>

        <label className="form-field">
          <span className="form-field__label">{t('auth.password')}</span>
          <span className="login-form-panel__control">
            <Lock size={16} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              required
            />
            <button
              type="button"
              className="login-form-panel__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={t('auth.password')}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
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
          <Link to="/forgot-password" className="login-card__forgot-link">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        {success && <div className="form-info-banner">{success}</div>}
        {error && <div className="form-error-banner">{error}</div>}

        <button className="btn btn--primary btn--block login-card__submit" type="submit" disabled={loading}>
          <LogIn size={16} />
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </button>

        {canCreateClinic && (
          <div className="login-form-panel__secondary">
            <p className="login-card__secondary-label">{t('auth.tryFreeShort')}</p>
            <Link to="/setup" className="btn btn--ghost btn--block login-card__create-clinic">
              <Building2 size={16} />
              {t('auth.createNewClinic')}
            </Link>
          </div>
        )}
      </form>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
