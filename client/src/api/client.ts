import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { getApiBaseUrl } from '@/api/api-config';
import { installOfflineFallback } from '@/offline/intercept';
import { idempotencyKeyFor } from '@/api/idempotency-key';

export const apiClient = axios.create({ timeout: 8000 });

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = useAuthStore.getState().token;
  config.headers = config.headers ?? {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || 'get').toUpperCase();
  const existing = config.headers['X-Idempotency-Key'] || config.headers['x-idempotency-key'];
  if (!existing) {
    const key = idempotencyKeyFor(method, String(config.url || ''), config.data);
    if (key) config.headers['X-Idempotency-Key'] = key;
  }
  return config;
});

installOfflineFallback(apiClient);
