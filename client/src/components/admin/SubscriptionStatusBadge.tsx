import { useTranslation } from 'react-i18next';
import type { OnlineSubscriptionStatus } from '@/api/subscription.api';

type BadgeStatus = OnlineSubscriptionStatus | 'SETUP' | null | undefined;

export function SubscriptionStatusBadge({ status }: { status: BadgeStatus }) {
  const { t } = useTranslation();

  if (!status) {
    return <span className="status-badge status-badge--muted">—</span>;
  }

  if (status === 'SETUP') {
    return <span className="status-badge status-badge--setup">{t('dibnovaAdmin.awaitingClinicSetup')}</span>;
  }

  const label = t(`dibnovaAdmin.status.${status}`, status);
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{label}</span>;
}
