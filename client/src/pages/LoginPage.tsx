import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CloudOff,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  Heart,
  Lock,
  LogIn,
  MonitorSmartphone,
  DollarSign,
  ShieldCheck,
  Smile,
  UserRound,
  Users,
} from 'lucide-react';
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

const FEATURES = [
  { icon: Users, titleKey: 'auth.featurePatientsTitle', textKey: 'auth.featurePatientsText' },
  { icon: CalendarDays, titleKey: 'auth.featureAppointmentsTitle', textKey: 'auth.featureAppointmentsText' },
  { icon: Smile, titleKey: 'auth.featureTreatmentsTitle', textKey: 'auth.featureTreatmentsText' },
  { icon: DollarSign, titleKey: 'auth.featureBillingTitle', textKey: 'auth.featureBillingText' },
  { icon: FlaskConical, titleKey: 'auth.featureLabTitle', textKey: 'auth.featureLabText' },
  { icon: BarChart3, titleKey: 'auth.featureReportsTitle', textKey: 'auth.featureReportsText' },
] as const;

const AI_POINTS = [
  'auth.aiPointChat',
  'auth.aiPointAnalyze',
  'auth.aiPointCreate',
  'auth.aiPointInsights',
  'auth.aiPointLanguages',
] as const;

const TRUST = [
  { icon: ShieldCheck, titleKey: 'auth.trustSecureTitle', textKey: 'auth.trustSecureText' },
  { icon: CloudOff, titleKey: 'auth.trustOfflineTitle', textKey: 'auth.trustOfflineText' },
  { icon: MonitorSmartphone, titleKey: 'auth.trustDevicesTitle', textKey: 'auth.trustDevicesText' },
  { icon: Heart, titleKey: 'auth.trustDentistsTitle', textKey: 'auth.trustDentistsText' },
] as const;

const SUPPORT_WHATSAPP_URL = 'https://wa.me/96170793486';

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
      useOfflineStatusStore.getState().setNeedsReauth(false);
      void syncWhenOnline(apiClient);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page login-page--entry login-page--showcase">
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

      <div className="login-entry">
        <aside className="login-entry__hero">
          <div className="login-entry__copy">
            <h2 className="login-entry__hero-title">{t('auth.heroHeadline')}</h2>
            <p className="login-entry__hero-text">{t('auth.heroLead')}</p>

            <ul className="login-entry__features">
              {FEATURES.map(({ icon: Icon, titleKey, textKey }) => (
                <li key={titleKey} className="login-entry__feature">
                  <span className="login-entry__feature-icon">
                    <Icon size={18} />
                  </span>
                  <strong>{t(titleKey)}</strong>
                  <span>{t(textKey)}</span>
                </li>
              ))}
            </ul>

            <div className="login-entry__ai">
              <div className="login-entry__ai-bot" aria-hidden="true">
                <Bot size={36} />
              </div>
              <div className="login-entry__ai-copy">
                <h3>{t('auth.aiTitle')}</h3>
                <p>{t('auth.aiIntro')}</p>
                <p className="login-entry__ai-quote">{t('auth.aiQuote')}</p>
              </div>
              <ul className="login-entry__ai-points">
                {AI_POINTS.map((key) => (
                  <li key={key}>
                    <Check size={13} />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <p className="login-entry__ai-script">{t('auth.aiScript')}</p>
            </div>

            <ul className="login-entry__trust">
              {TRUST.map(({ icon: Icon, titleKey, textKey }) => (
                <li key={titleKey}>
                  <Icon size={16} />
                  <strong>{t(titleKey)}</strong>
                  <span>{t(textKey)}</span>
                </li>
              ))}
            </ul>
          </div>

          <figure className="login-entry__clinic">
            <img src="/assets/login-clinic.jpg" alt="" />
          </figure>
        </aside>

        <div className="login-entry__main login-entry__main--form">
          <form className="login-form-panel" onSubmit={handleSubmit}>
            <div className="login-form-panel__brand">
              <BrandLogo variant="auth-lg" />
              <p className="login-entry__tagline">{t('auth.tagline')}</p>
              <h1>{t('auth.welcomeBack')}</h1>
              <p className="login-form-panel__subtitle">{t('auth.welcomeBackSubtitle')}</p>
            </div>

            <label className="form-field login-form-panel__field">
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

            <label className="form-field login-form-panel__field">
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

            <div className="login-card__divider">
              <span>{t('auth.or')}</span>
            </div>

            <a
              className="btn btn--ghost btn--block login-card__support"
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.8-1.48-1.78-1.66-2.08-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.13 3.25 5.16 4.56.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"
                />
                <path
                  fill="currentColor"
                  d="M12.04 2C6.5 2 2 6.43 2 11.88c0 1.75.47 3.45 1.35 4.96L2 22l5.3-1.38c1.46.79 3.1 1.21 4.74 1.21h.01c5.54 0 10.04-4.43 10.04-9.88C22.09 6.43 17.58 2 12.04 2Zm0 18.07h-.01c-1.5 0-2.97-.4-4.25-1.15l-.3-.18-3.14.82.84-3.04-.2-.31a8.1 8.1 0 0 1-1.25-4.33c0-4.5 3.72-8.16 8.3-8.16 4.57 0 8.3 3.66 8.3 8.16 0 4.5-3.73 8.19-8.3 8.19Z"
                />
              </svg>
              {t('auth.contactSupport')}
            </a>

            {canCreateClinic && (
              <div className="login-form-panel__secondary">
                <p className="login-card__secondary-label">{t('auth.newClinicPrompt')}</p>
                <Link to="/setup" className="btn btn--ghost btn--block login-card__create-clinic">
                  <Building2 size={16} />
                  {t('auth.createNewClinic')}
                </Link>
              </div>
            )}

            <blockquote className="login-form-panel__testimonial">
              <p>{t('auth.loginQuote')}</p>
              <cite>{t('auth.loginQuoteBy')}</cite>
            </blockquote>
          </form>
        </div>
      </div>
    </div>
  );
}
