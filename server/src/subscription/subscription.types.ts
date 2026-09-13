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

export interface OnlineSubscriptionRow {
  status: OnlineSubscriptionStatus | null;
  startedAt: string | null;
  expiresAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  adminNotes: string | null;
}

export interface OnlineSubscriptionStatusResponse {
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
