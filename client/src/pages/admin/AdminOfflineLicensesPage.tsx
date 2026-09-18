import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { dibnovaAdminApi } from '@/api/dibnova-admin.api';
import { getErrorMessage } from '@/utils/errors';

export function AdminOfflineLicensesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    canIssueOfflineLicenses,
    notes,
    setNotes,
    offlineClinicId,
    setOfflineClinicId,
    offlineClinicName,
    setOfflineClinicName,
    offlineInstallationId,
    setOfflineInstallationId,
    createOfflinePending,
    mutateCreateOfflineSlot,
    generatedCode,
    handleCopyGeneratedCode,
    codeCopied,
    offlineSlots,
    confirmAction,
    setSuccess,
    setError,
  } = useAdminDashboard();

  if (!canIssueOfflineLicenses) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.offlineLicensingTitle')}
        description={t('dibnovaAdmin.offlineLicensingHint')}
        crumbs={[{ label: t('dibnovaAdmin.nav.offline') }]}
      />

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.offlineLicensingTitle')}</h2>
        <p className="muted admin-card__note">{t('dibnovaAdmin.offlineLicensingHint')}</p>

        <div className="setup-grid">
          <label className="form-field">
            <span className="form-field__label">{t('dibnovaAdmin.offlineClinicId')}</span>
            <input value={offlineClinicId} onChange={(e) => setOfflineClinicId(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('dibnovaAdmin.offlineClinicName')}</span>
            <input value={offlineClinicName} onChange={(e) => setOfflineClinicName(e.target.value)} required />
          </label>
          <label className="form-field setup-grid__full">
            <span className="form-field__label">{t('dibnovaAdmin.offlineInstallationIdOptional')}</span>
            <input
              value={offlineInstallationId}
              onChange={(e) => setOfflineInstallationId(e.target.value)}
              className="mono-text"
            />
          </label>
          <label className="form-field setup-grid__full">
            <span className="form-field__label">{t('dibnovaAdmin.notes')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('dibnovaAdmin.notesPlaceholder')}
            />
          </label>
        </div>

        <button
          type="button"
          className="btn btn--primary"
          disabled={createOfflinePending || !offlineClinicId.trim() || !offlineClinicName.trim()}
          onClick={() => mutateCreateOfflineSlot()}
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
                    <td>
                      <span className={`status-badge status-badge--${slot.status}`}>{slot.status}</span>
                    </td>
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
    </div>
  );
}
