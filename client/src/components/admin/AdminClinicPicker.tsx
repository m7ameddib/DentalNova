import { useTranslation } from 'react-i18next';
import { SubscriptionStatusBadge } from '@/components/admin/SubscriptionStatusBadge';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_STATUS_OPTIONS } from '@/components/admin/admin-utils';

export function AdminClinicPicker({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const {
    isOnline,
    filteredClinics,
    selectedClinic,
    setSelectedClinicId,
    clinicQuery,
    setClinicQuery,
    statusFilter,
    setStatusFilter,
    data,
  } = useAdminDashboard();

  if (!isOnline || !data?.clinics?.length) return null;

  return (
    <div className={compact ? 'admin-clinic-picker admin-clinic-picker--compact' : 'admin-clinic-picker'}>
      {!compact && (
        <>
          <label className="form-field">
            <span className="form-field__label">{t('common.search')}</span>
            <input
              value={clinicQuery}
              onChange={(e) => setClinicQuery(e.target.value)}
              placeholder={t('dibnovaAdmin.searchClinics')}
            />
          </label>
          <label className="form-field">
            <span className="form-field__label">{t('common.status')}</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">{t('common.all')}</option>
              {ADMIN_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`dibnovaAdmin.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="form-field admin-clinic-picker__select">
        <span className="form-field__label">{t('dibnovaAdmin.selectedClinic')}</span>
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
      {selectedClinic && compact && (
        <SubscriptionStatusBadge status={selectedClinic.subscription.status} />
      )}
    </div>
  );
}
