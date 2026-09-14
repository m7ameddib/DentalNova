import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingCents } from './money.util';
import {
  billableAmountCents,
  billableTreatmentSql,
  buildAccountSummaryTotals,
  isBillableTreatmentStatus,
  sumBillableTreatmentCents,
} from './treatment-account.util';

test('planned, in-progress, and completed treatments are billable; void is not', () => {
  assert.equal(isBillableTreatmentStatus('PLANNED'), true);
  assert.equal(isBillableTreatmentStatus('IN_PROGRESS'), true);
  assert.equal(isBillableTreatmentStatus('COMPLETED'), true);
  assert.equal(isBillableTreatmentStatus('VOID'), false);
  assert.equal(billableAmountCents('PLANNED', 12_000), 12_000);
  assert.equal(billableAmountCents('VOID', 12_000), 0);
});

test('adding a treatment with amount X is due immediately; completing does not double-count', () => {
  const added = [{ id: 1, status: 'PLANNED', finalAmountCents: 15_000 }];
  assert.equal(sumBillableTreatmentCents(added), 15_000);
  const completed = [{ id: 1, status: 'COMPLETED', finalAmountCents: 15_000 }];
  assert.equal(sumBillableTreatmentCents(completed), 15_000);
  const duplicatedRows = [...completed, ...completed];
  assert.equal(sumBillableTreatmentCents(duplicatedRows), 15_000);
});

test('editing a treatment updates the existing charge; delete/void removes it', () => {
  const original = [{ id: 4, status: 'IN_PROGRESS', finalAmountCents: 8_000 }];
  assert.equal(sumBillableTreatmentCents(original), 8_000);
  const edited = [{ id: 4, status: 'IN_PROGRESS', finalAmountCents: 11_500 }];
  assert.equal(sumBillableTreatmentCents(edited), 11_500);
  const voided = [{ id: 4, status: 'VOID', finalAmountCents: 11_500 }];
  assert.equal(sumBillableTreatmentCents(voided), 0);
  assert.equal(sumBillableTreatmentCents([]), 0);
});

test('account remaining stays clamped at >= 0 after billable treatments and payments', () => {
  const due = sumBillableTreatmentCents([{ id: 1, status: 'PLANNED', finalAmountCents: 5_000 }]);
  assert.equal(remainingCents(due, 2_000), 3_000);
  assert.equal(remainingCents(due, 9_000), 0);
  assert.ok(remainingCents(due, 9_000) >= 0);
});

test('billable SQL excludes VOID with or without a table alias', () => {
  assert.equal(billableTreatmentSql(), `status != 'VOID'`);
  assert.equal(billableTreatmentSql('pt'), `pt.status != 'VOID'`);
});

test('account summary shows added treatment amount as due; completing the same charge does not change it', () => {
  const afterAdd = buildAccountSummaryTotals({
    subtotalCents: 15_000,
    accountDiscountCents: 0,
    totalPaidCents: 0,
  });
  const afterComplete = buildAccountSummaryTotals({
    subtotalCents: 15_000,
    accountDiscountCents: 0,
    totalPaidCents: 0,
  });
  assert.equal(afterAdd.remainingCents, 15_000);
  assert.equal(afterComplete.remainingCents, afterAdd.remainingCents);
});

test('account discounts reduce due; remainingCents never goes negative', () => {
  const withDiscount = buildAccountSummaryTotals({
    subtotalCents: 10_000,
    accountDiscountCents: 2_500,
    totalPaidCents: 4_000,
  });
  assert.equal(withDiscount.totalCostCents, 7_500);
  assert.equal(withDiscount.remainingCents, 3_500);

  const overpaid = buildAccountSummaryTotals({
    subtotalCents: 10_000,
    accountDiscountCents: 1_000,
    totalPaidCents: 20_000,
  });
  assert.equal(overpaid.remainingCents, 0);
  assert.equal(overpaid.creditCents, 11_000);
  assert.ok(overpaid.remainingCents >= 0);
});
