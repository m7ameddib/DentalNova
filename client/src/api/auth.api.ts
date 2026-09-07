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
  forgotPassword: (username: string, phone: string) =>
    apiClient
      .post<{ message: string }>('/auth/forgot-password', { username, phone })
      .then((r) => r.data),
  verifyResetOtp: (username: string, phone: string, code: string) =>
    apiClient
      .post<{ resetToken: string }>('/auth/verify-reset-otp', { username, phone, code })
      .then((r) => r.data),
  resetPassword: (resetToken: string, newPassword: string) =>
    apiClient
      .post<{ message: string }>('/auth/reset-password', { resetToken, newPassword })
      .then((r) => r.data),
};
