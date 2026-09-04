import { patientsApi } from '@/api/patients.api';
import { PatientTreatment } from '@/types/domain';

export interface PatientPrintSummary {
  patientId: number;
  remainingCents: number;
  lastTreatmentLabel: string | null;
  lastTreatmentDate: string | null;
}

function sortTreatmentsNewestFirst(a: PatientTreatment, b: PatientTreatment): number {
  const da = a.completedAt ?? a.createdAt;
  const db = b.completedAt ?? b.createdAt;
  return db.localeCompare(da);
}

export async function fetchPatientPrintSummary(patientId: number): Promise<PatientPrintSummary> {
  const [account, treatments] = await Promise.all([
    patientsApi.accountSummary(patientId),
    patientsApi.treatments(patientId),
  ]);

  const last = treatments.filter((t) => t.status === 'COMPLETED').sort(sortTreatmentsNewestFirst)[0];

  return {
    patientId,
    remainingCents: account.remainingCents,
    lastTreatmentLabel: last?.treatmentLabel ?? null,
    lastTreatmentDate: last ? (last.completedAt ?? last.createdAt).slice(0, 10) : null,
  };
}
