import { apiClient } from '@/api/client';

export type OnlineSubscriptionStatus =
  | 'PENDING'
  | 'TRIAL_PENDING'
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'CANCELLED';

export type ClinicTrialType = 'website' | 'marketing';

export interface SubscriptionStatus {
  deploymentMode: 'offline' | 'online';
  applicable: boolean;
  status: OnlineSubscriptionStatus | null;
  startedAt: string | null;
  expiresAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  canUseSystem: boolean;
  trialType?: ClinicTrialType | null;
  remainingTrialDays?: number | null;
}

export const subscriptionApi = {
  status: () => apiClient.get<SubscriptionStatus>('/subscription/status').then((r) => r.data),
};
