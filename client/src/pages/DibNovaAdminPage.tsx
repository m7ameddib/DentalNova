import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AuthLangSwitch } from '@/components/auth/AuthLangSwitch';
import {
  clearDibNovaAdminSession,
  dibnovaAdminApi,
  isDibNovaAdminAuthenticated,
  setDibNovaAdminSession,
} from '@/api/dibnova-admin.api';
import { getErrorMessage } from '@/utils/errors';
import { AdminDashboardProvider } from '@/components/admin/AdminDashboardContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { ADMIN_BASE_PATH } from '@/components/admin/admin-utils';

export function DibNovaAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(isDibNovaAdminAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoginLoading(true);
    setError(null);
    try {
      const { accessToken, user } = await dibnovaAdminApi.login(username.trim(), password);
      setDibNovaAdminSession(accessToken, user);
      setAuthenticated(true);
      setPassword('');
    } catch (err) {
      setError(getErrorMessage(err, t('dibnovaAdmin.invalidCredentials')));
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      if (isDibNovaAdminAuthenticated()) {
        await dibnovaAdminApi.logout();
      }
    } catch {
      /* session is cleared below either way */
    }
    clearDibNovaAdminSession();
    setAuthenticated(false);
    setUsername('');
    setPassword('');
    setError(null);
    queryClient.removeQueries({ queryKey: ['dibnova-admin-installation'] });
    queryClient.removeQueries({ queryKey: ['dibnova-admin-audit'] });
    void navigate(ADMIN_BASE_PATH, { replace: true });
  }

  if (!authenticated) {
    return (
      <div className="login-page login-page--entry login-page--admin">
        <AuthLangSwitch />
        <div className="dibnova-admin-login">
          <form className="dibnova-admin-login__card" onSubmit={handleLoginSubmit}>
            <div className="dibnova-admin-login__brand">
              <BrandLogo variant="auth-lg" />
              <ShieldCheck size={28} className="dibnova-admin-login__icon" />
              <h1>{t('dibnovaAdmin.title')}</h1>
              <p>{t('dibnovaAdmin.subtitle')}</p>
            </div>

            <label className="form-field">
              <span className="form-field__label">
                <UserRound size={14} /> {t('auth.username')}
              </span>
              <input
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
            {error && <div className="form-error-banner">{error}</div>}
            <button type="submit" className="btn btn--primary btn--block login-card__submit" disabled={loginLoading}>
              <LogIn size={16} />
              {loginLoading ? t('auth.signingIn') : t('dibnovaAdmin.signIn')}
            </button>
          </form>
        </div>
        <p className="login-page__branding">{t('app.poweredBy')}</p>
      </div>
    );
  }

  return (
    <AdminDashboardProvider>
      <AdminShell onLogout={() => void handleLogout()} />
    </AdminDashboardProvider>
  );
}
