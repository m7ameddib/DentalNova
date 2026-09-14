import test from 'node:test';
import assert from 'node:assert/strict';
import { expandTreatmentDisplayRows, isBillableTreatment } from './treatment-display';

test('invoice/account rows include added treatments and skip voided ones', () => {
  assert.equal(isBillableTreatment({ status: 'PLANNED' }), true);
  assert.equal(isBillableTreatment({ status: 'COMPLETED' }), true);
  assert.equal(isBillableTreatment({ status: 'VOID' }), false);
  const rows = expandTreatmentDisplayRows([
    {
      id: 1,
      status: 'PLANNED',
      finalAmountCents: 5000,
      baseAmountCents: 5000,
      discountCents: 0,
      teeth: [11],
      toothNumber: 11,
      treatmentScope: 'SINGLE',
    } as never,
    {
      id: 2,
      status: 'VOID',
      finalAmountCents: 9000,
      baseAmountCents: 9000,
      discountCents: 0,
      teeth: [12],
      toothNumber: 12,
      treatmentScope: 'SINGLE',
    } as never,
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].finalAmountCents, 5000);
});
