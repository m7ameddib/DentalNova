export function centsToAmount(cents: number): number {
  const n = Number(cents);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

export function amountToCents(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Number(`${n}e2`));
}

export function formatMoney(cents: number): string {
  return `$${centsToAmount(cents).toFixed(2)}`;
}

export function remainingAfterUnreflectedPayment(
  remainingCents: number | null | undefined,
  paymentAmountCents: number,
): number {
  return Math.max(0, (remainingCents ?? 0) - Math.max(0, paymentAmountCents));
}
