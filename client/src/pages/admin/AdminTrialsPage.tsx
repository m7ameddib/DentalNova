import { useTranslation } from 'react-i18next';
import { SubscriptionStatusBadge } from '@/components/admin/SubscriptionStatusBadge';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { formatAdminDate } from '@/components/admin/admin-utils';
import { isTrialPendingStatus } from '@/utils/subscription';

export function AdminTrialsPage() {
  const { t } = useTranslation();
  const {
    isOnline,
    trialRequests,
    notes,
    setNotes,
    activateTrialPending,
    confirmAction,
    setSelectedClinicId,
    mutateActivateTrial,
  } = useAdminDashboard();

  if (!isOnline) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.trialRequestsTitle')}
        description={t('dibnovaAdmin.trialRequestsHint')}
        crumbs={[{ label: t('dibnovaAdmin.nav.trials') }]}
      />

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.trialRequestsTitle')}</h2>
        <label className="form-field">
          <span className="form-field__label">{t('dibnovaAdmin.notes')}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t('dibnovaAdmin.notesPlaceholder')}
          />
        </label>
        <div className="admin-info-table-wrap">
          <table className="admin-table admin-info-table--wide">
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
                  <td>{formatAdminDate(clinic.createdAt)}</td>
                  <td>
                    <SubscriptionStatusBadge status={clinic.subscription.status} />
                  </td>
                  <td>{formatAdminDate(clinic.subscription.startedAt)}</td>
                  <td>{formatAdminDate(clinic.subscription.expiresAt)}</td>
                  <td>{clinic.trialType ? t(`dibnovaAdmin.trialType.${clinic.trialType}`) : '—'}</td>
                  <td>
                    <div className="admin-actions admin-actions--compact">
                      <button
                        type="button"
                        className="btn btn--primary btn--small"
                        disabled={activateTrialPending || !isTrialPendingStatus(clinic.subscription.status)}
                        onClick={() => {
                          if (!confirmAction('dibnovaAdmin.activateTrialConfirm')) return;
                          setSelectedClinicId(clinic.clinicId);
                          mutateActivateTrial(clinic.clinicId);
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
    </div>
  );
}
