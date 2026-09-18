export const ADMIN_STATUS_OPTIONS = [
  'PENDING',
  'TRIAL_PENDING',
  'TRIAL_ACTIVE',
  'TRIAL_EXPIRED',
  'ACTIVE',
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED',
] as const;

export type AdminStatusOption = (typeof ADMIN_STATUS_OPTIONS)[number];

export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function formatAdminBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function healthLabel(ok: boolean | null | undefined): string {
  if (ok == null) return '—';
  return ok ? 'ok' : 'down';
}

export const ADMIN_BASE_PATH = '/dibnova-admin';

export type AdminNavItemId =
  | 'dashboard'
  | 'clinics'
  | 'subscription'
  | 'payments'
  | 'users'
  | 'operations'
  | 'trials'
  | 'marketing'
  | 'offline'
  | 'ai'
  | 'history'
  | 'audit';

export const ADMIN_PATHS: Record<AdminNavItemId, string> = {
  dashboard: ADMIN_BASE_PATH,
  clinics: `${ADMIN_BASE_PATH}/clinics`,
  subscription: `${ADMIN_BASE_PATH}/subscription`,
  payments: `${ADMIN_BASE_PATH}/payments`,
  users: `${ADMIN_BASE_PATH}/users`,
  operations: `${ADMIN_BASE_PATH}/operations`,
  trials: `${ADMIN_BASE_PATH}/trials`,
  marketing: `${ADMIN_BASE_PATH}/marketing`,
  offline: `${ADMIN_BASE_PATH}/offline-licenses`,
  ai: `${ADMIN_BASE_PATH}/ai-usage`,
  history: `${ADMIN_BASE_PATH}/history`,
  audit: `${ADMIN_BASE_PATH}/audit`,
};

export const CLINIC_SCOPED_PATHS = new Set<string>([
  ADMIN_PATHS.clinics,
  ADMIN_PATHS.subscription,
  ADMIN_PATHS.payments,
  ADMIN_PATHS.users,
  ADMIN_PATHS.operations,
  ADMIN_PATHS.history,
  ADMIN_PATHS.audit,
]);
