import { apiClient } from './client';
import { Area, ClinicSettings, DiseaseCatalogItem, PaymentMethodEntity } from '@/types/domain';

export interface UpdateClinicSettingsPayload {
  clinicName?: string;
  clinicPhone?: string;
  doctorPhone?: string;
  address?: string;
  workingDays?: string;
  workStartTime?: string;
  workEndTime?: string;
  whatsappMessageLanguage?: 'en' | 'ar';
  whatsappAppointmentReminderEn?: string | null;
  whatsappAppointmentReminderAr?: string | null;
  whatsappClinicalFollowupEn?: string | null;
  whatsappClinicalFollowupAr?: string | null;
  whatsappFinancialFollowupEn?: string | null;
  whatsappFinancialFollowupAr?: string | null;
  doctorNameAr?: string;
  doctorNameEn?: string;
  doctorTitleAr?: string;
  doctorTitleEn?: string;
  doctorLicenseNo?: string;
}

export const settingsApi = {
  getClinic: () => apiClient.get<ClinicSettings>('/settings/clinic').then((r) => r.data),
  updateClinic: (payload: UpdateClinicSettingsPayload) =>
    apiClient.patch<ClinicSettings>('/settings/clinic', payload).then((r) => r.data),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return apiClient
      .post<ClinicSettings>('/settings/clinic/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  /** Fetches the clinic logo as a blob (the endpoint requires auth, so a plain <img src> URL won't work). */
  fetchLogoBlob: () =>
    apiClient.get('/settings/clinic/logo', { responseType: 'blob' }).then((r) => r.data as Blob),
};

export interface PaymentMethodPayload {
  label: string;
}

export const paymentMethodsApi = {
  listActive: () => apiClient.get<PaymentMethodEntity[]>('/payment-methods').then((r) => r.data),
  listAll: () => apiClient.get<PaymentMethodEntity[]>('/payment-methods/catalog').then((r) => r.data),
  create: (payload: PaymentMethodPayload) =>
    apiClient.post<PaymentMethodEntity>('/payment-methods', payload).then((r) => r.data),
  update: (id: number, payload: Partial<PaymentMethodPayload> & { isActive?: boolean }) =>
    apiClient.patch<PaymentMethodEntity>(`/payment-methods/${id}`, payload).then((r) => r.data),
};

export interface AreaPayload {
  name: string;
}

export const areasApi = {
  listActive: () => apiClient.get<Area[]>('/areas').then((r) => r.data),
  listAll: () => apiClient.get<Area[]>('/areas/catalog').then((r) => r.data),
  create: (payload: AreaPayload) => apiClient.post<Area>('/areas', payload).then((r) => r.data),
  update: (id: number, payload: Partial<AreaPayload> & { isActive?: boolean }) =>
    apiClient.patch<Area>(`/areas/${id}`, payload).then((r) => r.data),
  remove: (id: number) => apiClient.delete<{ id: number; deleted: boolean }>(`/areas/${id}`).then((r) => r.data),
};

export interface DiseaseCatalogPayload {
  name: string;
}

export const diseaseCatalogApi = {
  listActive: () => apiClient.get<DiseaseCatalogItem[]>('/disease-catalog').then((r) => r.data),
  listAll: () => apiClient.get<DiseaseCatalogItem[]>('/disease-catalog/catalog').then((r) => r.data),
  create: (payload: DiseaseCatalogPayload) =>
    apiClient.post<DiseaseCatalogItem>('/disease-catalog', payload).then((r) => r.data),
  update: (id: number, payload: Partial<DiseaseCatalogPayload> & { isActive?: boolean }) =>
    apiClient.patch<DiseaseCatalogItem>(`/disease-catalog/${id}`, payload).then((r) => r.data),
  remove: (id: number) =>
    apiClient.delete<{ id: number; deleted: boolean }>(`/disease-catalog/${id}`).then((r) => r.data),
};
