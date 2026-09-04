import { apiClient } from './client';
import { PatientTreatment, TreatmentType } from '@/types/domain';
import { TreatmentScope } from '@/utils/teeth';

export interface CreateTreatmentPayload {
  patientId: number;
  treatmentTypeId: number;
  teeth: number[];
  treatmentDate?: string;
  treatmentScope?: TreatmentScope;
  discount?: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  note?: string;
}

export interface UpdateTreatmentPayload {
  treatmentTypeId?: number;
  teeth?: number[];
  treatmentDate?: string;
  treatmentScope?: TreatmentScope;
  discount?: number;
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID';
  note?: string;
}

export interface TreatmentTypePayload {
  label: string;
  abbreviation: string;
  defaultPrice: number;
  category?: string | null;
  referencePrice?: number | null;
  colorHex?: string;
  followUp1Days?: number | null;
  followUp2Days?: number | null;
  followUp3Days?: number | null;
}

export type UpdateTreatmentTypePayload = Partial<TreatmentTypePayload> & {
  isActive?: boolean;
  category?: string | null;
  referencePrice?: number | null;
};

export const treatmentsApi = {
  listTypes: () => apiClient.get<TreatmentType[]>('/treatment-types').then((r) => r.data),
  listCatalog: () => apiClient.get<TreatmentType[]>('/treatment-types/catalog').then((r) => r.data),
  createType: (payload: TreatmentTypePayload) =>
    apiClient.post<TreatmentType>('/treatment-types', payload).then((r) => r.data),
  updateType: (id: number, payload: UpdateTreatmentTypePayload) =>
    apiClient.patch<TreatmentType>(`/treatment-types/${id}`, payload).then((r) => r.data),
  create: (payload: CreateTreatmentPayload) =>
    apiClient.post<PatientTreatment>('/treatments', payload).then((r) => r.data),
  update: (id: number, payload: UpdateTreatmentPayload) =>
    apiClient.patch<PatientTreatment>(`/treatments/${id}`, payload).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/treatments/${id}`).then((r) => r.data),
  voidTreatment: (id: number) => apiClient.delete(`/treatments/${id}`).then((r) => r.data),
  updateStatus: (id: number, status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID') =>
    apiClient.patch<PatientTreatment>(`/treatments/${id}/status`, { status }).then((r) => r.data),
};
