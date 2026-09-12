import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { getApiBaseUrl } from '@/api/api-config';
import { installOfflineFallback } from '@/offline/intercept';

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

installOfflineFallback(apiClient);
