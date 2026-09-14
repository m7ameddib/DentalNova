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

export function isCachedSubscriptionUsable(
  cached:
    | {
        canUseSystem?: boolean;
        expiresAt?: string | null;
        status?: string;
      }
    | null
    | undefined,
  options: { offline: boolean; graceMs: number; now?: number },
): boolean {
  if (!cached) return false;
  const now = options.now ?? Date.now();
  const markedUsable =
    cached.canUseSystem === true || isSubscriptionUsable(cached.status as OnlineSubscriptionStatus | undefined);
  if (!markedUsable) return false;

  if (!cached.expiresAt) {
    return cached.canUseSystem === true;
  }
  const expiry = new Date(cached.expiresAt).getTime();
  if (Number.isNaN(expiry)) return cached.canUseSystem === true;
  if (expiry >= now) return true;
  return options.offline && now - expiry <= options.graceMs;
}
