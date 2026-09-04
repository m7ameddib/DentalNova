import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/api/audit.api';
import { useUiStore } from '@/store/ui.store';
import { formatDateTimeDisplay } from '@/utils/date';

export function ActivityHistorySection() {
  const { t } = useTranslation();
  const { language } = useUiStore();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => auditApi.list({ limit: 200 }),
  });

  if (isLoading) return <p className="muted">{t('common.loading')}</p>;

  return (
    <section className="settings-section activity-history-section">
      <h2>{t('settings.activityHistory.title')}</h2>
      <p className="muted">{t('settings.activityHistory.subtitle')}</p>
      {entries.length === 0 ? (
        <p className="muted">{t('settings.activityHistory.empty')}</p>
      ) : (
        <div className="activity-history-table-wrap">
          <table className="payment-history-table activity-history-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('settings.activityHistory.action')}</th>
                <th>{t('settings.activityHistory.user')}</th>
                <th>{t('settings.activityHistory.patient')}</th>
                <th>{t('settings.activityHistory.description')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateTimeDisplay(e.createdAt, language)}</td>
                  <td>{t(`audit.actions.${e.action}`, { defaultValue: e.action })}</td>
                  <td>{e.userName ?? '—'}</td>
                  <td>{e.patientName ?? '—'}</td>
                  <td className="muted">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
