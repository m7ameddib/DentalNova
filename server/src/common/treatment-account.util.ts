/**
 * Patient Account due is the sum of `final_amount_cents` on treatments that
 * exist as a charge. A treatment becomes a charge as soon as it is added
 * (PLANNED / IN_PROGRESS / COMPLETED). Completing it must not create a
 * second charge — there is still one row. VOID treatments are excluded.
 */
import { remainingCents, creditCents } from './money.util';

export function billableTreatmentSql(alias?: string): string {
  const column = alias ? `${alias}.status` : 'status';
  return `${column} != 'VOID'`;
}

export function isBillableTreatmentStatus(status: string | null | undefined): boolean {
  return Boolean(status) && status !== 'VOID';
}

export function billableAmountCents(
  status: string | null | undefined,
  finalAmountCents: number | null | undefined,
): number {
  if (!isBillableTreatmentStatus(status)) return 0;
  const amount = Number(finalAmountCents ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, amount);
}

/** Sum unique treatments by id so the same charge is never counted twice. */
export function sumBillableTreatmentCents(
  treatments: Array<{ id?: number; status: string; finalAmountCents: number }>,
): number {
  const byId = new Map<number | string, number>();
  treatments.forEach((treatment, index) => {
    const key = treatment.id ?? `row-${index}`;
    byId.set(key, billableAmountCents(treatment.status, treatment.finalAmountCents));
  });
  let total = 0;
  for (const amount of byId.values()) total += amount;
  return total;
}

export function buildAccountSummaryTotals(input: {
  subtotalCents: number;
  accountDiscountCents: number;
  totalPaidCents: number;
}) {
  const totalCostCents = Math.max(0, input.subtotalCents - input.accountDiscountCents);
  return {
    subtotalCents: input.subtotalCents,
    accountDiscountCents: input.accountDiscountCents,
    totalCostCents,
    totalPaidCents: input.totalPaidCents,
    remainingCents: remainingCents(totalCostCents, input.totalPaidCents),
    creditCents: creditCents(totalCostCents, input.totalPaidCents),
  };
}

