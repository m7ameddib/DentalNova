import { apiClient } from './client';
import { AuthenticatedUser } from '@/types/domain';

export interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  me: () => apiClient.get<AuthenticatedUser>('/auth/me').then((r) => r.data),
};
