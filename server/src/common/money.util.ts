/**
 * Convert a major-unit amount (JSON number, max 2 decimal places) to integer cents.
 * Uses exponential rounding so values like 19.99 and 1.005 do not depend on
 * IEEE `amount * 100` binary residue.
 */
export function amountToCents(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    throw new RangeError('Amount must be a finite number');
  }
  return Math.round(Number(`${n}e2`));
}

export function centsToAmount(cents: number): number {
  const n = Number(cents);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

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
