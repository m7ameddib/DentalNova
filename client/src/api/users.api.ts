import { apiClient } from './client';
import { RoleWithPermissions, UserSummary } from '@/types/domain';

export interface CreateUserPayload {
  fullName: string;
  username: string;
  password: string;
  roleName: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  roleName?: string;
  isActive?: boolean;
  password?: string;
}

export const usersApi = {
  list: () => apiClient.get<UserSummary[]>('/users').then((r) => r.data),
  create: (payload: CreateUserPayload) =>
    apiClient.post<UserSummary>('/users', payload).then((r) => r.data),
  update: (id: number, payload: UpdateUserPayload) =>
    apiClient.patch<UserSummary>(`/users/${id}`, payload).then((r) => r.data),
  roles: () => apiClient.get<RoleWithPermissions[]>('/roles').then((r) => r.data),
};
