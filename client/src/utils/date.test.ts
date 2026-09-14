import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  calculateAge,
  formatClockTime,
  formatDateTimeDisplay,
  formatDisplayTimeValue,
  formatTimeDisplay,
  localAddDaysIso,
  localMonthStartIso,
} from './date';

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

test('formatClockTime uses 12-hour AM/PM in English and Arabic', () => {
  assert.equal(formatClockTime('16:00', 'en'), '4:00 PM');
  assert.equal(formatClockTime('18:30', 'en'), '6:30 PM');
  assert.equal(formatClockTime('09:15', 'en'), '9:15 AM');
  assert.equal(formatClockTime('12:00', 'en'), '12:00 PM');
  assert.equal(formatClockTime('00:30', 'en'), '12:30 AM');
  assert.equal(formatClockTime('16:00', 'ar'), '4:00 م');
  assert.equal(formatClockTime('09:15', 'ar'), '9:15 ص');
  assert.equal(formatDisplayTimeValue('16:00', 'en'), '4:00 PM');
  assert.equal(formatDisplayTimeValue('crown', 'en'), 'crown');
});

test('formatTimeDisplay and formatDateTimeDisplay include 12-hour AM/PM', () => {
  assert.match(formatTimeDisplay('2026-09-13T16:00:00.000Z', 'en'), /PM|AM/);
  assert.match(formatDateTimeDisplay('2026-09-13T16:00:00.000Z', 'en'), /PM|AM/);
  assert.doesNotMatch(formatTimeDisplay('2026-09-13T16:00:00.000Z', 'en'), /\b1[3-9]:|\b2[0-3]:/);
  assert.doesNotMatch(formatDateTimeDisplay('2026-09-13T16:00:00.000Z', 'en'), /\b1[3-9]:|\b2[0-3]:/);
});

test('calculateAge uses the local calendar date of birth', () => {
  const now = new Date();
  const y = now.getFullYear() - 20;
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  assert.equal(calculateAge(`${y}-${m}-${d}`), 20);
});
