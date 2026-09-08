import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/common/BrandLogo';
import { AuthLangSwitch } from '@/components/auth/AuthLangSwitch';
import { SubscriptionStatusBadge } from '@/components/admin/SubscriptionStatusBadge';
import {
  clearDibNovaAdminSession,
  dibnovaAdminApi,
  isDibNovaAdminAuthenticated,
  setDibNovaAdminSession,
} from '@/api/dibnova-admin.api';
import type { OnlineSubscriptionStatus } from '@/api/subscription.api';
import { getErrorMessage } from '@/utils/errors';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function DibNovaAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(isDibNovaAdminAuthenticated);
  const [notes, setNotes] = useState('');
  const [offlineClinicId, setOfflineClinicId] = useState('');
  const [offlineClinicName, setOfflineClinicName] = useState('');
  const [offlineInstallationId, setOfflineInstallationId] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
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
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const createOfflineSlotMutation = useMutation({
    mutationFn: () =>
      dibnovaAdminApi.createOfflineLicenseSlot({
        clinicId: offlineClinicId.trim(),
        clinicName: offlineClinicName.trim(),
        installationId: offlineInstallationId.trim() || undefined,
        adminNotes: notes.trim() || undefined,
      }),
    onSuccess: (result) => {
      setGeneratedCode(result.activationCode);
      setSuccess(t('dibnovaAdmin.success.createOfflineSlot'));
      setError(null);
      setOfflineClinicId('');
      setOfflineClinicName('');
      setOfflineInstallationId('');
      setNotes('');
      invalidate();
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

  const isOnline = data?.deploymentMode === 'online';
  const canIssueOfflineLicenses = Boolean(data?.offlineLicensing?.canIssueOfflineLicenses);
  const clinicReady = data?.phase === 'ready';
  const effectiveStatus: OnlineSubscriptionStatus | null = clinicReady
    ? (data?.subscription.status ?? 'PENDING')
    : null;

  const { data: offlineSlots } = useQuery({
    queryKey: ['dibnova-admin-offline-slots'],
    queryFn: dibnovaAdminApi.listOfflineLicenseSlots,
    enabled: authenticated && canIssueOfflineLicenses,
  });

  return (
    <div className="login-page login-page--entry login-page--admin">
      <AuthLangSwitch />

      {!authenticated ? (
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
      ) : (
        <div className="dibnova-admin-dashboard">
          <header className="dibnova-admin-dashboard__header">
            <div className="dibnova-admin-dashboard__title">
              <ShieldCheck size={24} />
              <div>
                <h1>{t('dibnovaAdmin.title')}</h1>
                <p>{t('dibnovaAdmin.dashboardSubtitle')}</p>
              </div>
            </div>
            <div className="dibnova-admin-toolbar">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => refetch()}>
                <RefreshCw size={14} /> {t('common.refresh')}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                <LogOut size={14} /> {t('dibnovaAdmin.logout')}
              </button>
            </div>
          </header>

          {success && <div className="form-success-banner dibnova-admin-dashboard__alert">{success}</div>}
          {error && <div className="form-error-banner dibnova-admin-dashboard__alert">{error}</div>}

          {isLoading && <p className="muted dibnova-admin-dashboard__loading">{t('common.loading')}</p>}

          {isError && (
            <div className="form-error-banner dibnova-admin-dashboard__alert">
              {t('dibnovaAdmin.sessionExpired')}
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                {t('dibnovaAdmin.retryLogin')}
              </button>
            </div>
          )}

          {data && (
            <>
              <section className="admin-card">
                <h2 className="admin-card__title">{t('dibnovaAdmin.clinicInfo')}</h2>
                <div className="admin-info-table-wrap">
                  <table className="admin-info-table">
                    <tbody>
                      <tr>
                        <th>{t('dibnovaAdmin.clinicName')}</th>
                        <td>{data.clinicName || '—'}</td>
                      </tr>
                      <tr>
                        <th>{t('dibnovaAdmin.installationId')}</th>
                        <td className="mono-text">{data.installationId}</td>
                      </tr>
                      <tr>
                        <th>{t('dibnovaAdmin.deploymentMode')}</th>
                        <td>{data.deploymentMode}</td>
                      </tr>
                      {isOnline && (
                        <>
                          <tr>
                            <th>{t('dibnovaAdmin.subscriptionStatus')}</th>
                            <td>
                              <SubscriptionStatusBadge
                                status={clinicReady ? effectiveStatus : 'SETUP'}
                              />
                            </td>
                          </tr>
                          <tr>
                            <th>{t('dibnovaAdmin.startDate')}</th>
                            <td>{formatDate(data.subscription.startedAt)}</td>
                          </tr>
                          <tr>
                            <th>{t('dibnovaAdmin.expiryDate')}</th>
                            <td>{formatDate(data.subscription.expiresAt)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {!isOnline && data.offlineLicense && (
                  <p className="admin-card__note">
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
              </section>

              {isOnline && !clinicReady && (
                <section className="admin-card admin-card--warning">
                  <p>{t('dibnovaAdmin.setupRequiredMessage')}</p>
                </section>
              )}

              {isOnline && clinicReady && (
                <section className="admin-card">
                  <h2 className="admin-card__title">{t('dibnovaAdmin.subscriptionManagement')}</h2>

                  <label className="form-field">
                    <span className="form-field__label">{t('dibnovaAdmin.notes')}</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder={t('dibnovaAdmin.notesPlaceholder')}
                    />
                  </label>

                  <div className="admin-actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={actionMutation.isPending || effectiveStatus !== 'PENDING'}
                      onClick={() => actionMutation.mutate('activate')}
                    >
                      {t('dibnovaAdmin.activate')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={actionMutation.isPending || effectiveStatus !== 'ACTIVE'}
                      onClick={() => actionMutation.mutate('extend')}
                    >
                      {t('dibnovaAdmin.extend')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={
                        actionMutation.isPending ||
                        (effectiveStatus !== 'ACTIVE' && effectiveStatus !== 'PENDING')
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
                        (effectiveStatus !== 'SUSPENDED' && effectiveStatus !== 'EXPIRED')
                      }
                      onClick={() => actionMutation.mutate('reactivate')}
                    >
                      {t('dibnovaAdmin.reactivate')}
                    </button>
                  </div>

                  {data.subscription.canUseSystem && (
                    <p className="form-success-banner admin-card__success">
                      <Building2 size={14} /> {t('dibnovaAdmin.clinicCanAccess')}
                    </p>
                  )}
                </section>
              )}

              {canIssueOfflineLicenses && (
                <section className="admin-card">
                  <h2 className="admin-card__title">{t('dibnovaAdmin.offlineLicensingTitle')}</h2>
                  <p className="muted admin-card__note">{t('dibnovaAdmin.offlineLicensingHint')}</p>

                  <div className="setup-grid">
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.offlineClinicId')}</span>
                      <input
                        value={offlineClinicId}
                        onChange={(e) => setOfflineClinicId(e.target.value)}
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.offlineClinicName')}</span>
                      <input
                        value={offlineClinicName}
                        onChange={(e) => setOfflineClinicName(e.target.value)}
                        required
                      />
                    </label>
                    <label className="form-field setup-grid__full">
                      <span className="form-field__label">{t('dibnovaAdmin.offlineInstallationIdOptional')}</span>
                      <input
                        value={offlineInstallationId}
                        onChange={(e) => setOfflineInstallationId(e.target.value)}
                        className="mono-text"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={
                      createOfflineSlotMutation.isPending ||
                      !offlineClinicId.trim() ||
                      !offlineClinicName.trim()
                    }
                    onClick={() => createOfflineSlotMutation.mutate()}
                  >
                    {t('dibnovaAdmin.createOfflineSlot')}
                  </button>

                  {generatedCode && (
                    <p className="form-success-banner admin-card__success mono-text">
                      {t('dibnovaAdmin.generatedActivationCode')}: <strong>{generatedCode}</strong>
                    </p>
                  )}

                  {offlineSlots && offlineSlots.length > 0 && (
                    <div className="admin-table-wrap">
                      <h3 className="admin-card__subtitle">{t('dibnovaAdmin.offlineSlotsTitle')}</h3>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('dibnovaAdmin.offlineClinicId')}</th>
                            <th>{t('dibnovaAdmin.offlineClinicName')}</th>
                            <th>{t('dibnovaAdmin.offlineSlotStatus')}</th>
                            <th>{t('dibnovaAdmin.installationId')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offlineSlots.map((slot) => (
                            <tr key={slot.id}>
                              <td>{slot.clinicId}</td>
                              <td>{slot.clinicName}</td>
                              <td>{slot.status}</td>
                              <td className="mono-text">{slot.installationId ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          <footer className="dibnova-admin-dashboard__footer muted">
            <Link to="/login">{t('nav.login', 'Login')}</Link>
          </footer>
        </div>
      )}

      <p className="login-page__branding">{t('app.poweredBy')}</p>
    </div>
  );
}
