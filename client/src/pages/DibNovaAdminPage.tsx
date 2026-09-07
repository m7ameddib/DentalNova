import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/common/BrandLogo';
import {
  clearDibNovaAdminKey,
  dibnovaAdminApi,
  getDibNovaAdminKey,
  setDibNovaAdminKey,
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
  const [adminKey, setAdminKey] = useState(getDibNovaAdminKey() ?? '');
  const [authenticated, setAuthenticated] = useState(Boolean(getDibNovaAdminKey()));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  function handleKeySubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminKey.trim()) return;
    setDibNovaAdminKey(adminKey.trim());
    setAuthenticated(true);
    setError(null);
  }

  function handleLogout() {
    clearDibNovaAdminKey();
    setAuthenticated(false);
    setAdminKey('');
    setError(null);
    setSuccess(null);
  }

  const status = data?.subscription.status;
  const isOnline = data?.deploymentMode === 'online';

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

      <div className="login-card setup-card setup-card--wide dibnova-admin-card">
        <div className="login-card__brand">
          <BrandLogo variant="auth" />
          <ShieldCheck size={28} className="subscription-status-icon" />
          <h1>{t('dibnovaAdmin.title')}</h1>
        </div>
        <p className="login-card__subtitle">{t('dibnovaAdmin.subtitle')}</p>

        {!authenticated ? (
          <form onSubmit={handleKeySubmit}>
            <label className="form-field">
              <span className="form-field__label">
                <KeyRound size={14} /> {t('dibnovaAdmin.apiKey')}
              </span>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder={t('dibnovaAdmin.apiKeyPlaceholder')}
                required
                autoComplete="off"
              />
            </label>
            <button type="submit" className="btn btn--primary btn--block">
              {t('dibnovaAdmin.unlock')}
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
                {t('dibnovaAdmin.invalidKey')}
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
                  </p>
                )}
              </>
            )}
          </>
        )}

        {error && <div className="form-error-banner">{error}</div>}
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
