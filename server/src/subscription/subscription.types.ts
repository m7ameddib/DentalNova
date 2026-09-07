export type OnlineSubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

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
}
