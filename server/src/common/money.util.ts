/** Patient account remaining — never negative, even when payments exceed the amount due. */
export function remainingCents(totalCostCents: number, totalPaidCents: number): number {
  return Math.max(0, totalCostCents - totalPaidCents);
}

/**
 * Treatments count toward amount due as soon as they are added.
 * VOID is excluded so a treatment is never billed after it is voided,
 * and completing a treatment cannot double-count (same row, status only).
 */
export function isBillableTreatmentStatus(status: string | null | undefined): boolean {
  return Boolean(status) && status !== 'VOID';
}
