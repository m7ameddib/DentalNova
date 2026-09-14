import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings.api';
import { installationApi } from '@/api/installation.api';
import { subscriptionApi } from '@/api/subscription.api';
import { remainingTrialDays } from '@/utils/subscription';

export function SettingsGeneralSection({
  onOpenSection,
  canOpenClinic,
  canOpenHours,
  canOpenUsers,
}: {
  onOpenSection: (id: string) => void;
  canOpenClinic?: boolean;
  canOpenHours?: boolean;
  canOpenUsers?: boolean;
}) {
  const { t } = useTranslation();

  const { data: clinic } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
    staleTime: 30_000,
  });
  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });
  const { data: subscription } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionApi.status,
    staleTime: 30_000,
  });

  const trialDays =
    subscription?.status === 'TRIAL_ACTIVE'
      ? (subscription.remainingTrialDays ?? remainingTrialDays(subscription.expiresAt))
      : null;

  return (
    <section className="settings-section settings-general">
      <h2>{t('settings.generalTitle')}</h2>
      <p className="muted">{t('settings.generalHint')}</p>

      <dl className="settings-general__facts">
        <div>
          <dt>{t('settings.clinicInfo.title')}</dt>
          <dd>{clinic?.clinicName || t('app.name')}</dd>
        </div>
        <div>
          <dt>{t('settings.version')}</dt>
          <dd>{installStatus?.version || '—'}</dd>
        </div>
        <div>
          <dt>{t('settings.deploymentMode')}</dt>
          <dd>
            {installStatus?.deploymentMode === 'online'
              ? t('settings.deploymentOnline')
              : t('settings.deploymentOffline')}
          </dd>
        </div>
        {trialDays != null && (
          <div>
            <dt>{t('subscription.trialActiveTitle')}</dt>
            <dd>{t('subscription.trialDaysLeft', { count: trialDays, days: trialDays })}</dd>
          </div>
        )}
      </dl>

      <h3 className="settings-section__sub-title">{t('settings.aboutTitle')}</h3>
      <p>{t('settings.aboutText')}</p>
      <p className="muted">{t('settings.languageInHeader')}</p>

      {(canOpenClinic || canOpenHours || canOpenUsers) && (
        <div className="settings-general__shortcuts">
          {canOpenClinic && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onOpenSection('clinicInfo')}>
              {t('settings.clinicInfo.title')}
            </button>
          )}
          {canOpenHours && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onOpenSection('workingHours')}>
              {t('settings.workingHours.title')}
            </button>
          )}
          {canOpenUsers && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onOpenSection('usersRoles')}>
              {t('settings.usersRolesTitle')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
