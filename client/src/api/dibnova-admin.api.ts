import axios from 'axios';
import { getApiBaseUrl } from '@/api/api-config';
import { SubscriptionStatus } from '@/api/subscription.api';

const ADMIN_KEY_STORAGE = 'dnt-dibnova-admin-key';

export function getDibNovaAdminKey(): string | null {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setDibNovaAdminKey(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
}

export function clearDibNovaAdminKey(): void {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

export interface AdminClinicInfo {
  deploymentMode: 'offline' | 'online';
  installationId: string;
  clinicName: string;
  clinicPhone: string;
  setupCompletedAt: string | null;
  subscription: SubscriptionStatus;
  offlineLicense: { activatedAt: string | null; hasLicense: boolean } | null;
}

function adminClient() {
  const key = getDibNovaAdminKey();
  if (!key) throw new Error('Admin key not set');
  return axios.create({
    baseURL: getApiBaseUrl(),
    headers: { 'X-DibNova-Admin-Key': key },
  });
}

export const dibnovaAdminApi = {
  getInstallation: () =>
    adminClient().get<AdminClinicInfo>('/dibnova-admin/installation').then((r) => r.data),

  activate: (notes?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/activate', { notes: notes || undefined })
      .then((r) => r.data),

  extend: (notes?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/extend', { notes: notes || undefined })
      .then((r) => r.data),

  suspend: (reason?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/suspend', { reason: reason || undefined })
      .then((r) => r.data),

  reactivate: (notes?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/reactivate', { notes: notes || undefined })
      .then((r) => r.data),
};
