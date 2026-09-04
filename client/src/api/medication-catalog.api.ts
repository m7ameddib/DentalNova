import { apiClient } from './client';
import { MedicationCatalogItem, MedicationCategory } from '@/types/domain';

export interface MedicationCatalogPayload {
  name: string;
  strengthForm?: string;
  category: MedicationCategory;
  defaultDose?: string;
  defaultFrequency?: string;
  defaultDuration?: string;
  defaultInstructions?: string;
}

export const medicationCatalogApi = {
  list: () => apiClient.get<MedicationCatalogItem[]>('/medication-catalog').then((r) => r.data),

  create: (payload: MedicationCatalogPayload) =>
    apiClient.post<MedicationCatalogItem>('/medication-catalog', payload).then((r) => r.data),

  update: (id: number, payload: Partial<MedicationCatalogPayload> & { isActive?: boolean }) =>
    apiClient.patch<MedicationCatalogItem>(`/medication-catalog/${id}`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete<{ id: number }>(`/medication-catalog/${id}`).then((r) => r.data),
};
