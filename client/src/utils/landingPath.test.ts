import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLandingPath } from './landingPath';

test('prefers the patient workspace when patients.view is granted', () => {
  assert.equal(defaultLandingPath(['appointments.view', 'patients.view']), '/');
});

test('falls back to the first permitted module', () => {
  assert.equal(defaultLandingPath(['appointments.view']), '/appointments');
  assert.equal(defaultLandingPath(['reports.view']), '/reports');
  assert.equal(defaultLandingPath(['settings.view']), '/settings');
});

test('returns home when no matching permission exists', () => {
  assert.equal(defaultLandingPath([]), '/');
  assert.equal(defaultLandingPath(undefined), '/');
});
