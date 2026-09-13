/** Patient account remaining — never negative, even when payments exceed the amount due. */
export function remainingCents(totalCostCents: number, totalPaidCents: number): number {
  return Math.max(0, totalCostCents - totalPaidCents);
}
