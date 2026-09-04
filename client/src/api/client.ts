import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { getApiBaseUrl } from '@/api/api-config';

export const apiClient = axios.create();

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
