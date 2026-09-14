/** Patient account remaining — never negative, even when payments exceed the amount due. */
export function remainingCents(totalCostCents: number, totalPaidCents: number): number {
  return Math.max(0, totalCostCents - totalPaidCents);
}

/** Overpayment kept as clinic credit — never mixed into remainingCents. */
export function creditCents(totalCostCents: number, totalPaidCents: number): number {
  return Math.max(0, totalPaidCents - totalCostCents);
}

export function accountBalance(totalCostCents: number, totalPaidCents: number): {
  remainingCents: number;
  creditCents: number;
} {
  return {
    remainingCents: remainingCents(totalCostCents, totalPaidCents),
    creditCents: creditCents(totalCostCents, totalPaidCents),
  };
}
