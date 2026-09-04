import { apiClient } from './client';
import {
  LabCaseWithDetails,
  LabName,
  LabServiceCost,
  LabWorkType,
  PatientLabCasesResponse,
} from '@/types/domain';

export type LabCaseListFilter =
  | 'active'
  | 'due_today'
  | 'overdue'
  | 'received'
  | 'delivered'
  | 'all';

export interface CreateLabCasePayload {
  patientId: number;
  patientTreatmentId?: number;
  labName: string;
  workTypeCode: string;
  workTypeCustom?: string;
  status?: string;
  sentDate?: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  deliveredDate?: string;
  notes?: string;
  teeth: number[];
  labCost?: number;
}

export type UpdateLabCasePayload = Partial<Omit<CreateLabCasePayload, 'patientId' | 'teeth'>> & { teeth?: number[] };

export interface RecordLabPaymentPayload {
  amount: number;
  paymentMethod: string;
  paymentDate?: string;
  note?: string;
}

export const labCasesApi = {
  list: (filter?: LabCaseListFilter, q?: string) =>
    apiClient
      .get<LabCaseWithDetails[]>('/lab-cases', { params: { filter, q: q || undefined } })
      .then((r) => r.data),

  summary: (date?: string) =>
    apiClient
      .get<{ dueToday: number; overdue: number }>('/lab-cases/summary', { params: date ? { date } : {} })
      .then((r) => r.data),

  workTypes: () => apiClient.get<LabWorkType[]>('/lab-cases/work-types').then((r) => r.data),

  labNames: () => apiClient.get<LabName[]>('/lab-cases/lab-names').then((r) => r.data),

  createLabName: (name: string) =>
    apiClient.post<LabName>('/lab-cases/lab-names', { name }).then((r) => r.data),

  updateLabName: (id: number, payload: { name?: string; isActive?: boolean }) =>
    apiClient.patch<LabName>(`/lab-cases/lab-names/${id}`, payload).then((r) => r.data),

  listServiceCosts: (labNameId: number) =>
    apiClient.get<LabServiceCost[]>(`/lab-cases/lab-names/${labNameId}/service-costs`).then((r) => r.data),

  upsertServiceCost: (labNameId: number, workTypeCode: string, cost: number) =>
    apiClient
      .post<LabServiceCost>(`/lab-cases/lab-names/${labNameId}/service-costs`, { workTypeCode, cost })
      .then((r) => r.data),

  getById: (id: number) =>
    apiClient
      .get<LabCaseWithDetails & { history: import('@/types/domain').LabCaseHistoryEntry[] }>(`/lab-cases/${id}`)
      .then((r) => r.data),

  forPatient: (patientId: number) =>
    apiClient.get<PatientLabCasesResponse>(`/patients/${patientId}/lab-cases`).then((r) => r.data),

  create: (payload: CreateLabCasePayload) =>
    apiClient.post<LabCaseWithDetails>('/lab-cases', payload).then((r) => r.data),

  update: (id: number, payload: UpdateLabCasePayload) =>
    apiClient.patch<LabCaseWithDetails>(`/lab-cases/${id}`, payload).then((r) => r.data),

  listPayments: (labCaseId: number) =>
    apiClient.get<import('@/types/domain').LabCasePayment[]>(`/lab-cases/${labCaseId}/payments`).then((r) => r.data),

  recordPayment: (labCaseId: number, payload: RecordLabPaymentPayload) =>
    apiClient.post(`/lab-cases/${labCaseId}/payments`, payload).then((r) => r.data),

  voidPayment: (labCaseId: number, paymentId: number, reason: string) =>
    apiClient.patch(`/lab-cases/${labCaseId}/payments/${paymentId}/void`, { reason }).then((r) => r.data),

  listLabAccounts: () =>
    apiClient.get<import('@/types/domain').LabAccountSummary[]>('/lab-cases/lab-names/accounts').then((r) => r.data),

  getLabAccount: (labNameId: number, from?: string, to?: string) =>
    apiClient
      .get<import('@/types/domain').LabAccountSummary>(`/lab-cases/lab-names/${labNameId}/account`, {
        params: { from: from || undefined, to: to || undefined },
      })
      .then((r) => r.data),

  listLabAccountOrders: (labNameId: number, from?: string, to?: string) =>
    apiClient
      .get<LabCaseWithDetails[]>(`/lab-cases/lab-names/${labNameId}/account/orders`, {
        params: { from: from || undefined, to: to || undefined },
      })
      .then((r) => r.data),

  listLabAccountPayments: (labNameId: number, from?: string, to?: string) =>
    apiClient
      .get<import('@/types/domain').LabAccountPaymentRow[]>(
        `/lab-cases/lab-names/${labNameId}/account/payments`,
        { params: { from: from || undefined, to: to || undefined } },
      )
      .then((r) => r.data),

  getLabStatement: (labNameId: number, from?: string, to?: string) =>
    apiClient
      .get<import('@/types/domain').LabStatementLine[]>(`/lab-cases/lab-names/${labNameId}/account/statement`, {
        params: { from: from || undefined, to: to || undefined },
      })
      .then((r) => r.data),

  recordLabAccountPayment: (labNameId: number, payload: RecordLabPaymentPayload) =>
    apiClient.post(`/lab-cases/lab-names/${labNameId}/account/payments`, payload).then((r) => r.data),

  updateLabAccountPayment: (
    labNameId: number,
    paymentId: number,
    payload: Partial<RecordLabPaymentPayload>,
  ) =>
    apiClient
      .patch(`/lab-cases/lab-names/${labNameId}/account/payments/${paymentId}`, payload)
      .then((r) => r.data),

  voidLabAccountPayment: (labNameId: number, paymentId: number, reason: string) =>
    apiClient
      .patch(`/lab-cases/lab-names/${labNameId}/account/payments/${paymentId}/void`, { reason })
      .then((r) => r.data),
};
