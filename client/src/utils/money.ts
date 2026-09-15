export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
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
