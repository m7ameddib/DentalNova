import { apiClient } from './client';
import { ExpenseCategoryEntity } from '@/types/domain';

export const expenseCategoriesApi = {
  listActive: () => apiClient.get<ExpenseCategoryEntity[]>('/expense-categories').then((r) => r.data),
  listCatalog: () => apiClient.get<ExpenseCategoryEntity[]>('/expense-categories/catalog').then((r) => r.data),
  create: (label: string) =>
    apiClient.post<ExpenseCategoryEntity>('/expense-categories', { label }).then((r) => r.data),
  update: (id: number, payload: { label?: string; isActive?: boolean }) =>
    apiClient.patch<ExpenseCategoryEntity>(`/expense-categories/${id}`, payload).then((r) => r.data),
};
