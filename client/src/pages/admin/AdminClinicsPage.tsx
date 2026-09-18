import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SubscriptionStatusBadge } from '@/components/admin/SubscriptionStatusBadge';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminClinicPicker } from '@/components/admin/AdminClinicPicker';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_PATHS, formatAdminDate } from '@/components/admin/admin-utils';

export function AdminClinicsPage() {
  const { t } = useTranslation();
  const {
    data,
    isOnline,
    filteredClinics,
    selectedClinic,
    setSelectedClinicId,
    clinicReady,
    effectiveStatus,
  } = useAdminDashboard();

  if (!data) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.clinicInfo')}
        description={t('dibnovaAdmin.clinicsHint')}
        crumbs={[{ label: t('dibnovaAdmin.nav.clinics') }]}
      />

      {isOnline && data.clinics && data.clinics.length > 0 && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.clinicsList')}</h2>
          <AdminClinicPicker />
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('dibnovaAdmin.clinicName')}</th>
                  <th>{t('dibnovaAdmin.clinicPhone')}</th>
                  <th>{t('dibnovaAdmin.subscriptionStatus')}</th>
                  <th>{t('dibnovaAdmin.expiryDate')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredClinics.length === 0 && (
                  <tr>
                    <td colSpan={5}>{t('dibnovaAdmin.noClinics')}</td>
                  </tr>
                )}
                {filteredClinics.map((clinic) => (
                  <tr
                    key={clinic.clinicId}
                    className={
                      clinic.clinicId === selectedClinic?.clinicId
                        ? 'admin-table__row admin-table__row--active'
                        : 'admin-table__row'
                    }
                    onClick={() => setSelectedClinicId(clinic.clinicId)}
                  >
                    <td>
                      <div className="admin-table__primary">{clinic.clinicName}</div>
                      <div className="mono-text muted">{clinic.clinicId}</div>
                    </td>
                    <td>{clinic.clinicPhone || '—'}</td>
                    <td>
                      <SubscriptionStatusBadge status={clinic.subscription.status} />
                    </td>
                    <td>{formatAdminDate(clinic.subscription.expiresAt)}</td>
                    <td>
                      <Link to={ADMIN_PATHS.subscription} className="btn btn--ghost btn--small">
                        {t('dibnovaAdmin.subscriptionManagement')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.clinicInfo')}</h2>
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
                      <SubscriptionStatusBadge status={clinicReady ? effectiveStatus : 'SETUP'} />
                    </td>
                  </tr>
                  <tr>
                    <th>{t('dibnovaAdmin.startDate')}</th>
                    <td>{formatAdminDate(selectedClinic?.subscription.startedAt ?? data.subscription.startedAt)}</td>
                  </tr>
                  <tr>
                    <th>{t('dibnovaAdmin.expiryDate')}</th>
                    <td>{formatAdminDate(selectedClinic?.subscription.expiresAt ?? data.subscription.expiresAt)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {!isOnline && data.offlineLicense && (
          <p className="admin-card__note">
            {t('dibnovaAdmin.offlineLicenseInfo', {
              activated: data.offlineLicense.hasLicense ? t('dibnovaAdmin.yes') : t('dibnovaAdmin.no'),
            })}
            {data.offlineLicense.activatedAt && (
              <>
                {' '}
                ({t('dibnovaAdmin.activatedAt', { date: formatAdminDate(data.offlineLicense.activatedAt) })})
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
    </div>
  );
}
