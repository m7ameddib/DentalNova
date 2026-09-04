import { apiClient } from './client';
import { ClinicExpense, ExpenseCategory } from '@/types/domain';

export interface CreateExpensePayload {
  date?: string;
  amount: number;
  category?: ExpenseCategory;
  expenseCategoryId?: number;
  paymentMethod: string;
  paidTo?: string;
  note?: string;
}

export interface UpdateExpensePayload {
  date?: string;
  amount?: number;
  expenseCategoryId?: number;
  paymentMethod?: string;
  paidTo?: string;
  note?: string;
}

export const expensesApi = {
  list: (from: string, to: string, q?: string) =>
    apiClient
      .get<ClinicExpense[]>('/expenses', { params: { from, to, q: q || undefined } })
      .then((r) => r.data),
  create: (payload: CreateExpensePayload) =>
    apiClient.post<ClinicExpense>('/expenses', payload).then((r) => r.data),
  update: (id: number, payload: UpdateExpensePayload) =>
    apiClient.patch<ClinicExpense>(`/expenses/${id}`, payload).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/expenses/${id}`).then((r) => r.data),
};
