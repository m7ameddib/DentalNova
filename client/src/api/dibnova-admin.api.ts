import axios from 'axios';
import { getApiBaseUrl } from '@/api/api-config';
import { ClinicTrialType, SubscriptionStatus } from '@/api/subscription.api';
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
  doctorName?: string | null;
  trialType?: ClinicTrialType | null;
  username?: string | null;
  subscription: SubscriptionStatus;
}

export interface AdminMarketingTrial {
  clinicId: string;
  clinicName: string;
  doctorName: string;
  phone: string;
  username: string;
  password: string;
  status: string;
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

  logout: () =>
    adminClient()
      .post<{ loggedOut: boolean }>('/dibnova-admin/auth/logout')
      .then((r) => r.data)
      .catch(() => ({ loggedOut: true })),

  me: () => adminClient().get<AuthenticatedUser>('/dibnova-admin/auth/me').then((r) => r.data),

  getInstallation: () =>
    adminClient().get<AdminClinicInfo>('/dibnova-admin/installation').then((r) => r.data),

  listClinics: () =>
    adminClient().get<AdminManagedClinic[]>('/dibnova-admin/clinics').then((r) => r.data),

  activate: (notes?: string, clinicId?: string, days?: number, expiresAt?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/activate', {
        notes: notes || undefined,
        clinicId,
        days,
        expiresAt,
      })
      .then((r) => r.data),

  extend: (notes?: string, clinicId?: string, days?: number, expiresAt?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/extend', {
        notes: notes || undefined,
        clinicId,
        days,
        expiresAt,
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

  dashboard: () =>
    adminClient()
      .get<{ total: number; counts: Record<string, number>; clinics: AdminManagedClinic[] }>(
        '/dibnova-admin/dashboard',
      )
      .then((r) => r.data),

  history: (clinicId?: string) =>
    adminClient()
      .get<Record<string, unknown>[]>('/dibnova-admin/history', { params: { clinicId } })
      .then((r) => r.data),

  audit: (clinicId?: string) =>
    adminClient()
      .get<AdminAuditEvent[]>('/dibnova-admin/audit', { params: { clinicId } })
      .then((r) => r.data),

  cancel: (reason?: string, clinicId?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/subscription/cancel', { reason, clinicId })
      .then((r) => r.data),

  deleteClinic: (clinicId: string, notes?: string) =>
    adminClient()
      .post<{ removed: boolean }>('/dibnova-admin/subscription/delete', { clinicId, notes })
      .then((r) => r.data),

  listPayments: (clinicId?: string) =>
    adminClient()
      .get<AdminLicensePayment[]>('/dibnova-admin/payments', { params: { clinicId } })
      .then((r) => r.data),

  paymentBalance: (clinicId: string) =>
    adminClient()
      .get<{ balanceCents: number }>('/dibnova-admin/payments/balance', { params: { clinicId } })
      .then((r) => r.data),

  addPayment: (payload: {
    clinicId: string;
    amount: number;
    paymentDate: string;
    method: string;
    note?: string;
  }) => adminClient().post<AdminLicensePayment>('/dibnova-admin/payments', payload).then((r) => r.data),

  updatePayment: (
    id: number,
    payload: { amount: number; paymentDate: string; method: string; note?: string },
  ) =>
    adminClient()
      .post<AdminLicensePayment>(`/dibnova-admin/payments/${id}/update`, payload)
      .then((r) => r.data),

  voidPayment: (id: number, reason?: string) =>
    adminClient()
      .post<AdminLicensePayment>(`/dibnova-admin/payments/${id}/void`, { reason })
      .then((r) => r.data),

  listClinicUsers: (clinicId: string) =>
    adminClient()
      .get<AdminClinicUser[]>(`/dibnova-admin/clinics/${clinicId}/users`)
      .then((r) => r.data),

  resetUserPassword: (clinicId: string, userId: number, newPassword: string) =>
    adminClient()
      .post<{ reset: boolean }>('/dibnova-admin/users/reset-password', { clinicId, userId, newPassword })
      .then((r) => r.data),

  setUserStatus: (clinicId: string, userId: number, isActive: boolean) =>
    adminClient()
      .post<{ id: number; isActive: boolean }>('/dibnova-admin/users/status', { clinicId, userId, isActive })
      .then((r) => r.data),

  setUserRole: (clinicId: string, userId: number, roleName: 'doctor' | 'employee') =>
    adminClient()
      .post<{ id: number; roleName: string }>('/dibnova-admin/users/role', { clinicId, userId, roleName })
      .then((r) => r.data),

  issueRecoveryCode: (clinicId: string) =>
    adminClient()
      .post<{ recoveryCode: string }>('/dibnova-admin/recovery-code', { clinicId })
      .then((r) => r.data),

  listTrials: () =>
    adminClient().get<AdminManagedClinic[]>('/dibnova-admin/trials').then((r) => r.data),

  activateTrial: (clinicId: string, notes?: string) =>
    adminClient()
      .post<SubscriptionStatus>('/dibnova-admin/trials/activate', { clinicId, notes })
      .then((r) => r.data),

  createMarketingTrial: (doctorName: string, phone: string) =>
    adminClient()
      .post<AdminMarketingTrial>('/dibnova-admin/trials/marketing', { doctorName, phone })
      .then((r) => r.data),

  createSignupInvite: () =>
    adminClient()
      .post<{ token: string; expiresAt: string }>('/dibnova-admin/signup-invite')
      .then((r) => r.data),

  opsHealth: () =>
    adminClient()
      .get<AdminOpsHealth>('/dibnova-admin/ops/health')
      .then((r) => r.data),

  clinicOps: (clinicId: string) =>
    adminClient()
      .get<AdminClinicOps>(`/dibnova-admin/clinics/${clinicId}/ops`)
      .then((r) => r.data),

  aiUsage: (clinicId?: string) =>
    adminClient()
      .get<AdminAiUsage[]>('/dibnova-admin/ai-usage', { params: { clinicId } })
      .then((r) => r.data),

  revokeOfflineLicenseSlot: (id: number) =>
    adminClient()
      .post<{ id: number; status: string }>(`/dibnova-admin/offline-license/slots/${id}/revoke`)
      .then((r) => r.data),
};

export interface AdminLicensePayment {
  id: number;
  clinicId: string;
  amountCents: number;
  paymentDate: string;
  method: string;
  note: string | null;
  status: string;
  voidReason: string | null;
  createdAt: string;
}

export interface AdminClinicUser {
  id: number;
  fullName: string;
  username: string;
  isActive: boolean;
  phone: string | null;
  roleName: string | null;
  roleLabel: string | null;
}

export interface AdminClinicOps {
  clinicId: string;
  clinicName?: string;
  patientCount: number;
  backupZipCount: number;
  attachmentBytes: number;
  clinicDbBytes?: number;
  syncDevices?: Array<{ id: string; name: string; revokedAt?: string | null }>;
}

export interface AdminAiUsage {
  clinicId: string | null;
  calls: number;
  durationMs: number;
  imageCalls: number;
}

export interface AdminAuditEvent {
  id: number;
  actor: string;
  action: string;
  clinicId: string | null;
  target: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AdminOpsHealth {
  ok: boolean;
  version?: string;
  deploymentMode: string;
  platformEnabled: boolean;
  clinicCount: number;
  r2Configured: boolean;
  uptimeSec: number;
  api?: { ok: boolean };
  database?: { ok: boolean };
  storage?: { ok: boolean };
  r2?: { configured: boolean; ok: boolean | null };
  sync?: { registeredDevices: number; activeDevices: number };
}
