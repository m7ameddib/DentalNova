import { apiClient } from './client';
import { AttachmentCategory, PatientAttachment } from '@/types/domain';

export interface UploadAttachmentOptions {
  category: AttachmentCategory;
  note?: string;
  patientTreatmentId?: number;
  clinicalVisitNoteId?: number;
  teeth?: number[];
}

export const attachmentsApi = {
  list: (patientId: number) =>
    apiClient.get<PatientAttachment[]>(`/patients/${patientId}/attachments`).then((r) => r.data),

  upload: (patientId: number, file: File, options: UploadAttachmentOptions) => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', options.category);
    if (options.note) form.append('note', options.note);
    if (options.patientTreatmentId) form.append('patientTreatmentId', String(options.patientTreatmentId));
    if (options.clinicalVisitNoteId) form.append('clinicalVisitNoteId', String(options.clinicalVisitNoteId));
    if (options.teeth?.length) form.append('teeth', options.teeth.join(','));
    return apiClient
      .post<PatientAttachment>(`/patients/${patientId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  fetchFileBlob: (patientId: number, attachmentId: number) =>
    apiClient
      .get(`/patients/${patientId}/attachments/${attachmentId}/file`, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  remove: (patientId: number, attachmentId: number) =>
    apiClient.delete(`/patients/${patientId}/attachments/${attachmentId}`).then((r) => r.data),
};
