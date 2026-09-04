import { Area, Patient } from '@/types/domain';

export function getPatientAreaDisplay(patient: Pick<Patient, 'areaId' | 'address'>, areas: Area[]): string | null {
  if (patient.areaId) {
    return areas.find((a) => a.id === patient.areaId)?.name ?? null;
  }
  const custom = patient.address?.trim();
  return custom || null;
}

export function getAreaTextForEdit(patient: Pick<Patient, 'areaId' | 'address'>, areas: Area[]): string {
  if (patient.areaId) {
    return areas.find((a) => a.id === patient.areaId)?.name ?? '';
  }
  return patient.address ?? '';
}

export function resolveAreaFields(
  areaText: string,
  areas: Area[],
): { areaId: number | null; address: string | null } {
  const trimmed = areaText.trim();
  if (!trimmed) return { areaId: null, address: null };
  const match = areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  if (match) return { areaId: match.id, address: null };
  return { areaId: null, address: trimmed };
}
