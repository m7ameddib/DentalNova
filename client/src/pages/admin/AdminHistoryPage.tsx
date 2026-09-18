import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_PATHS } from '@/components/admin/admin-utils';

export function AdminHistoryPage() {
  const { t } = useTranslation();
  const { isOnline, clinicReady, selectedClinic, history } = useAdminDashboard();

  if (!isOnline) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.historyTitle')}
        description={t('dibnovaAdmin.historyHint')}
        crumbs={[
          { label: t('dibnovaAdmin.nav.clinics'), to: ADMIN_PATHS.clinics },
          { label: t('dibnovaAdmin.nav.history') },
        ]}
      />

      {clinicReady && selectedClinic && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.historyTitle')}</h2>
          {history.length === 0 ? (
            <p className="muted">{t('dibnovaAdmin.historyEmpty')}</p>
          ) : (
            <div className="admin-table-wrap">
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
            </div>
          )}
        </section>
      )}
    </div>
  );
}
