import { apiClient } from './client';
import { Guarantor, GuarantorTreatmentPrice } from '@/types/domain';

export const guarantorsApi = {
  list: () => apiClient.get<Guarantor[]>('/guarantors').then((r) => r.data),
  listActive: () => apiClient.get<Guarantor[]>('/guarantors/active').then((r) => r.data),
  create: (name: string) => apiClient.post<Guarantor>('/guarantors', { name }).then((r) => r.data),
  update: (id: number, payload: { name?: string; isActive?: boolean }) =>
    apiClient.patch<Guarantor>(`/guarantors/${id}`, payload).then((r) => r.data),
  listPrices: (id: number) =>
    apiClient.get<GuarantorTreatmentPrice[]>(`/guarantors/${id}/prices`).then((r) => r.data),
  upsertPrice: (id: number, treatmentTypeId: number, price: number) =>
    apiClient
      .post<{ guarantorId: number; treatmentTypeId: number; priceCents: number }>(`/guarantors/${id}/prices`, {
        treatmentTypeId,
        price,
      })
      .then((r) => r.data),
  deletePrice: (id: number, treatmentTypeId: number) =>
    apiClient.delete(`/guarantors/${id}/prices/${treatmentTypeId}`).then((r) => r.data),
};
