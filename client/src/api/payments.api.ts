import { apiClient } from './client';
import { Payment } from '@/types/domain';

export interface CreatePaymentPayload {
  patientId: number;
  amount: number;
  method: string;
  date?: string;
  note?: string;
}

export interface VoidPaymentPayload {
  reason: string;
}

export const paymentsApi = {
  create: (payload: CreatePaymentPayload) =>
    apiClient.post<Payment>('/payments', payload).then((r) => r.data),
  void: (id: number, payload: VoidPaymentPayload) =>
    apiClient.patch<Payment>(`/payments/${id}/void`, payload).then((r) => r.data),
  /** @deprecated Use void */
  remove: (id: number) => apiClient.delete(`/payments/${id}`).then((r) => r.data),
};
