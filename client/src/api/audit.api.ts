import { apiClient } from './client';
import { AuditLogEntry } from '@/types/domain';

export const auditApi = {
  list: (params?: { limit?: number; patientId?: number }) =>
    apiClient.get<AuditLogEntry[]>('/audit-log', { params }).then((r) => r.data),

  forPatient: (patientId: number, limit = 100) =>
    apiClient.get<AuditLogEntry[]>(`/audit-log/patients/${patientId}`, { params: { limit } }).then((r) => r.data),
};
