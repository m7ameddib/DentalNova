import { apiClient } from './client';
import { AccountDiscount } from '@/types/domain';

export interface CreateAccountDiscountPayload {
  patientId: number;
  amount: number;
  date?: string;
  note?: string;
}

export type UpdateAccountDiscountPayload = Partial<Omit<CreateAccountDiscountPayload, 'patientId'>>;

export const accountDiscountsApi = {
  create: (payload: CreateAccountDiscountPayload) =>
    apiClient.post<AccountDiscount>('/account-discounts', payload).then((r) => r.data),
  update: (id: number, payload: UpdateAccountDiscountPayload) =>
    apiClient.patch<AccountDiscount>(`/account-discounts/${id}`, payload).then((r) => r.data),
  void: (id: number, payload: { reason: string }) =>
    apiClient.patch<AccountDiscount>(`/account-discounts/${id}/void`, payload).then((r) => r.data),
};
