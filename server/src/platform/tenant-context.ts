import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  clinicId?: string;
}

export const tenantAls = new AsyncLocalStorage<TenantStore>();

export function getTenantClinicId(): string | undefined {
  const clinicId = tenantAls.getStore()?.clinicId?.trim();
  return clinicId || undefined;
}

export function runInTenant<T>(clinicId: string, fn: () => T): T {
  return tenantAls.run({ clinicId }, fn);
}

/** Bind clinic isolation to the current async resource for the rest of this request. */
export function bindTenant(clinicId: string): void {
  tenantAls.enterWith({ clinicId });
}

export function clearTenant(): void {
  tenantAls.enterWith({});
}
