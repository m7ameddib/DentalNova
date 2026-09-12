import { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import {
  buildOptimisticRecord,
  isNetworkError,
  isQueueableWrite,
  isReadMethod,
  isWriteMethod,
  parsePatientsQuery,
} from './core';
import { applyLocalMutation, readCachedPatientSearch, readGetCache, saveGetCache } from './cache';
import { allocateTempId, enqueueOutbox, newOutboxId } from './outbox';
import { rememberOnlineScope } from './scope';
import { setCachedSubscription } from './storage';
import { useOfflineStatusStore } from './status.store';
import { axiosRequestUrl } from './requestUrl';
import { flushOutbox } from './sync';

function asAxiosResponse<T>(data: T, config: InternalAxiosRequestConfig, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Accepted',
    headers: { 'x-dnt-offline-cache': '1' },
    config,
  };
}

function parseRequestBody(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function persistSessionForFallback(): void {
  const { token, user } = useAuthStore.getState();
  if (!token || !user) return;
  try {
    localStorage.setItem('dnt-dental-token', token);
    localStorage.setItem('dnt-dental-user', JSON.stringify(user));
  } catch {
    /* ignore quota */
  }
}

let installed = false;

export function installOfflineFallback(api: AxiosInstance): void {
  if (installed) return;
  installed = true;
  api.interceptors.request.use((config) => {
    if (useOfflineStatusStore.getState().enabled) {
      config.headers = config.headers ?? {};
    }
    return config;
  });

  api.interceptors.response.use(
    async (response) => {
      const url = axiosRequestUrl(response.config);
      const method = (response.config.method ?? 'get').toUpperCase();

      if (url.includes('/installation/status') && response.data?.deploymentMode) {
        await rememberOnlineScope(response.data as { deploymentMode?: 'online' | 'offline' });
      }
      if (url.includes('/subscription/status') && response.data) {
        await setCachedSubscription(response.data);
      }

      if (useOfflineStatusStore.getState().enabled && !response.config.skipOfflineFallback) {
        if (isReadMethod(method)) {
          await saveGetCache(method, url, response.status, response.data);
        } else if (isWriteMethod(method) && isQueueableWrite(method, url, response.config.data)) {
          const result =
            response.data && typeof response.data === 'object'
              ? (response.data as Record<string, unknown>)
              : undefined;
          await applyLocalMutation({
            method,
            url,
            body: parseRequestBody(response.config.data),
            result,
          });
        }
      }

      return response;
    },
    async (error) => {
      const status = error?.response?.status;
      const config = error?.config as InternalAxiosRequestConfig | undefined;
      const enabled = useOfflineStatusStore.getState().enabled;

      if (status === 401) {
        const pending = useOfflineStatusStore.getState().pending;
        if (enabled && pending > 0) {
          useOfflineStatusStore.getState().setNeedsReauth(true);
          return Promise.reject(error);
        }
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      if (!config || config.skipOfflineFallback || !enabled) {
        return Promise.reject(error);
      }

      if (!isNetworkError(error)) {
        return Promise.reject(error);
      }

      useOfflineStatusStore.getState().setConnection('offline');
      persistSessionForFallback();

      const method = (config.method ?? 'get').toUpperCase();
      const url = axiosRequestUrl(config);

      if (isReadMethod(method)) {
        const cached = await readGetCache(method, url);
        if (cached) {
          return asAxiosResponse(cached.data, config, cached.status);
        }
        const patientQuery = parsePatientsQuery(url);
        if (patientQuery != null) {
          const localPatients = await readCachedPatientSearch(patientQuery);
          if (localPatients) {
            return asAxiosResponse(localPatients, config);
          }
        }
        if (url.includes('/auth/me')) {
          const user = useAuthStore.getState().user;
          if (user) return asAxiosResponse(user, config);
        }
        return Promise.reject(error);
      }

      const queuedBody = parseRequestBody(config.data);
      if (isWriteMethod(method) && isQueueableWrite(method, url, queuedBody)) {
        const tempId = method === 'POST' ? await allocateTempId() : undefined;
        const result =
          method === 'POST' && tempId != null
            ? buildOptimisticRecord(method, url, queuedBody, tempId)
            : { ...(typeof queuedBody === 'object' && queuedBody ? queuedBody : {}) };
        const itemId = newOutboxId();
        const user = useAuthStore.getState().user;
        const body = queuedBody ?? {};
        await enqueueOutbox({
          id: itemId,
          method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          url,
          data: body,
          headers: {},
          tempId,
          createdAt: new Date().toISOString(),
          status: 'pending',
          userId: user?.id ?? null,
          clinicId: user?.clinicId ?? '',
        });
        await applyLocalMutation({
          method,
          url,
          body,
          result: result as Record<string, unknown>,
          tempId,
        });
        return asAxiosResponse(result, config, method === 'POST' ? 201 : 200);
      }

      return Promise.reject(error);
    },
  );
}

export async function syncWhenOnline(api: AxiosInstance): Promise<void> {
  if (!useOfflineStatusStore.getState().enabled) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  await flushOutbox(api);
}
