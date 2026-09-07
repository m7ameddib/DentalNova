import { apiClient } from '@/api/client';

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseNotes: string | null;
  releasePublishedAt: string | null;
  downloadUrl: string | null;
  installerFileName: string | null;
  downloaded: boolean;
  downloadedPath: string | null;
  downloadedSizeBytes: number | null;
  githubRepo: string;
}

export const updatesApi = {
  status: () => apiClient.get<UpdateStatus>('/updates/status').then((r) => r.data),
  check: () => apiClient.post<UpdateStatus>('/updates/check').then((r) => r.data),
  download: () => apiClient.post<UpdateStatus>('/updates/download').then((r) => r.data),
  launchInstaller: () =>
    apiClient.post<{ launched: boolean; installerPath: string }>('/updates/launch-installer').then((r) => r.data),
};
