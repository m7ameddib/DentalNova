import { apiClient } from '@/api/client';

export type OnlineSubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

export interface SubscriptionStatus {
  deploymentMode: 'offline' | 'online';
  applicable: boolean;
  status: OnlineSubscriptionStatus | null;
  startedAt: string | null;
  expiresAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  canUseSystem: boolean;
}

export const subscriptionApi = {
  status: () => apiClient.get<SubscriptionStatus>('/subscription/status').then((r) => r.data),
};
