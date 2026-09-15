import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentOverlaps } from './constants';

test('completed and cancelled appointments do not block a slot', () => {
  const rows = [
    { id: 1, time: '09:00', durationMin: 30, status: 'COMPLETED', appointmentType: 'CHECKUP' },
    { id: 2, time: '09:30', durationMin: 30, status: 'CANCELLED', appointmentType: 'CHECKUP' },
  ];
  assert.equal(appointmentOverlaps(rows, 9 * 60, 30), false);
  assert.equal(appointmentOverlaps(rows, 9 * 60 + 30, 30), false);
});

test('active appointments still overlap by duration', () => {
  const rows = [{ id: 1, time: '09:00', durationMin: 60, status: 'SCHEDULED', appointmentType: 'CHECKUP' }];
  assert.equal(appointmentOverlaps(rows, 9 * 60 + 30, 30), true);
  assert.equal(appointmentOverlaps(rows, 10 * 60, 30), false);
});
