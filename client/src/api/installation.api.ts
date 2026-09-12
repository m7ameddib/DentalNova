import { apiClient } from '@/api/client';
import { AuthenticatedUser } from '@/types/domain';

export type InstallationPhase = 'activation' | 'setup' | 'ready';

export interface InstallationStatus {
  phase: InstallationPhase;
  installationId: string;
  version: string;
  product: string;
  deploymentMode: 'offline' | 'online';
  onlineSubscriptionStatus?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | null;
  canCreateClinic?: boolean;
}

export interface SetupCompleteResponse extends InstallationStatus {
  accessToken: string;
  user: AuthenticatedUser;
}
export interface FirstSetupPayload {
  clinicName: string;
  doctorName: string;
  clinicPhone: string;
  doctorPhone: string;
  workingDays: string;
  workStartTime: string;
  workEndTime: string;
  adminUsername: string;
  adminPassword: string;
  adminPhone: string;
  address?: string;
}

export const installationApi = {
  status: () => apiClient.get<InstallationStatus>('/installation/status').then((r) => r.data),
  activate: (license: string) =>
    apiClient.post<InstallationStatus>('/installation/activate', { license }).then((r) => r.data),
  activateOnline: (payload: { activationCode: string; clinicName?: string }) =>
    apiClient
      .post<InstallationStatus>('/installation/activate-online', payload)
      .then((r) => r.data),
  setup: (payload: FirstSetupPayload) =>
    apiClient.post<SetupCompleteResponse>('/installation/setup', payload).then((r) => r.data),
};

export async function checkServerHealth(): Promise<boolean> {
  const offlineBrowser = typeof navigator !== 'undefined' && navigator.onLine === false;
  const attempts = offlineBrowser ? 1 : 5;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await apiClient.get('/health', {
        timeout: offlineBrowser ? 2000 : 8000,
        skipOfflineFallback: true,
      });
      if (res.data?.ok === true) return true;
    } catch {
      // retry while server is finishing setup work
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return false;
}
