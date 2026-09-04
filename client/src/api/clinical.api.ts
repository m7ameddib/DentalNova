import { apiClient } from './client';
import { MedicalAlert, ClinicalVisitNote } from '@/types/domain';

export const MEDICAL_ALERT_TYPES = [
  'ALLERGY',
  'PENICILLIN_ALLERGY',
  'ANTICOAGULANTS',
  'DIABETES',
  'HYPERTENSION',
  'PREGNANCY',
  'HEART_CONDITION',
  'DISEASE',
  'OTHER',
] as const;

export type MedicalAlertType = (typeof MEDICAL_ALERT_TYPES)[number];

export interface CreateMedicalAlertPayload {
  alertType?: MedicalAlertType;
  diseaseCatalogId?: number;
  label?: string;
  note?: string;
}

export interface UpdateMedicalAlertPayload {
  alertType?: MedicalAlertType;
  label?: string;
  note?: string;
}

export interface CreateClinicalVisitNotePayload {
  visitDate: string;
  chiefComplaint?: string;
  examinationFindings?: string;
  diagnosis?: string;
  procedureAction?: string;
  anesthesiaNote?: string;
  clinicalNotes?: string;
  patientInstructions?: string;
}

export type UpdateClinicalVisitNotePayload = Partial<CreateClinicalVisitNotePayload>;

export const clinicalApi = {
  listAlerts: (patientId: number, activeOnly = false) =>
    apiClient
      .get<MedicalAlert[]>(`/patients/${patientId}/medical-alerts`, {
        params: activeOnly ? { activeOnly: '1' } : undefined,
      })
      .then((r) => r.data),

  createAlert: (patientId: number, payload: CreateMedicalAlertPayload) =>
    apiClient.post<MedicalAlert>(`/patients/${patientId}/medical-alerts`, payload).then((r) => r.data),

  updateAlert: (id: number, payload: UpdateMedicalAlertPayload) =>
    apiClient.patch<MedicalAlert>(`/medical-alerts/${id}`, payload).then((r) => r.data),

  deactivateAlert: (id: number) =>
    apiClient.patch<MedicalAlert>(`/medical-alerts/${id}/deactivate`).then((r) => r.data),

  listVisitNotes: (patientId: number) =>
    apiClient.get<ClinicalVisitNote[]>(`/patients/${patientId}/clinical-visit-notes`).then((r) => r.data),

  createVisitNote: (patientId: number, payload: CreateClinicalVisitNotePayload) =>
    apiClient.post<ClinicalVisitNote>(`/patients/${patientId}/clinical-visit-notes`, payload).then((r) => r.data),

  updateVisitNote: (id: number, payload: UpdateClinicalVisitNotePayload) =>
    apiClient.patch<ClinicalVisitNote>(`/clinical-visit-notes/${id}`, payload).then((r) => r.data),
};
