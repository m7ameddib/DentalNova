export type PhoneMatch = {
  id: number;
  familyGroupId?: number | null;
};

/** Active patients that collide with a phone, excluding self and optional family group. */
export function conflictingPhoneOwners(
  matches: PhoneMatch[],
  options?: { excludePatientId?: number; familyGroupId?: number | null },
): PhoneMatch[] {
  const familyGroupId = options?.familyGroupId ?? null;
  const excludePatientId = options?.excludePatientId;
  return matches.filter((patient) => {
    if (excludePatientId != null && patient.id === excludePatientId) return false;
    if (familyGroupId != null && patient.familyGroupId != null && patient.familyGroupId === familyGroupId) {
      return false;
    }
    return true;
  });
}
