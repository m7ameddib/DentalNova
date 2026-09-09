import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  clinicId: string;
}

export const tenantAls = new AsyncLocalStorage<TenantStore>();

export function getTenantClinicId(): string | undefined {
  return tenantAls.getStore()?.clinicId;
}

export function runInTenant<T>(clinicId: string, fn: () => T): T {
  return tenantAls.run({ clinicId }, fn);
}
