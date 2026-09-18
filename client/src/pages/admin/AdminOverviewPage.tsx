import { useTranslation } from 'react-i18next';
import { Ticket } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminDashboard } from '@/components/admin/AdminDashboardContext';
import { ADMIN_STATUS_OPTIONS, healthLabel } from '@/components/admin/admin-utils';

export function AdminOverviewPage() {
  const { t } = useTranslation();
  const { isOnline, dashboard, opsHealth, signupInvite, createSignupInvite, data } = useAdminDashboard();

  return (
    <div className="admin-page">
      <AdminPageHeader
        title={t('dibnovaAdmin.dashboard')}
        description={t('dibnovaAdmin.overviewHint')}
      />

      {isOnline && dashboard && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.metricsTitle')}</h2>
          <div className="admin-metrics">
            <article className="admin-metric">
              <span className="admin-metric__label">{t('dibnovaAdmin.totalClinics')}</span>
              <strong className="admin-metric__value">{dashboard.total}</strong>
            </article>
            {ADMIN_STATUS_OPTIONS.map((key) => (
              <article key={key} className={`admin-metric admin-metric--${key.toLowerCase()}`}>
                <span className="admin-metric__label">{t(`dibnovaAdmin.status.${key}`)}</span>
                <strong className="admin-metric__value">{dashboard.counts[key] ?? 0}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      {isOnline && opsHealth && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.healthSummary')}</h2>
          <div className="admin-health-grid">
            <div className={`admin-health-chip ${opsHealth.ok ? 'admin-health-chip--ok' : 'admin-health-chip--down'}`}>
              {t('dibnovaAdmin.opsHealth')}: {opsHealth.ok ? t('dibnovaAdmin.healthOk') : t('dibnovaAdmin.healthDown')}
            </div>
            <div className="admin-health-chip">API {healthLabel(opsHealth.api?.ok)}</div>
            <div className="admin-health-chip">DB {healthLabel(opsHealth.database?.ok)}</div>
            <div className="admin-health-chip">
              {t('dibnovaAdmin.opsStorage')} {healthLabel(opsHealth.storage?.ok)}
            </div>
            <div className="admin-health-chip">
              {t('dibnovaAdmin.opsR2')}: {opsHealth.r2Configured ? healthLabel(opsHealth.r2?.ok) : t('dibnovaAdmin.no')}
            </div>
            <div className="admin-health-chip">
              {t('dibnovaAdmin.opsDevices')}: {opsHealth.sync?.activeDevices ?? 0}/{opsHealth.sync?.registeredDevices ?? 0}
            </div>
          </div>
          <p className="muted admin-card__note">
            {opsHealth.deploymentMode} · {t('dibnovaAdmin.totalClinics')} {opsHealth.clinicCount} · uptime {opsHealth.uptimeSec}s
            {opsHealth.version ? ` · ${opsHealth.version}` : ''}
          </p>
        </section>
      )}

      {isOnline && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.inviteTitle')}</h2>
          <p className="admin-card__note muted">{t('dibnovaAdmin.signupInvite')}</p>
          <div className="settings-actions">
            <button type="button" className="btn btn--secondary btn--small" onClick={createSignupInvite}>
              <Ticket size={14} /> {t('dibnovaAdmin.signupInvite')}
            </button>
          </div>
          {signupInvite && (
            <p className="muted">
              {t('dibnovaAdmin.signupInviteOnce')}: <code className="mono-text">{signupInvite}</code>
            </p>
          )}
        </section>
      )}

      {!isOnline && data && (
        <section className="admin-card">
          <h2 className="admin-card__title">{t('dibnovaAdmin.clinicInfo')}</h2>
          <p className="muted">
            {data.clinicName || '—'} · {data.deploymentMode} · {data.installationId}
          </p>
        </section>
      )}
    </div>
  );
}
