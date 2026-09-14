import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '@/api/subscription.api';
import { remainingTrialDays } from '@/utils/subscription';

export function TrialRemainingChip({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionApi.status,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (data?.status !== 'TRIAL_ACTIVE') return null;
  const days = data.remainingTrialDays ?? remainingTrialDays(data.expiresAt);
  if (days == null) return null;

  return (
    <span
      className={compact ? 'trial-chip trial-chip--compact' : 'trial-chip'}
      title={t('subscription.trialDaysLeft', { count: days, days }) ?? ''}
    >
      {t('subscription.trialDaysShort', { days })}
    </span>
  );
}
