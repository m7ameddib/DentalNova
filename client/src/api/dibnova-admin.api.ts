import axios from 'axios';
import { getApiBaseUrl } from '@/api/api-config';
import { SubscriptionStatus } from '@/api/subscription.api';
import { AuthenticatedUser } from '@/types/domain';

const ADMIN_TOKEN_KEY = 'dnt-dibnova-admin-token';
const ADMIN_USER_KEY = 'dnt-dibnova-admin-user';

export function getDibNovaAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getDibNovaAdminUser(): AuthenticatedUser | null {
  const raw = sessionStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export function setDibNovaAdminSession(token: string, user: AuthenticatedUser): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function clearDibNovaAdminSession(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);
}

export function isDibNovaAdminAuthenticated(): boolean {
  return Boolean(getDibNovaAdminToken());
}

export interface AdminManagedClinic {
  clinicId: string;
  clinicName: string;
  clinicPhone: string | null;
  createdAt: string;
  subscription: SubscriptionStatus;
}

export interface AdminClinicInfo {
  deploymentMode: 'offline' | 'online';
  installationId: string;
  clinicName: string;
  clinicPhone: string;
  setupCompletedAt: string | null;
  phase: 'activation' | 'setup' | 'ready';
  subscription: SubscriptionStatus;
  clinics?: AdminManagedClinic[];
  offlineLicense: { activatedAt: string | null; hasLicense: boolean } | null;
  offlineLicensing?: { canIssueOfflineLicenses: boolean };
}

export interface OfflineLicenseSlotSummary {
  id: number;
  clinicId: string;
  clinicName: string;
  licenseId: string;
  installationId: string | null;
  status: 'pending' | 'redeemed' | 'revoked';
  slotExpiresAt: string | null;
  licenseExpiresAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
  adminNotes: string | null;
}

export interface CreateOfflineLicenseSlotResponse {
  clinicId: string;
  clinicName: string;
  licenseId: string;
  activationCode: string;
  installationId: string | null;
  slotExpiresAt: string | null;
  licenseExpiresAt: string | null;
}

function adminClient() {
  const token = getDibNovaAdminToken();
  if (!token) throw new Error('Admin session not set');
  const client = axios.create({
    baseURL: getApiBaseUrl(),
    headers: { Authorization: `Bearer ${token}` },
  });
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        clearDibNovaAdminSession();
      }
      return Promise.reject(error);
    },
  );
  return client;
}

export const dibnovaAdminApi = {
  login: (username: string, password: string) =>
    axios
      .post<{ accessToken: string; user: AuthenticatedUser }>(
        `${getApiBaseUrl()}/dibnova-admin/auth/login`,
        { username, password },
      )
      .then((r) => r.data),

  getInstallation: () =>
    adminClient().get<AdminClinicInfo>('/dibnova-admin/installation').then((r) => r.data),

  listClinics: () =>
    adminClient().get<AdminManagedClinic[]>('/dibnova-admin/clinics').then((r) => r.data),

  activate: (notes?: string, clinicId?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/activate', {
        notes: notes || undefined,
        clinicId,
      })
      .then((r) => r.data),

  extend: (notes?: string, clinicId?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/extend', {
        notes: notes || undefined,
        clinicId,
      })
      .then((r) => r.data),

  suspend: (reason?: string, clinicId?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/suspend', {
        reason: reason || undefined,
        clinicId,
      })
      .then((r) => r.data),

  reactivate: (notes?: string, clinicId?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/reactivate', {
        notes: notes || undefined,
        clinicId,
      })
      .then((r) => r.data),

  createOfflineLicenseSlot: (payload: {
    clinicId: string;
    clinicName: string;
    installationId?: string;
    licenseExpiresAt?: string;
    slotExpiresAt?: string;
    adminNotes?: string;
  }) =>
    adminClient()
      .post<CreateOfflineLicenseSlotResponse>('/dibnova-admin/offline-license/create-slot', payload)
      .then((r) => r.data),

  listOfflineLicenseSlots: () =>
    adminClient()
      .get<OfflineLicenseSlotSummary[]>('/dibnova-admin/offline-license/slots')
      .then((r) => r.data),
};
