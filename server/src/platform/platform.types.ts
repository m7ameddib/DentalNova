import { OnlineSubscriptionStatus } from '../subscription/subscription.types';

export interface PlatformClinic {
  id: string;
  name: string;
  phone: string | null;
  dbPath: string;
  createdAt: string;
  subscriptionStatus: OnlineSubscriptionStatus;
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  subscriptionSuspendedAt: string | null;
  subscriptionSuspendedReason: string | null;
  adminNotes: string | null;
}

export interface ClinicUserDirectoryRow {
  username: string;
  phoneNormalized: string | null;
  clinicId: string;
  userId: number;
  createdAt: string;
}
