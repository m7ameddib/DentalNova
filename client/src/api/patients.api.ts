import { apiClient } from './client';
import {
  AccountSummary,
  AppointmentWithPatient,
  AccountDiscount,
  Patient,
  PatientDetail,
  PatientTreatment,
  Payment,
} from '@/types/domain';

export interface CreatePatientPayload {
  fullName: string;
  phone: string;
  gender?: string;
  dateOfBirth?: string;
  approxAge?: number;
  weightKg?: number;
  guarantorId?: number;
  areaId?: number;
  address?: string;
  generalNotes?: string;
  linkFamilyOfPatientId?: number;
}

export type UpdatePatientPayload = Partial<
  Omit<CreatePatientPayload, 'linkFamilyOfPatientId' | 'weightKg' | 'guarantorId'>
> & {
  areaId?: number | null;
  address?: string | null;
  guarantorId?: number | null;
  weightKg?: number | null;
  accountDiscount?: number;
};

export const patientsApi = {
  search: (query?: string) =>
    apiClient.get<Patient[]>('/patients', { params: query ? { q: query } : {} }).then((r) => r.data),

  checkPhone: (phone: string) =>
    apiClient.get<Patient[]>('/patients/check-phone', { params: { phone } }).then((r) => r.data),

  getById: (id: number) => apiClient.get<PatientDetail>(`/patients/${id}`).then((r) => r.data),

  create: (payload: CreatePatientPayload) =>
    apiClient.post<Patient>('/patients', payload).then((r) => r.data),

  update: (id: number, payload: UpdatePatientPayload) =>
    apiClient.patch<Patient>(`/patients/${id}`, payload).then((r) => r.data),

  deletePermanently: (id: number) =>
    apiClient.delete<{ id: number; deleted: boolean }>(`/patients/${id}/permanent`).then((r) => r.data),

  archive: (id: number) =>
    apiClient.patch<{ id: number; archived: boolean; archivedAt: string | null }>(`/patients/${id}/archive`).then((r) => r.data),

  restore: (id: number) =>
    apiClient.patch<{ id: number; restored: boolean; archivedAt: string | null }>(`/patients/${id}/restore`).then((r) => r.data),

  listArchived: () => apiClient.get<Patient[]>('/patients/archived').then((r) => r.data),

  accountSummary: (id: number) =>
    apiClient.get<AccountSummary>(`/patients/${id}/account-summary`).then((r) => r.data),

  upcomingAppointments: (id: number) =>
    apiClient
      .get<AppointmentWithPatient[]>(`/patients/${id}/appointments/upcoming`)
      .then((r) => r.data),

  appointments: (id: number) =>
    apiClient.get<AppointmentWithPatient[]>(`/patients/${id}/appointments`).then((r) => r.data),

  treatments: (id: number) =>
    apiClient.get<PatientTreatment[]>(`/patients/${id}/treatments`).then((r) => r.data),

  payments: (id: number) => apiClient.get<Payment[]>(`/patients/${id}/payments`).then((r) => r.data),

  accountDiscounts: (id: number) =>
    apiClient.get<AccountDiscount[]>(`/patients/${id}/account-discounts`).then((r) => r.data),

  followUps: (id: number) =>
    apiClient.get<import('@/types/domain').PatientFollowUpsResponse>(`/patients/${id}/follow-ups`).then((r) => r.data),
};
