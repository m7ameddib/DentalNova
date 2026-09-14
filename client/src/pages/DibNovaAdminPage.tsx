import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Copy,
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
  type AdminClinicUser,
  type AdminLicensePayment,
} from '@/api/dibnova-admin.api';
import type { OnlineSubscriptionStatus } from '@/api/subscription.api';
import { getErrorMessage } from '@/utils/errors';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { useUiStore } from '@/store/ui.store';
import { todayIso } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { AdminPaymentReceiptPrintable, OperatingContractPrintable } from '@/components/admin/AdminPrintables';
import { WhatsAppIcon } from '@/components/common/WhatsAppIcon';
import { DIBNOVA_LOGIN_URL, DIBNOVA_WHATSAPP_PHONE } from '@/constants/dibnova-contact';
import { isTrialPendingStatus } from '@/utils/subscription';
import { openWhatsApp } from '@/utils/whatsapp';

const ADMIN_STATUS_OPTIONS = [
  'PENDING',
  'TRIAL_PENDING',
  'TRIAL_ACTIVE',
  'TRIAL_EXPIRED',
  'ACTIVE',
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED',
] as const;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function healthLabel(ok: boolean | null | undefined): string {
  if (ok == null) return '—';
  return ok ? 'ok' : 'down';
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
  const [signupInvite, setSignupInvite] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [clinicQuery, setClinicQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState<'BOTH' | 'ONLINE' | 'OFFLINE'>('BOTH');
  const [renewDays, setRenewDays] = useState('365');
  const [renewDate, setRenewDate] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayIso());
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNote, setPayNote] = useState('');
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [marketingDoctor, setMarketingDoctor] = useState('');
  const [marketingPhone, setMarketingPhone] = useState('');
  const [createdMarketing, setCreatedMarketing] = useState<{
    clinicId: string;
    username: string;
    password: string;
    phone: string;
  } | null>(null);
  const print = usePrintStore((s) => s.print);
  const language = useUiStore((s) => s.language);

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ['dibnova-admin-installation'],
    queryFn: dibnovaAdminApi.getInstallation,
    enabled: authenticated,
    retry: false,
  });

  useEffect(() => {
    if (!data?.clinics?.length) return;
    if (!selectedClinicId || !data.clinics.some((clinic) => clinic.clinicId === selectedClinicId)) {
      setSelectedClinicId(data.clinics[0].clinicId);
    }
  }, [data, selectedClinicId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-installation'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-trials'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-audit'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-ops-health'] });
    queryClient.invalidateQueries({ queryKey: ['dibnova-admin-history'] });
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
    queryClient.invalidateQueries({ queryKey: ['installation-status'] });
  };

  const actionMutation = useMutation({
    mutationFn: async (action: 'activate' | 'extend' | 'suspend' | 'reactivate') => {
      const clinicId = selectedClinicId || undefined;
      switch (action) {
        case 'activate':
          return dibnovaAdminApi.activate(notes, clinicId, Number(renewDays) || undefined, renewDate || undefined);
        case 'extend':
          return dibnovaAdminApi.extend(notes, clinicId, Number(renewDays) || undefined, renewDate || undefined);
        case 'suspend':
          return dibnovaAdminApi.suspend(notes, clinicId);
        case 'reactivate':
          return dibnovaAdminApi.reactivate(notes, clinicId);
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
      setCodeCopied(false);
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

  async function handleCopyGeneratedCode() {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = generatedCode;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCodeCopied(true);
    }
  }

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

  function confirmAction(messageKey: string, vars?: Record<string, string>): boolean {
    return window.confirm(t(messageKey, vars));
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
    setSuccess(null);
    queryClient.removeQueries({ queryKey: ['dibnova-admin-installation'] });
    queryClient.removeQueries({ queryKey: ['dibnova-admin-audit'] });
  }

  const isOnline = data?.deploymentMode === 'online';
  const canIssueOfflineLicenses = Boolean(data?.offlineLicensing?.canIssueOfflineLicenses);
  const onlineClinics = data?.clinics ?? [];
  const selectedClinic =
    onlineClinics.find((clinic) => clinic.clinicId === selectedClinicId) ?? onlineClinics[0] ?? null;
  const clinicReady = Boolean(selectedClinic) || (!isOnline && data?.phase === 'ready');
  const effectiveStatus: OnlineSubscriptionStatus | null = selectedClinic
    ? selectedClinic.subscription.status
    : clinicReady
      ? (data?.subscription.status ?? 'PENDING')
      : null;

  const { data: offlineSlots } = useQuery({
    queryKey: ['dibnova-admin-offline-slots'],
    queryFn: dibnovaAdminApi.listOfflineLicenseSlots,
    enabled: authenticated && canIssueOfflineLicenses,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dibnova-admin-dashboard'],
    queryFn: dibnovaAdminApi.dashboard,
    enabled: authenticated && isOnline,
  });

  const { data: trialRequests = [] } = useQuery({
    queryKey: ['dibnova-admin-trials'],
    queryFn: dibnovaAdminApi.listTrials,
    enabled: authenticated && isOnline,
  });

  const activateTrialMutation = useMutation({
    mutationFn: (clinicId: string) => dibnovaAdminApi.activateTrial(clinicId, notes),
    onSuccess: () => {
      setSuccess(t('dibnovaAdmin.success.activateTrial'));
      setError(null);
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const marketingMutation = useMutation({
    mutationFn: () => dibnovaAdminApi.createMarketingTrial(marketingDoctor.trim(), marketingPhone.trim()),
    onSuccess: (result) => {
      setCreatedMarketing({
        clinicId: result.clinicId,
        username: result.username,
        password: result.password,
        phone: result.phone,
      });
      setSelectedClinicId(result.clinicId);
      setMarketingDoctor('');
      setMarketingPhone('');
      setSuccess(t('dibnovaAdmin.success.createMarketingTrial'));
      setError(null);
      invalidate();
      void refetch();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  function sendTrialWhatsApp(phone: string, username: string, password: string) {
    const sent = openWhatsApp(
      phone || DIBNOVA_WHATSAPP_PHONE,
      t('dibnovaAdmin.trialWhatsAppMessage', {
        url: DIBNOVA_LOGIN_URL,
        username,
        password,
      }),
    );
    if (!sent) setError(t('dibnovaAdmin.trialWhatsAppMissingPhone'));
  }

  const { data: payments = [] } = useQuery({
    queryKey: ['dibnova-admin-payments', selectedClinicId],
    queryFn: () => dibnovaAdminApi.listPayments(selectedClinicId || undefined),
    enabled: authenticated && isOnline && Boolean(selectedClinicId),
  });

  const { data: history = [] } = useQuery({
    queryKey: ['dibnova-admin-history', selectedClinicId],
    queryFn: () => dibnovaAdminApi.history(selectedClinicId || undefined),
    enabled: authenticated && isOnline && Boolean(selectedClinicId),
  });

  const { data: clinicUsers = [] } = useQuery({
    queryKey: ['dibnova-admin-users', selectedClinicId],
    queryFn: () => dibnovaAdminApi.listClinicUsers(selectedClinicId),
    enabled: authenticated && isOnline && Boolean(selectedClinicId),
  });

  const { data: payBalance } = useQuery({
    queryKey: ['dibnova-admin-balance', selectedClinicId],
    queryFn: () => dibnovaAdminApi.paymentBalance(selectedClinicId),
    enabled: authenticated && isOnline && Boolean(selectedClinicId),
  });

  const { data: opsHealth } = useQuery({
    queryKey: ['dibnova-admin-ops-health'],
    queryFn: dibnovaAdminApi.opsHealth,
    enabled: authenticated && isOnline,
  });

  const { data: clinicOps } = useQuery({
    queryKey: ['dibnova-admin-clinic-ops', selectedClinicId],
    queryFn: () => dibnovaAdminApi.clinicOps(selectedClinicId),
    enabled: authenticated && isOnline && Boolean(selectedClinicId),
  });

  const { data: aiUsage = [] } = useQuery({
    queryKey: ['dibnova-admin-ai-usage'],
    queryFn: () => dibnovaAdminApi.aiUsage(),
    enabled: authenticated && isOnline,
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['dibnova-admin-audit', selectedClinicId],
    queryFn: () => dibnovaAdminApi.audit(selectedClinicId || undefined),
    enabled: authenticated && isOnline,
  });

  const filteredClinics = onlineClinics.filter((clinic) => {
    const q = clinicQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      clinic.clinicName.toLowerCase().includes(q) ||
      clinic.clinicId.toLowerCase().includes(q) ||
      (clinic.clinicPhone ?? '').includes(q);
    const matchesStatus = statusFilter === 'ALL' || clinic.subscription.status === statusFilter;
    return matchesQuery && matchesStatus;
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
              {isOnline && dashboard && (
                <section className="admin-card">
                  <h2 className="admin-card__title">{t('dibnovaAdmin.dashboard')}</h2>
                  <div className="admin-info-table-wrap">
                    <table className="admin-info-table">
                      <tbody>
                        <tr>
                          <th>{t('dibnovaAdmin.totalClinics')}</th>
                          <td>{dashboard.total}</td>
                        </tr>
                        {ADMIN_STATUS_OPTIONS.map((key) => (
                          <tr key={key}>
                            <th>{t(`dibnovaAdmin.status.${key}`)}</th>
                            <td>{dashboard.counts[key] ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="settings-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn--secondary btn--small"
                      onClick={() => {
                        void dibnovaAdminApi
                          .createSignupInvite()
                          .then((r) => {
                            setSignupInvite(r.token);
                            setSuccess(t('dibnovaAdmin.success.signupInvite'));
                          })
                          .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                      }}
                    >
                      {t('dibnovaAdmin.signupInvite')}
                    </button>
                  </div>
                  {signupInvite && (
                    <p className="muted">
                      {t('dibnovaAdmin.signupInviteOnce')}: <code className="mono-text">{signupInvite}</code>
                    </p>
                  )}
                  {opsHealth && (
                    <div className="admin-health-grid">
                      <div className={`admin-health-chip ${opsHealth.ok ? 'admin-health-chip--ok' : 'admin-health-chip--down'}`}>
                        {t('dibnovaAdmin.opsHealth')}: {opsHealth.ok ? t('dibnovaAdmin.healthOk') : t('dibnovaAdmin.healthDown')}
                      </div>
                      <div className="admin-health-chip">API {healthLabel(opsHealth.api?.ok)}</div>
                      <div className="admin-health-chip">DB {healthLabel(opsHealth.database?.ok)}</div>
                      <div className="admin-health-chip">{t('dibnovaAdmin.opsStorage')} {healthLabel(opsHealth.storage?.ok)}</div>
                      <div className="admin-health-chip">
                        {t('dibnovaAdmin.opsR2')}: {opsHealth.r2Configured ? healthLabel(opsHealth.r2?.ok) : t('dibnovaAdmin.no')}
                      </div>
                      <div className="admin-health-chip">
                        {t('dibnovaAdmin.opsDevices')}: {opsHealth.sync?.activeDevices ?? 0}/{opsHealth.sync?.registeredDevices ?? 0}
                      </div>
                      <div className="muted">
                        {opsHealth.deploymentMode} · {t('dibnovaAdmin.totalClinics')} {opsHealth.clinicCount} · uptime {opsHealth.uptimeSec}s
                      </div>
                    </div>
                  )}
                </section>
              )}

              {isOnline && (
                <section className="admin-card">
                  <h2 className="admin-card__title">{t('dibnovaAdmin.trialRequestsTitle')}</h2>
                  <p className="admin-card__note">{t('dibnovaAdmin.trialRequestsHint')}</p>
                  <div className="admin-info-table-wrap">
                    <table className="admin-info-table admin-info-table--wide">
                      <thead>
                        <tr>
                          <th>{t('dibnovaAdmin.doctorName')}</th>
                          <th>{t('dibnovaAdmin.clinicName')}</th>
                          <th>{t('dibnovaAdmin.clinicPhone')}</th>
                          <th>{t('dibnovaAdmin.requestDate')}</th>
                          <th>{t('dibnovaAdmin.subscriptionStatus')}</th>
                          <th>{t('dibnovaAdmin.trialStart')}</th>
                          <th>{t('dibnovaAdmin.trialExpiry')}</th>
                          <th>{t('dibnovaAdmin.trialTypeLabel')}</th>
                          <th>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialRequests.length === 0 && (
                          <tr>
                            <td colSpan={9}>{t('dibnovaAdmin.noTrialRequests')}</td>
                          </tr>
                        )}
                        {trialRequests.map((clinic) => (
                          <tr key={clinic.clinicId}>
                            <td>{clinic.doctorName || '—'}</td>
                            <td>{clinic.clinicName}</td>
                            <td>{clinic.clinicPhone || '—'}</td>
                            <td>{formatDate(clinic.createdAt)}</td>
                            <td>
                              <SubscriptionStatusBadge status={clinic.subscription.status} />
                            </td>
                            <td>{formatDate(clinic.subscription.startedAt)}</td>
                            <td>{formatDate(clinic.subscription.expiresAt)}</td>
                            <td>
                              {clinic.trialType
                                ? t(`dibnovaAdmin.trialType.${clinic.trialType}`)
                                : '—'}
                            </td>
                            <td>
                              <div className="admin-actions admin-actions--compact">
                                <button
                                  type="button"
                                  className="btn btn--primary btn--small"
                                  disabled={
                                    activateTrialMutation.isPending ||
                                    !isTrialPendingStatus(clinic.subscription.status)
                                  }
                                  onClick={() => {
                                    if (!confirmAction('dibnovaAdmin.activateTrialConfirm')) return;
                                    setSelectedClinicId(clinic.clinicId);
                                    activateTrialMutation.mutate(clinic.clinicId);
                                  }}
                                >
                                  {t('dibnovaAdmin.activateTrial')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {isOnline && (
                <section className="admin-card">
                  <h2 className="admin-card__title">{t('dibnovaAdmin.marketingTrialTitle')}</h2>
                  <p className="admin-card__note">{t('dibnovaAdmin.marketingTrialHint')}</p>
                  <div className="setup-grid">
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.doctorName')}</span>
                      <input
                        value={marketingDoctor}
                        onChange={(e) => setMarketingDoctor(e.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.clinicPhone')}</span>
                      <input
                        value={marketingPhone}
                        onChange={(e) => setMarketingPhone(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={
                        marketingMutation.isPending ||
                        !marketingDoctor.trim() ||
                        !marketingPhone.trim()
                      }
                      onClick={() => marketingMutation.mutate()}
                    >
                      {t('dibnovaAdmin.createMarketingTrial')}
                    </button>
                  </div>
                  {createdMarketing && (
                    <div className="admin-info-table-wrap">
                      <table className="admin-info-table">
                        <tbody>
                          <tr>
                            <th>{t('auth.username')}</th>
                            <td className="mono-text">{createdMarketing.username}</td>
                          </tr>
                          <tr>
                            <th>{t('auth.password')}</th>
                            <td className="mono-text">{createdMarketing.password}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() =>
                            sendTrialWhatsApp(
                              createdMarketing.phone,
                              createdMarketing.username,
                              createdMarketing.password,
                            )
                          }
                        >
                          <WhatsAppIcon />
                          {t('dibnovaAdmin.sendTrialWhatsApp')}
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={activateTrialMutation.isPending}
                          onClick={() => activateTrialMutation.mutate(createdMarketing.clinicId)}
                        >
                          {t('dibnovaAdmin.activateTrial')}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="admin-card">
                <h2 className="admin-card__title">{t('dibnovaAdmin.clinicInfo')}</h2>
                {onlineClinics.length > 0 && (
                  <>
                    <div className="setup-grid">
                      <label className="form-field">
                        <span className="form-field__label">{t('common.search')}</span>
                        <input value={clinicQuery} onChange={(e) => setClinicQuery(e.target.value)} />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{t('common.status')}</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                          <option value="ALL">{t('common.all')}</option>
                          {ADMIN_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{t(`dibnovaAdmin.status.${s}`)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{t('dibnovaAdmin.manageMode')}</span>
                        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}>
                          <option value="BOTH">{t('dibnovaAdmin.modeBoth')}</option>
                          <option value="ONLINE">{t('dibnovaAdmin.modeOnline')}</option>
                          <option value="OFFLINE">{t('dibnovaAdmin.modeOffline')}</option>
                        </select>
                      </label>
                    </div>
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.clinicName')}</span>
                      <select
                        value={selectedClinic?.clinicId ?? ''}
                        onChange={(e) => setSelectedClinicId(e.target.value)}
                      >
                        {filteredClinics.map((clinic) => (
                          <option key={clinic.clinicId} value={clinic.clinicId}>
                            {clinic.clinicName} ({clinic.subscription.status})
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                <div className="admin-info-table-wrap">
                  <table className="admin-info-table">
                    <tbody>
                      <tr>
                        <th>{t('dibnovaAdmin.clinicName')}</th>
                        <td>{selectedClinic?.clinicName || data.clinicName || '—'}</td>
                      </tr>
                      <tr>
                        <th>{t('dibnovaAdmin.installationId')}</th>
                        <td className="mono-text">{selectedClinic?.clinicId || data.installationId}</td>
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
                            <td>{formatDate(selectedClinic?.subscription.startedAt ?? data.subscription.startedAt)}</td>
                          </tr>
                          <tr>
                            <th>{t('dibnovaAdmin.expiryDate')}</th>
                            <td>{formatDate(selectedClinic?.subscription.expiresAt ?? data.subscription.expiresAt)}</td>
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

                  <div className="setup-grid">
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.renewDays')}</span>
                      <input type="number" min={1} value={renewDays} onChange={(e) => setRenewDays(e.target.value)} />
                    </label>
                    <label className="form-field">
                      <span className="form-field__label">{t('dibnovaAdmin.renewDate')}</span>
                      <input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
                    </label>
                  </div>
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
                      disabled={
                        actionMutation.isPending ||
                        !isTrialPendingStatus(effectiveStatus)
                      }
                      onClick={() => {
                        if (!confirmAction('dibnovaAdmin.activateConfirm')) return;
                        actionMutation.mutate('activate');
                      }}
                    >
                      {t('dibnovaAdmin.activate')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={
                        activateTrialMutation.isPending ||
                        !selectedClinic ||
                        !isTrialPendingStatus(effectiveStatus)
                      }
                      onClick={() => selectedClinic && activateTrialMutation.mutate(selectedClinic.clinicId)}
                    >
                      {t('dibnovaAdmin.activateTrial')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={
                        actionMutation.isPending ||
                        (effectiveStatus !== 'ACTIVE' && effectiveStatus !== 'TRIAL_ACTIVE')
                      }
                      onClick={() => {
                        if (!confirmAction('dibnovaAdmin.extendConfirm')) return;
                        actionMutation.mutate('extend');
                      }}
                    >
                      {t('dibnovaAdmin.extend')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={
                        actionMutation.isPending ||
                        (effectiveStatus !== 'ACTIVE' &&
                          effectiveStatus !== 'TRIAL_ACTIVE' &&
                          !isTrialPendingStatus(effectiveStatus))
                      }
                      onClick={() => {
                        if (!confirmAction('dibnovaAdmin.suspendConfirm')) return;
                        actionMutation.mutate('suspend');
                      }}
                    >
                      {t('dibnovaAdmin.suspend')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={
                        actionMutation.isPending ||
                        (effectiveStatus !== 'SUSPENDED' &&
                          effectiveStatus !== 'EXPIRED' &&
                          effectiveStatus !== 'TRIAL_EXPIRED')
                      }
                      onClick={() => {
                        if (!confirmAction('dibnovaAdmin.reactivateConfirm')) return;
                        actionMutation.mutate('reactivate');
                      }}
                    >
                      {t('dibnovaAdmin.reactivate')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={actionMutation.isPending || !selectedClinic}
                      onClick={() => {
                        if (window.confirm(t('dibnovaAdmin.cancelConfirm'))) {
                          void dibnovaAdminApi.cancel(notes, selectedClinicId).then(() => {
                            setSuccess(t('dibnovaAdmin.success.cancel'));
                            invalidate();
                          }).catch((err) => setError(getErrorMessage(err, t('common.error'))));
                        }
                      }}
                    >
                      {t('dibnovaAdmin.cancelLicense')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={!selectedClinic}
                      onClick={() => {
                        if (window.confirm(t('dibnovaAdmin.deleteConfirm'))) {
                          void dibnovaAdminApi.deleteClinic(selectedClinicId, notes).then(() => {
                            setSuccess(t('dibnovaAdmin.success.delete'));
                            setSelectedClinicId('');
                            invalidate();
                          }).catch((err) => setError(getErrorMessage(err, t('common.error'))));
                        }
                      }}
                    >
                      {t('dibnovaAdmin.deleteClinic')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={async () => {
                        const clinic = await loadClinicPrintInfo();
                        print(
                          <OperatingContractPrintable
                            clinicName={selectedClinic?.clinicName || data.clinicName}
                            clinicPhone={selectedClinic?.clinicPhone || data.clinicPhone}
                            clinicId={selectedClinic?.clinicId || data.installationId}
                            mode={data.deploymentMode}
                            status={effectiveStatus ?? '—'}
                            startedAt={selectedClinic?.subscription.startedAt ?? data.subscription.startedAt}
                            expiresAt={selectedClinic?.subscription.expiresAt ?? data.subscription.expiresAt}
                            priceCents={payBalance?.balanceCents ?? 0}
                            version={data.installationId ? '1.1.17' : '1.1.17'}
                            clinic={clinic}
                            language={language}
                          />,
                        );
                      }}
                    >
                      {t('dibnovaAdmin.printContract')}
                    </button>
                  </div>

                  {(selectedClinic?.subscription.canUseSystem ?? data.subscription.canUseSystem) && (
                    <p className="form-success-banner admin-card__success">
                      <Building2 size={14} /> {t('dibnovaAdmin.clinicCanAccess')}
                    </p>
                  )}
                </section>
              )}

              {isOnline && clinicReady && selectedClinic && (modeFilter !== 'OFFLINE') && (
                <>
                  <section className="admin-card">
                    <h2 className="admin-card__title">{t('dibnovaAdmin.paymentsTitle')}</h2>
                    <p className="muted">{t('dibnovaAdmin.paymentsBalance')}: {formatMoney(payBalance?.balanceCents ?? 0)}</p>
                    <div className="setup-grid">
                      <label className="form-field">
                        <span className="form-field__label">{t('patientRecord.account.amount')}</span>
                        <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{t('common.date')}</span>
                        <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                      </label>
                      <label className="form-field">
                        <span className="form-field__label">{t('patientRecord.account.method')}</span>
                        <input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
                      </label>
                      <label className="form-field setup-grid__full">
                        <span className="form-field__label">{t('common.note')}</span>
                        <input value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => {
                        void dibnovaAdminApi
                          .addPayment({
                            clinicId: selectedClinicId,
                            amount: Number(payAmount),
                            paymentDate: payDate,
                            method: payMethod,
                            note: payNote || undefined,
                          })
                          .then(() => {
                            setPayAmount('');
                            setSuccess(t('dibnovaAdmin.success.payment'));
                            invalidate();
                            queryClient.invalidateQueries({ queryKey: ['dibnova-admin-payments'] });
                            queryClient.invalidateQueries({ queryKey: ['dibnova-admin-balance'] });
                          })
                          .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                      }}
                    >
                      {t('dibnovaAdmin.recordPayment')}
                    </button>
                    {payments.length > 0 && (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>{t('common.date')}</th>
                              <th>{t('patientRecord.account.amount')}</th>
                              <th>{t('patientRecord.account.method')}</th>
                              <th>{t('common.status')}</th>
                              <th>{t('common.actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p: AdminLicensePayment) => (
                              <tr key={p.id}>
                                <td>{p.paymentDate}</td>
                                <td>{formatMoney(p.amountCents)}</td>
                                <td>{p.method}</td>
                                <td>{p.status}</td>
                                <td className="table-row-actions">
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--small"
                                    onClick={async () => {
                                      const clinic = await loadClinicPrintInfo();
                                      print(
                                        <AdminPaymentReceiptPrintable
                                          payment={p}
                                          clinicName={selectedClinic.clinicName}
                                          clinic={clinic}
                                          language={language}
                                        />,
                                      );
                                    }}
                                  >
                                    {t('common.print')}
                                  </button>
                                  {p.status !== 'VOID' && (
                                    <button
                                      type="button"
                                      className="btn btn--ghost btn--small btn--danger"
                                      onClick={() => {
                                        if (window.confirm(t('dibnovaAdmin.voidPaymentConfirm'))) {
                                          void dibnovaAdminApi.voidPayment(p.id, notes).then(() => {
                                            invalidate();
                                            queryClient.invalidateQueries({ queryKey: ['dibnova-admin-payments'] });
                                          });
                                        }
                                      }}
                                    >
                                      {t('common.cancel')}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {clinicOps && (
                    <section className="admin-card">
                      <h2 className="admin-card__title">{t('dibnovaAdmin.opsTitle')}</h2>
                      <div className="admin-info-table-wrap">
                        <table className="admin-info-table">
                          <tbody>
                            <tr>
                              <th>{t('dibnovaAdmin.opsPatients')}</th>
                              <td>{clinicOps.patientCount}</td>
                            </tr>
                            <tr>
                              <th>{t('dibnovaAdmin.opsBackups')}</th>
                              <td>{clinicOps.backupZipCount}</td>
                            </tr>
                            <tr>
                              <th>{t('dibnovaAdmin.opsStorage')}</th>
                              <td>{formatBytes(clinicOps.attachmentBytes)}</td>
                            </tr>
                            <tr>
                              <th>{t('dibnovaAdmin.opsDbSize')}</th>
                              <td>{formatBytes(clinicOps.clinicDbBytes ?? 0)}</td>
                            </tr>
                            <tr>
                              <th>{t('dibnovaAdmin.opsDevices')}</th>
                              <td>{(clinicOps.syncDevices ?? []).filter((d) => !d.revokedAt).length}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  <section className="admin-card">
                    <h2 className="admin-card__title">{t('dibnovaAdmin.aiUsageTitle')}</h2>
                    {aiUsage.length === 0 ? (
                      <p className="muted">{t('dibnovaAdmin.aiUsageEmpty')}</p>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('dibnovaAdmin.clinicName')}</th>
                            <th>{t('dibnovaAdmin.aiCalls')}</th>
                            <th>{t('dibnovaAdmin.aiDuration')}</th>
                            <th>{t('dibnovaAdmin.aiImages')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiUsage.map((row) => (
                            <tr key={row.clinicId || 'unknown'}>
                              <td className="mono-text">{row.clinicId || '—'}</td>
                              <td>{row.calls}</td>
                              <td>{row.durationMs}</td>
                              <td>{row.imageCalls}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p className="muted">{t('dibnovaAdmin.aiUsageCostHint')}</p>
                  </section>

                  <section className="admin-card">
                    <h2 className="admin-card__title">{t('dibnovaAdmin.usersTitle')}</h2>
                    {clinicUsers.length === 0 ? (
                      <p className="muted">{t('dibnovaAdmin.usersEmpty')}</p>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('settings.fullName')}</th>
                            <th>{t('settings.username')}</th>
                            <th>{t('settings.role')}</th>
                            <th>{t('common.status')}</th>
                            <th>{t('common.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clinicUsers.map((user: AdminClinicUser) => (
                            <tr key={user.id}>
                              <td>{user.fullName}</td>
                              <td>{user.username}</td>
                              <td>
                                <select
                                  value={user.roleName === 'employee' ? 'employee' : 'doctor'}
                                  onChange={(e) => {
                                    const roleName = e.target.value as 'doctor' | 'employee';
                                    if (!confirmAction('dibnovaAdmin.roleConfirm', { name: user.fullName, role: roleName })) return;
                                    void dibnovaAdminApi
                                      .setUserRole(selectedClinicId, user.id, roleName)
                                      .then(() => {
                                        setSuccess(t('dibnovaAdmin.success.role'));
                                        invalidate();
                                        queryClient.invalidateQueries({ queryKey: ['dibnova-admin-users'] });
                                      })
                                      .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                                  }}
                                >
                                  <option value="doctor">{t('dibnovaAdmin.roleDoctor')}</option>
                                  <option value="employee">{t('dibnovaAdmin.roleEmployee')}</option>
                                </select>
                              </td>
                              <td>{user.isActive ? t('dibnovaAdmin.userActive') : t('dibnovaAdmin.userInactive')}</td>
                              <td>
                                <div className="table-row-actions">
                                  {resetUserId === user.id ? (
                                    <>
                                      <input
                                        type="password"
                                        value={resetPassword}
                                        onChange={(e) => setResetPassword(e.target.value)}
                                        placeholder={t('auth.newPassword')}
                                        autoComplete="new-password"
                                      />
                                      <button
                                        type="button"
                                        className="btn btn--primary btn--small"
                                        onClick={() => {
                                          if (!window.confirm(t('dibnovaAdmin.resetPasswordConfirm', { name: user.fullName }))) return;
                                          void dibnovaAdminApi.resetUserPassword(selectedClinicId, user.id, resetPassword).then(() => {
                                            setResetUserId(null);
                                            setResetPassword('');
                                            setSuccess(t('dibnovaAdmin.success.resetPassword'));
                                          }).catch((err) => setError(getErrorMessage(err, t('common.error'))));
                                        }}
                                      >
                                        {t('common.save')}
                                      </button>
                                    </>
                                  ) : (
                                    <button type="button" className="btn btn--ghost btn--small" onClick={() => { setResetUserId(user.id); setResetPassword(''); }}>
                                      {t('dibnovaAdmin.resetPassword')}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--small"
                                    onClick={() => {
                                      if (!confirmAction(user.isActive ? 'dibnovaAdmin.deactivateConfirm' : 'dibnovaAdmin.activateUserConfirm', { name: user.fullName })) return;
                                      void dibnovaAdminApi
                                        .setUserStatus(selectedClinicId, user.id, !user.isActive)
                                        .then(() => {
                                          setSuccess(t(user.isActive ? 'dibnovaAdmin.success.deactivate' : 'dibnovaAdmin.success.activateUser'));
                                          invalidate();
                                          queryClient.invalidateQueries({ queryKey: ['dibnova-admin-users'] });
                                        })
                                        .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                                    }}
                                  >
                                    {user.isActive ? t('dibnovaAdmin.deactivateUser') : t('dibnovaAdmin.activateUser')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <button
                      type="button"
                      className="btn btn--secondary btn--small"
                      onClick={() => {
                        if (!window.confirm(t('auth.recoveryCodeConfirm'))) return;
                        void dibnovaAdminApi.issueRecoveryCode(selectedClinicId).then((r) => {
                          setSuccess(`${t('auth.recoveryCodeOnce')}: ${r.recoveryCode}`);
                        }).catch((err) => setError(getErrorMessage(err, t('common.error'))));
                      }}
                    >
                      {t('auth.issueRecoveryCode')}
                    </button>
                  </section>

                  <section className="admin-card">
                    <h2 className="admin-card__title">{t('dibnovaAdmin.historyTitle')}</h2>
                    {history.length === 0 ? (
                      <p className="muted">{t('dibnovaAdmin.historyEmpty')}</p>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('common.date')}</th>
                            <th>{t('dibnovaAdmin.eventType')}</th>
                            <th>{t('common.note')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((event) => (
                            <tr key={String(event.id)}>
                              <td>{String(event.created_at ?? '')}</td>
                              <td>{String(event.event_type ?? '')}</td>
                              <td>{String(event.details ?? '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>

                  <section className="admin-card">
                    <h2 className="admin-card__title">{t('dibnovaAdmin.auditTitle')}</h2>
                    {auditEvents.length === 0 ? (
                      <p className="muted">{t('dibnovaAdmin.auditEmpty')}</p>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{t('common.date')}</th>
                            <th>{t('dibnovaAdmin.auditActor')}</th>
                            <th>{t('dibnovaAdmin.eventType')}</th>
                            <th>{t('common.note')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditEvents.map((event) => (
                            <tr key={event.id}>
                              <td>{formatDate(event.createdAt)}</td>
                              <td>{event.actor}</td>
                              <td>{event.action}</td>
                              <td>{event.details || event.target || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                </>
              )}

              {canIssueOfflineLicenses && (modeFilter !== 'ONLINE') && (
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
                    <div className="activation-code-box" role="status">
                      <div className="activation-code-box__label">{t('dibnovaAdmin.generatedActivationCode')}</div>
                      <div className="activation-code-box__row">
                        <code className="activation-code-box__value">{generatedCode}</code>
                        <button
                          type="button"
                          className="btn btn--secondary btn--small activation-code-box__copy"
                          onClick={() => void handleCopyGeneratedCode()}
                        >
                          <Copy size={14} />
                          {codeCopied ? t('common.copied') : t('common.copy')}
                        </button>
                      </div>
                    </div>
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
                            <th>{t('common.actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offlineSlots.map((slot) => (
                            <tr key={slot.id}>
                              <td>{slot.clinicId}</td>
                              <td>{slot.clinicName}</td>
                              <td>{slot.status}</td>
                              <td className="mono-text">{slot.installationId ?? '—'}</td>
                              <td>
                                {slot.status === 'pending' && (
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--small btn--danger"
                                    onClick={() => {
                                      if (!confirmAction('dibnovaAdmin.revokeSlotConfirm')) return;
                                      void dibnovaAdminApi
                                        .revokeOfflineLicenseSlot(slot.id)
                                        .then(() => {
                                          setSuccess(t('dibnovaAdmin.success.revokeSlot'));
                                          queryClient.invalidateQueries({ queryKey: ['dibnova-admin-offline-slots'] });
                                        })
                                        .catch((err) => setError(getErrorMessage(err, t('common.error'))));
                                    }}
                                  >
                                    {t('dibnovaAdmin.revokeSlot')}
                                  </button>
                                )}
                              </td>
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
