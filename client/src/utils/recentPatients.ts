import { Patient } from '@/types/domain';

const MAX_RECENT = 10;

export interface RecentPatientEntry {
  id: number;
  fullName: string;
  fileNumber: string;
  phone: string;
}

function storageKey(userId: number, clinicId?: string): string {
  return `dnt-recent-patients:${clinicId || 'offline'}:${userId}`;
}

export function loadRecentPatients(userId: number, clinicId?: string): RecentPatientEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId, clinicId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row): row is RecentPatientEntry =>
          !!row &&
          typeof row === 'object' &&
          typeof (row as RecentPatientEntry).id === 'number' &&
          typeof (row as RecentPatientEntry).fullName === 'string',
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberRecentPatient(
  userId: number,
  clinicId: string | undefined,
  patient: Pick<Patient, 'id' | 'fullName' | 'fileNumber' | 'phone'>,
): RecentPatientEntry[] {
  const next: RecentPatientEntry[] = [
    {
      id: patient.id,
      fullName: patient.fullName,
      fileNumber: patient.fileNumber,
      phone: patient.phone,
    },
    ...loadRecentPatients(userId, clinicId).filter((row) => row.id !== patient.id),
  ].slice(0, MAX_RECENT);

  try {
    localStorage.setItem(storageKey(userId, clinicId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}
