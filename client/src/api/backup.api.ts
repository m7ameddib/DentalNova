import { apiClient } from './client';

export interface BackupInfo {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
}

export interface BackupManifest {
  version: number;
  createdAt: string;
  appVersion: string;
  includes: string[];
}

export const backupApi = {
  create: () => apiClient.post<BackupInfo>('/backup/create').then((r) => r.data),
  list: () => apiClient.get<BackupInfo[]>('/backup/list').then((r) => r.data),
  downloadUrl: (filename: string) => `/api/backup/download/${encodeURIComponent(filename)}`,
  validate: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<{ valid: true; manifest: BackupManifest }>('/backup/validate', form)
      .then((r) => r.data);
  },
  restore: (file: File, confirm = true) => {
    const form = new FormData();
    form.append('file', file);
    form.append('confirm', confirm ? 'true' : 'false');
    return apiClient
      .post<{ restored: true; safetyBackupId: string; restartRequired: false }>('/backup/restore', form)
      .then((r) => r.data);
  },
};
