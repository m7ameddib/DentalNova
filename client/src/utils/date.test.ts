import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysIso, calculateAge, formatDateTimeDisplay, formatReminderClockTime, localAddDaysIso, localMonthStartIso } from './date';

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

test('formatDateTimeDisplay skips invalid timestamps instead of Invalid Date', () => {
  assert.equal(formatDateTimeDisplay('', 'en'), '');
  assert.equal(formatDateTimeDisplay('not-a-date', 'en'), '');
  assert.match(formatDateTimeDisplay('2026-09-13T12:30:00.000Z', 'en'), /2026/);
});

test('formatReminderClockTime is 12-hour AM/PM for reminder strings', () => {
  assert.equal(formatReminderClockTime('16:00'), '4:00 PM');
  assert.equal(formatReminderClockTime('08:15'), '8:15 AM');
  assert.equal(formatReminderClockTime('00:00'), '12:00 AM');
  assert.equal(formatReminderClockTime('12:00'), '12:00 PM');
  assert.equal(formatReminderClockTime('23:59'), '11:59 PM');
  assert.equal(formatReminderClockTime('4:00 PM'), '4:00 PM');
});

test('calculateAge uses the local calendar date of birth', () => {
  const now = new Date();
  const y = now.getFullYear() - 20;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  assert.equal(calculateAge(`${y}-${m}-${d}`), 20);
});
