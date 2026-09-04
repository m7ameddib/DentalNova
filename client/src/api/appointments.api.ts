import { apiClient } from './client';
import { AppointmentStatus, DaySchedule, MonthOverviewEntry } from '@/types/domain';

export interface CreateAppointmentPayload {
  patientId?: number;
  guestName?: string;
  guestPhone?: string;
  date: string;
  time: string;
  durationMin?: number;
  appointmentType?: string;
  reason?: string;
  notes?: string;
  allowOutsideHours?: boolean;
}

export interface UpdateAppointmentPayload {
  patientId?: number;
  date?: string;
  time?: string;
  durationMin?: number;
  reason?: string;
  guestName?: string;
  guestPhone?: string;
  appointmentType?: string;
  allowOutsideHours?: boolean;
}

export const appointmentsApi = {
  monthOverview: (yearMonth: string) =>
    apiClient
      .get<MonthOverviewEntry[]>('/appointments/month', { params: { yearMonth } })
      .then((r) => r.data),

  daySchedule: (date: string) =>
    apiClient.get<DaySchedule>('/appointments', { params: { date } }).then((r) => r.data),

  create: (payload: CreateAppointmentPayload) =>
    apiClient.post('/appointments', payload).then((r) => r.data),

  updateStatus: (id: number, status: AppointmentStatus) =>
    apiClient.patch(`/appointments/${id}/status`, { status }).then((r) => r.data),

  update: (id: number, payload: UpdateAppointmentPayload) =>
    apiClient.patch(`/appointments/${id}`, payload).then((r) => r.data),

  recordReminderSent: (id: number) =>
    apiClient.patch(`/appointments/${id}/reminder-sent`).then((r) => r.data),

  linkPatient: (id: number, patientId: number) =>
    apiClient.patch(`/appointments/${id}/link-patient`, { patientId }).then((r) => r.data),
};
