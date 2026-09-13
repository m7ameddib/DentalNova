import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysIso, calculateAge, localAddDaysIso, localMonthStartIso } from './date';

test('addDaysIso stays on the local calendar and matches localAddDaysIso', () => {
  assert.equal(addDaysIso('2026-03-08', 1), '2026-03-09');
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysIso('2026-03-01', -1), '2026-02-28');
  assert.equal(addDaysIso('2026-09-13', 3), localAddDaysIso('2026-09-13', 3));
});

test('localMonthStartIso uses local year and month', () => {
  assert.equal(localMonthStartIso(new Date(2026, 8, 13)), '2026-09-01');
  assert.equal(localMonthStartIso(new Date(2026, 0, 1)), '2026-01-01');
});

test('calculateAge uses the local calendar date of birth', () => {
  const now = new Date();
  const y = now.getFullYear() - 20;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  assert.equal(calculateAge(`${y}-${m}-${d}`), 20);
});
