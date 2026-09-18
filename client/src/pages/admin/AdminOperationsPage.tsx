import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_PATHS, formatAdminBytes } from '@/components/admin/admin-utils';

export function AdminOperationsPage() {
  const { t } = useTranslation();
  const { isOnline, clinicReady, selectedClinic, clinicOps } = useAdminDashboard();

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.opsTitle')}
        description={t('dibnovaAdmin.opsHint')}
        crumbs={[
          { label: t('dibnovaAdmin.nav.clinics'), to: ADMIN_PATHS.clinics },
          { label: t('dibnovaAdmin.nav.operations') },
        ]}
      />

      {isOnline && clinicReady && selectedClinic && clinicOps && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.opsTitle')}</h2>
          <div className="admin-metrics admin-metrics--ops">
            <article className="admin-metric">
              <span className="admin-metric__label">{t('dibnovaAdmin.opsPatients')}</span>
              <strong className="admin-metric__value">{clinicOps.patientCount}</strong>
            </article>
            <article className="admin-metric">
              <span className="admin-metric__label">{t('dibnovaAdmin.opsBackups')}</span>
              <strong className="admin-metric__value">{clinicOps.backupZipCount}</strong>
            </article>
            <article className="admin-metric">
              <span className="admin-metric__label">{t('dibnovaAdmin.opsStorage')}</span>
              <strong className="admin-metric__value">{formatAdminBytes(clinicOps.attachmentBytes)}</strong>
            </article>
            <article className="admin-metric">
              <span className="admin-metric__label">{t('dibnovaAdmin.opsDbSize')}</span>
              <strong className="admin-metric__value">{formatAdminBytes(clinicOps.clinicDbBytes ?? 0)}</strong>
            </article>
            <article className="admin-metric">
              <span className="admin-metric__label">{t('dibnovaAdmin.opsDevices')}</span>
              <strong className="admin-metric__value">
                {(clinicOps.syncDevices ?? []).filter((d) => !d.revokedAt).length}
              </strong>
            </article>
          </div>
        </section>
      )}
      {isOnline && clinicReady && selectedClinic && !clinicOps && (
        <p className="muted">{t('common.loading')}</p>
      )}
    </div>
  );
}
