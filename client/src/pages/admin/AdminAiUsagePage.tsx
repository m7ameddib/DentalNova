import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminClinicScopeBanner } from '@/components/admin/AdminClinicScopeBanner';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { dibnovaAdminApi } from '@/api/dibnova-admin.api';
import { getErrorMessage } from '@/utils/errors';

export function AdminAiUsagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isOnline, aiUsage, selectedClinic, selectedClinicId, setError, setSuccess } = useAdminDashboard();

  const [subscriptionCredits, setSubscriptionCredits] = useState('');
  const [renewalCredits, setRenewalCredits] = useState('');
  const [renewalPriceUsd, setRenewalPriceUsd] = useState('');
  const [addCredits, setAddCredits] = useState('');

  const { data: aiSettings } = useQuery({
    queryKey: ['dibnova-admin-ai-settings'],
    queryFn: () => dibnovaAdminApi.aiSettings(),
    enabled: isOnline,
  });

  const { data: clinicCredits, refetch: refetchClinicCredits } = useQuery({
    queryKey: ['dibnova-admin-clinic-ai-credits', selectedClinicId],
    queryFn: () => dibnovaAdminApi.clinicAiCredits(selectedClinicId),
    enabled: isOnline && Boolean(selectedClinicId),
  });

  useEffect(() => {
    if (!aiSettings) return;
    setSubscriptionCredits(String(aiSettings.subscriptionAiCredits));
    setRenewalCredits(String(aiSettings.renewalPackageCredits));
    setRenewalPriceUsd(String(aiSettings.renewalPackagePriceCents / 100));
  }, [aiSettings]);

  const invalidateAi = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dibnova-admin-ai-usage'] });
    await queryClient.invalidateQueries({ queryKey: ['dibnova-admin-ai-settings'] });
    if (selectedClinicId) {
      await queryClient.invalidateQueries({ queryKey: ['dibnova-admin-clinic-ai-credits', selectedClinicId] });
    }
  };

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      dibnovaAdminApi.updateAiSettings({
        subscriptionAiCredits: Number(subscriptionCredits),
        renewalPackageCredits: Number(renewalCredits),
        renewalPackagePriceCents: Math.round(Number(renewalPriceUsd) * 100),
      }),
    onSuccess: async () => {
      setSuccess(t('dibnovaAdmin.aiSaveSettings'));
      await invalidateAi();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const addCreditsMutation = useMutation({
    mutationFn: () => dibnovaAdminApi.addClinicAiCredits(selectedClinicId, Number(addCredits)),
    onSuccess: async () => {
      setAddCredits('');
      setSuccess(t('dibnovaAdmin.aiAddCredits'));
      await invalidateAi();
      await refetchClinicCredits();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const renewalMutation = useMutation({
    mutationFn: () => dibnovaAdminApi.applyAiRenewalPackage(selectedClinicId),
    onSuccess: async () => {
      setSuccess(t('dibnovaAdmin.aiApplyRenewal'));
      await invalidateAi();
      await refetchClinicCredits();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  const toggleAiMutation = useMutation({
    mutationFn: (enabled: boolean) => dibnovaAdminApi.setClinicAiEnabled(selectedClinicId, enabled),
    onSuccess: async () => {
      await invalidateAi();
      await refetchClinicCredits();
    },
    onError: (err) => setError(getErrorMessage(err, t('common.error'))),
  });

  if (!isOnline) return null;

  const rows = selectedClinicId ? aiUsage.filter((row) => row.clinicId === selectedClinicId) : aiUsage;

  function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    saveSettingsMutation.mutate();
  }

  function handleAddCredits(e: FormEvent) {
    e.preventDefault();
    if (!selectedClinicId || !addCredits.trim()) return;
    addCreditsMutation.mutate();
  }

  return (
    <div className="admin-page">
      <AdminClinicScopeBanner clinicName={selectedClinic?.clinicName} />
      <AdminPageHeader
        title={t('dibnovaAdmin.aiUsageTitle')}
        description={t('dibnovaAdmin.aiUsageCostHint')}
        crumbs={[{ label: t('dibnovaAdmin.nav.ai') }]}
      />

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.aiSettingsTitle')}</h2>
        <p className="admin-card__note">{t('dibnovaAdmin.aiSettingsHint')}</p>
        <form onSubmit={handleSaveSettings}>
          <div className="setup-grid">
            <label className="form-field">
              <span className="form-field__label">{t('dibnovaAdmin.aiSubscriptionCredits')}</span>
              <input
                type="number"
                min={0}
                value={subscriptionCredits}
                onChange={(e) => setSubscriptionCredits(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">{t('dibnovaAdmin.aiRenewalCredits')}</span>
              <input type="number" min={0} value={renewalCredits} onChange={(e) => setRenewalCredits(e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-field__label">{t('dibnovaAdmin.aiRenewalPrice')}</span>
              <input type="number" min={0} step="0.01" value={renewalPriceUsd} onChange={(e) => setRenewalPriceUsd(e.target.value)} />
            </label>
          </div>
          <div className="settings-actions">
            <button type="submit" className="btn btn--primary btn--small" disabled={saveSettingsMutation.isPending}>
              {t('dibnovaAdmin.aiSaveSettings')}
            </button>
          </div>
        </form>
      </section>

      {selectedClinicId && clinicCredits && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.aiClinicCreditsTitle')}</h2>
          <dl className="updates-info-grid">
            <div>
              <dt>{t('dibnovaAdmin.aiCreditsUsed')}</dt>
              <dd>{clinicCredits.used}</dd>
            </div>
            <div>
              <dt>{t('dibnovaAdmin.aiCreditsRemaining')}</dt>
              <dd>{clinicCredits.balance}</dd>
            </div>
            <div>
              <dt>{t('dibnovaAdmin.aiCreditsAllowance')}</dt>
              <dd>{clinicCredits.allowance}</dd>
            </div>
            <div>
              <dt>{t('dibnovaAdmin.aiGeminiCost')}</dt>
              <dd>${clinicCredits.geminiCostUsd.toFixed(2)}</dd>
            </div>
          </dl>
          <div className="settings-actions">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={toggleAiMutation.isPending}
              onClick={() => toggleAiMutation.mutate(!clinicCredits.aiEnabled)}
            >
              {clinicCredits.aiEnabled ? t('dibnovaAdmin.aiDisable') : t('dibnovaAdmin.aiEnable')}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={renewalMutation.isPending}
              onClick={() => renewalMutation.mutate()}
            >
              {t('dibnovaAdmin.aiApplyRenewal')}
            </button>
          </div>
          <form onSubmit={handleAddCredits}>
            <div className="setup-grid">
              <label className="form-field">
                <span className="form-field__label">{t('dibnovaAdmin.aiCreditsAmount')}</span>
                <input type="number" min={1} value={addCredits} onChange={(e) => setAddCredits(e.target.value)} />
              </label>
            </div>
            <div className="settings-actions">
              <button type="submit" className="btn btn--primary btn--small" disabled={addCreditsMutation.isPending || !addCredits.trim()}>
                {t('dibnovaAdmin.aiAddCredits')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.aiUsageTitle')}</h2>
        {rows.length === 0 ? (
          <p className="muted">{t('dibnovaAdmin.aiUsageEmpty')}</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('dibnovaAdmin.clinicName')}</th>
                  <th>{t('dibnovaAdmin.aiCreditsUsed')}</th>
                  <th>{t('dibnovaAdmin.aiCreditsRemaining')}</th>
                  <th>{t('dibnovaAdmin.aiCreditsAllowance')}</th>
                  <th>{t('dibnovaAdmin.aiCalls')}</th>
                  <th>{t('dibnovaAdmin.aiGeminiCost')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.clinicId || 'unknown'}>
                    <td>{row.clinicName || row.clinicId || '—'}</td>
                    <td>{row.used ?? row.creditsUsed ?? 0}</td>
                    <td>{row.balance ?? 0}</td>
                    <td>{row.allowance ?? 0}</td>
                    <td>{row.calls}</td>
                    <td>${(row.geminiCostUsd ?? row.estimatedCostUsd ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">{t('dibnovaAdmin.aiUsageCostHint')}</p>
      </section>
    </div>
  );
}
