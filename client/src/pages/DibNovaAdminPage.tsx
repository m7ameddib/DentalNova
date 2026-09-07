import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Lock, LogIn, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/common/BrandLogo';
import {
  clearDibNovaAdminSession,
  dibnovaAdminApi,
  isDibNovaAdminAuthenticated,
  setDibNovaAdminSession,
} from '@/api/dibnova-admin.api';
import { getErrorMessage } from '@/utils/errors';
import { useUiStore } from '@/store/ui.store';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function DibNovaAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { language, setLanguage } = useUiStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(isDibNovaAdminAuthenticated);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['dibnova-admin-installation'],
    queryFn: dibnovaAdminApi.getInstallation,
    enabled: authenticated,
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-installation'] });
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
    queryClient.invalidateQueries({ queryKey: ['installation-status'] });
  };

  const actionMutation = useMutation({
    mutationFn: async (action: 'activate' | 'extend' | 'suspend' | 'reactivate') => {
      switch (action) {
        case 'activate':
          return dibnovaAdminApi.activate(notes);
        case 'extend':
          return dibnovaAdminApi.extend(notes);
        case 'suspend':
          return dibnovaAdminApi.suspend(notes);
        case 'reactivate':
          return dibnovaAdminApi.reactivate(notes);
      }
    },
    onSuccess: (_result, action) => {
      setSuccess(t(`dibnovaAdmin.success.${action}`));
      setError(null);
      setNotes('');
      invalidate();
      refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

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

  function handleLogout() {
    clearDibNovaAdminSession();
    setAuthenticated(false);
    setUsername('');
    setPassword('');
    setError(null);
    setSuccess(null);
    queryClient.removeQueries({ queryKey: ['dibnova-admin-installation'] });
  }

  const status = data?.subscription.status;
  const isOnline = data?.deploymentMode === 'online';

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

      <div className="login-card setup-card setup-card--wide dibnova-admin-card">
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
          <ShieldCheck size={28} className="subscription-status-icon" />
          <h1>{t('dibnovaAdmin.title')}</h1>
        </div>
        <p className="login-card__subtitle">{t('dibnovaAdmin.subtitle')}</p>

        {!authenticated ? (
          <form onSubmit={handleLoginSubmit}>
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
        ) : (
          <>
            <div className="dibnova-admin-toolbar">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => refetch()}>
                <RefreshCw size={14} /> {t('common.refresh')}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                <LogOut size={14} /> {t('dibnovaAdmin.logout')}
              </button>
            </div>

            {isLoading && <p className="muted">{t('common.loading')}</p>}

            {isError && (
              <div className="form-error-banner">
                {t('dibnovaAdmin.sessionExpired')}
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                  {t('dibnovaAdmin.retryLogin')}
                </button>
              </div>
            )}

            {data && (
              <>
                <dl className="updates-info-grid">
                  <div>
                    <dt>{t('dibnovaAdmin.clinicName')}</dt>
                    <dd>{data.clinicName || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('dibnovaAdmin.installationId')}</dt>
                    <dd className="mono-text">{data.installationId}</dd>
                  </div>
                  <div>
                    <dt>{t('dibnovaAdmin.deploymentMode')}</dt>
                    <dd>{data.deploymentMode}</dd>
                  </div>
                  {isOnline && (
                    <>
                      <div>
                        <dt>{t('dibnovaAdmin.subscriptionStatus')}</dt>
                        <dd>{status ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('dibnovaAdmin.expiresAt')}</dt>
                        <dd>{formatDate(data.subscription.expiresAt)}</dd>
                      </div>
                      <div>
                        <dt>{t('dibnovaAdmin.startedAt')}</dt>
                        <dd>{formatDate(data.subscription.startedAt)}</dd>
                      </div>
                    </>
                  )}
                </dl>

                {isOnline && (
                  <>
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.notes')}</span>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder={t('dibnovaAdmin.notesPlaceholder')}
                      />
                    </label>

                    <div className="settings-actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={actionMutation.isPending || status !== 'PENDING'}
                        onClick={() => actionMutation.mutate('activate')}
                      >
                        {t('dibnovaAdmin.activate')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={actionMutation.isPending || status !== 'ACTIVE'}
                        onClick={() => actionMutation.mutate('extend')}
                      >
                        {t('dibnovaAdmin.extend')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={
                          actionMutation.isPending || (status !== 'ACTIVE' && status !== 'PENDING')
                        }
                        onClick={() => actionMutation.mutate('suspend')}
                      >
                        {t('dibnovaAdmin.suspend')}
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={
                          actionMutation.isPending ||
                          (status !== 'SUSPENDED' && status !== 'EXPIRED')
                        }
                        onClick={() => actionMutation.mutate('reactivate')}
                      >
                        {t('dibnovaAdmin.reactivate')}
                      </button>
                    </div>

                    {data.subscription.canUseSystem && (
                      <p className="form-success-banner">
                        <Building2 size={14} /> {t('dibnovaAdmin.clinicCanAccess')}
                      </p>
                    )}
                  </>
                )}

                {!isOnline && data.offlineLicense && (
                  <p className="muted">
                    {t('dibnovaAdmin.offlineLicenseInfo', {
                      activated: data.offlineLicense.hasLicense
                        ? t('dibnovaAdmin.yes')
                        : t('dibnovaAdmin.no'),
                    })}
                    {data.offlineLicense.activatedAt && (
                      <>
                        {' '}
                        ({t('dibnovaAdmin.activatedAt', {
                          date: formatDate(data.offlineLicense.activatedAt),
                        })})
                      </>
                    )}
                  </p>
                )}
              </>
            )}
          </>
        )}

        {authenticated && error && <div className="form-error-banner">{error}</div>}
        {success && <div className="form-success-banner">{success}</div>}

        <p className="muted dibnova-admin-footer">
          <Link to="/subscription-status">{t('dibnovaAdmin.backToClinicStatus')}</Link>
          {' · '}
          <Link to="/login">{t('nav.login', 'Login')}</Link>
        </p>
      </div>

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
