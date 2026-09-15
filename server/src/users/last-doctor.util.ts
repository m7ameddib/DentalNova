/** True when this update would leave the clinic with no active doctor. */
export function wouldRemoveLastDoctor(input: {
  existingRoleName: string | undefined;
  existingIsActive: boolean;
  nextRoleName: string | undefined;
  nextIsActive: boolean;
  otherActiveDoctorCount: number;
}): boolean {
  const wasActiveDoctor = input.existingRoleName === 'doctor' && input.existingIsActive;
  if (!wasActiveDoctor) return false;
  const staysActiveDoctor = input.nextRoleName === 'doctor' && input.nextIsActive;
  if (staysActiveDoctor) return false;
  return input.otherActiveDoctorCount < 1;
}
