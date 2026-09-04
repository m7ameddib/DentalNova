import { apiClient } from './client';
import { Prescription, PrescriptionType } from '@/types/domain';

export interface PrescriptionItemPayload {
  medicineName: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface CreatePrescriptionPayload {
  type?: PrescriptionType;
  items: PrescriptionItemPayload[];
}

export const prescriptionsApi = {
  list: (patientId: number) =>
    apiClient.get<Prescription[]>(`/patients/${patientId}/prescriptions`).then((r) => r.data),

  create: (patientId: number, payload: CreatePrescriptionPayload | PrescriptionItemPayload[]) => {
    const body = Array.isArray(payload) ? { items: payload, type: 'MEDICATION' as const } : payload;
    return apiClient
      .post<Prescription>(`/patients/${patientId}/prescriptions`, body)
      .then((r) => r.data);
  },

  remove: (patientId: number, id: number) =>
    apiClient.delete<{ id: number; patientId: number }>(`/patients/${patientId}/prescriptions/${id}`).then((r) => r.data),
};
