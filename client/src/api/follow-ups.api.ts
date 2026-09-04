import { apiClient } from './client';
import {
  FollowUpAppointmentPayload,
  FollowUpHistoryEntry,
  FollowUpPaymentPayload,
  FollowUpResult,
  FollowUpSummary,
  FollowUpType,
  FollowUpWithPatient,
  PatientFollowUpsResponse,
} from '@/types/domain';

export const followUpsApi = {
  summary: (date?: string) =>
    apiClient
      .get<FollowUpSummary>('/follow-ups/summary', { params: date ? { date } : {} })
      .then((r) => r.data),

  list: (type?: FollowUpType, date?: string) =>
    apiClient
      .get<FollowUpWithPatient[]>('/follow-ups', { params: { ...(type ? { type } : {}), ...(date ? { date } : {}) } })
      .then((r) => r.data),

  workItemsForDate: (date?: string) =>
    apiClient.get<FollowUpWithPatient[]>('/follow-ups/today', { params: date ? { date } : {} }).then((r) => r.data),

  history: (patientId?: number) =>
    apiClient
      .get<FollowUpHistoryEntry[]>('/follow-ups/history', { params: patientId ? { patientId } : {} })
      .then((r) => r.data),

  forPatient: (patientId: number) =>
    apiClient.get<PatientFollowUpsResponse>(`/patients/${patientId}/follow-ups`).then((r) => r.data),

  create: (payload: {
    patientId: number;
    type: 'CLINICAL';
    reason: string;
    followUpDate: string;
    details?: string;
    note?: string;
  }) => apiClient.post<FollowUpWithPatient>('/follow-ups', payload).then((r) => r.data),

  update: (
    id: number,
    payload: { followUpDate?: string; reason?: string; details?: string; note?: string },
  ) => apiClient.patch(`/follow-ups/${id}`, payload).then((r) => r.data),

  setDate: (id: number, followUpDate: string, note?: string) =>
    apiClient.patch(`/follow-ups/${id}/date`, { followUpDate, note }).then((r) => r.data),

  addNote: (id: number, note: string) =>
    apiClient.patch(`/follow-ups/${id}/note`, { note }).then((r) => r.data),

  complete: (
    id: number,
    payload: {
      result: FollowUpResult;
      note?: string;
      nextFollowUpDate?: string;
      reschedule?: boolean;
      appointment?: FollowUpAppointmentPayload;
    },
  ) => apiClient.post(`/follow-ups/${id}/complete`, payload).then((r) => r.data),

  financialAction: (
    id: number,
    payload: {
      result: FollowUpResult;
      note?: string;
      nextFollowUpDate?: string;
      payment?: FollowUpPaymentPayload;
    },
  ) => apiClient.post(`/follow-ups/${id}/financial-action`, payload).then((r) => r.data),
};
