import test from 'node:test';
import assert from 'node:assert/strict';
import { wouldRemoveLastDoctor } from './last-doctor.util';

test('blocks deactivating or demoting the last active doctor', () => {
  assert.equal(
    wouldRemoveLastDoctor({
      existingRoleName: 'doctor',
      existingIsActive: true,
      nextRoleName: 'doctor',
      nextIsActive: false,
      otherActiveDoctorCount: 0,
    }),
    true,
  );
  assert.equal(
    wouldRemoveLastDoctor({
      existingRoleName: 'doctor',
      existingIsActive: true,
      nextRoleName: 'employee',
      nextIsActive: true,
      otherActiveDoctorCount: 0,
    }),
    true,
  );
});

test('allows the change when another active doctor remains', () => {
  assert.equal(
    wouldRemoveLastDoctor({
      existingRoleName: 'doctor',
      existingIsActive: true,
      nextRoleName: 'doctor',
      nextIsActive: false,
      otherActiveDoctorCount: 1,
    }),
    false,
  );
});

test('ignores employees and already-inactive doctors', () => {
  assert.equal(
    wouldRemoveLastDoctor({
      existingRoleName: 'employee',
      existingIsActive: true,
      nextRoleName: 'employee',
      nextIsActive: false,
      otherActiveDoctorCount: 0,
    }),
    false,
  );
  assert.equal(
    wouldRemoveLastDoctor({
      existingRoleName: 'doctor',
      existingIsActive: false,
      nextRoleName: 'doctor',
      nextIsActive: false,
      otherActiveDoctorCount: 0,
    }),
    false,
  );
});
