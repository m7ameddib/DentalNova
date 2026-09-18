import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_PATHS } from '@/components/admin/admin-utils';
import { dibnovaAdminApi } from '@/api/dibnova-admin.api';
import { getErrorMessage } from '@/utils/errors';
import { usePrintStore } from '@/store/print.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { useUiStore } from '@/store/ui.store';
import { OperatingContractPrintable } from '@/components/admin/AdminPrintables';
import { isTrialPendingStatus } from '@/utils/subscription';

export function AdminSubscriptionPage() {
  const { t } = useTranslation();
  const print = usePrintStore((s) => s.print);
  const language = useUiStore((s) => s.language);
  const {
    data,
    isOnline,
    clinicReady,
    selectedClinic,
    selectedClinicId,
    effectiveStatus,
    notes,
    setNotes,
    renewDays,
    setRenewDays,
    renewDate,
    setRenewDate,
    actionPending,
    activateTrialPending,
    mutateAction,
    mutateActivateTrial,
    confirmAction,
    setSuccess,
    setError,
    setSelectedClinicId,
    invalidate,
    payBalance,
  } = useAdminDashboard();

  if (!data) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.subscriptionManagement')}
        description={t('dibnovaAdmin.subscriptionHint')}
        crumbs={[
          { label: t('dibnovaAdmin.nav.clinics'), to: ADMIN_PATHS.clinics },
          { label: t('dibnovaAdmin.nav.subscription') },
        ]}
      />

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
              disabled={actionPending || !isTrialPendingStatus(effectiveStatus)}
              onClick={() => {
                if (!confirmAction('dibnovaAdmin.activateConfirm')) return;
                mutateAction('activate');
              }}
            >
              {t('dibnovaAdmin.activate')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={activateTrialPending || !selectedClinic || !isTrialPendingStatus(effectiveStatus)}
              onClick={() => selectedClinic && mutateActivateTrial(selectedClinic.clinicId)}
            >
              {t('dibnovaAdmin.activateTrial')}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={actionPending || (effectiveStatus !== 'ACTIVE' && effectiveStatus !== 'TRIAL_ACTIVE')}
              onClick={() => {
                if (!confirmAction('dibnovaAdmin.extendConfirm')) return;
                mutateAction('extend');
              }}
            >
              {t('dibnovaAdmin.extend')}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={
                actionPending ||
                (effectiveStatus !== 'ACTIVE' &&
                  effectiveStatus !== 'TRIAL_ACTIVE' &&
                  !isTrialPendingStatus(effectiveStatus))
              }
              onClick={() => {
                if (!confirmAction('dibnovaAdmin.suspendConfirm')) return;
                mutateAction('suspend');
              }}
            >
              {t('dibnovaAdmin.suspend')}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={
                actionPending ||
                (effectiveStatus !== 'SUSPENDED' &&
                  effectiveStatus !== 'EXPIRED' &&
                  effectiveStatus !== 'TRIAL_EXPIRED')
              }
              onClick={() => {
                if (!confirmAction('dibnovaAdmin.reactivateConfirm')) return;
                mutateAction('reactivate');
              }}
            >
              {t('dibnovaAdmin.reactivate')}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={actionPending || !selectedClinic}
              onClick={() => {
                if (window.confirm(t('dibnovaAdmin.cancelConfirm'))) {
                  void dibnovaAdminApi
                    .cancel(notes, selectedClinicId)
                    .then(() => {
                      setSuccess(t('dibnovaAdmin.success.cancel'));
                      invalidate();
                    })
                    .catch((err) => setError(getErrorMessage(err, t('common.error'))));
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
                  void dibnovaAdminApi
                    .deleteClinic(selectedClinicId, notes)
                    .then(() => {
                      setSuccess(t('dibnovaAdmin.success.delete'));
                      setSelectedClinicId('');
                      invalidate();
                    })
                    .catch((err) => setError(getErrorMessage(err, t('common.error'))));
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
    </div>
  );
}
