import type { OnlineSubscriptionStatus } from '@/api/subscription.api';

export const TRIAL_DURATION_DAYS = 7;

export function isSubscriptionUsable(status: OnlineSubscriptionStatus | null | undefined): boolean {
  return status === 'ACTIVE' || status === 'TRIAL_ACTIVE';
}

export function isTrialPendingStatus(status: OnlineSubscriptionStatus | null | undefined): boolean {
  return status === 'TRIAL_PENDING' || status === 'PENDING';
}

export function remainingTrialDays(expiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return null;
  return Math.max(0, Math.ceil((expiry - now) / (24 * 60 * 60 * 1000)));
}
