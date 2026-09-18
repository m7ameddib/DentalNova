import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';

export function AdminAiUsagePage() {
  const { t } = useTranslation();
  const { isOnline, aiUsage } = useAdminDashboard();

  if (!isOnline) return null;

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.aiUsageTitle')}
        description={t('dibnovaAdmin.aiUsageCostHint')}
        crumbs={[{ label: t('dibnovaAdmin.nav.ai') }]}
      />

      <section className="admin-card">
        <h2 className="admin-card__title">{t('dibnovaAdmin.aiUsageTitle')}</h2>
        {aiUsage.length === 0 ? (
          <p className="muted">{t('dibnovaAdmin.aiUsageEmpty')}</p>
        ) : (
          <div className="admin-table-wrap">
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
          </div>
        )}
        <p className="muted">{t('dibnovaAdmin.aiUsageCostHint')}</p>
      </section>
    </div>
  );
}
