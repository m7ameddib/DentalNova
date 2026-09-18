import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { formatAdminDate } from '@/components/admin/admin-utils';

export function AdminAuditPage() {
  const { t } = useTranslation();
  const { isOnline, auditEvents } = useAdminDashboard();

  if (!isOnline) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.auditTitle')}
        description={t('dibnovaAdmin.auditHint')}
        crumbs={[{ label: t('dibnovaAdmin.nav.audit') }]}
      />

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.auditTitle')}</h2>
        {auditEvents.length === 0 ? (
          <p className="muted">{t('dibnovaAdmin.auditEmpty')}</p>
        ) : (
          <div className="admin-table-wrap">
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
                    <td>{formatAdminDate(event.createdAt)}</td>
                    <td>{event.actor}</td>
                    <td>{event.action}</td>
                    <td>{event.details || event.target || '—'}</td>
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
