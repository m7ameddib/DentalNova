import { apiClient } from './client';
import {
  AppointmentStatus,
  AppointmentWithPatient,
  DailyReport,
  OutstandingPatientRow,
  Patient,
  PatientDebtRow,
  PaymentReportRow,
  ReportsSummary,
  TreatmentReportRow,
} from '@/types/domain';

export const reportsApi = {
  summary: (from: string, to: string) =>
    apiClient.get<ReportsSummary>('/reports/summary', { params: { from, to } }).then((r) => r.data),

  treatments: (from: string, to: string, onlyDiscounted = false) =>
    apiClient
      .get<TreatmentReportRow[]>('/reports/treatments', { params: { from, to, onlyDiscounted } })
      .then((r) => r.data),

  payments: (from: string, to: string) =>
    apiClient.get<PaymentReportRow[]>('/reports/payments', { params: { from, to } }).then((r) => r.data),

  outstanding: () =>
    apiClient.get<OutstandingPatientRow[]>('/reports/outstanding').then((r) => r.data),

  debts: () => apiClient.get<PatientDebtRow[]>('/reports/debts').then((r) => r.data),

  appointments: (from: string, to: string, status?: AppointmentStatus) =>
    apiClient
      .get<AppointmentWithPatient[]>('/reports/appointments', { params: { from, to, status } })
      .then((r) => r.data),

  patients: (from: string, to: string, onlyNew = false) =>
    apiClient.get<Patient[]>('/reports/patients', { params: { from, to, onlyNew } }).then((r) => r.data),

  daily: (date?: string) =>
    apiClient.get<DailyReport>('/reports/daily', { params: date ? { date } : {} }).then((r) => r.data),
};
