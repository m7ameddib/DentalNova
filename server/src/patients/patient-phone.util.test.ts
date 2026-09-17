import test from 'node:test';
import assert from 'node:assert/strict';
import { conflictingPhoneOwners } from './patient-phone.util';

test('create without family treats any active match as a conflict', () => {
  const conflicts = conflictingPhoneOwners([{ id: 2, familyGroupId: 9 }]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].id, 2);
});

test('update/restore ignore the same patient and the same family group', () => {
  const matches = [
    { id: 1, familyGroupId: 4 },
    { id: 2, familyGroupId: 4 },
    { id: 3, familyGroupId: 8 },
  ];
  const conflicts = conflictingPhoneOwners(matches, { excludePatientId: 1, familyGroupId: 4 });
  assert.deepEqual(
    conflicts.map((row) => row.id),
    [3],
  );
});

test('family-linked create allows the family phone and rejects outsiders', () => {
  const conflicts = conflictingPhoneOwners(
    [
      { id: 10, familyGroupId: 1 },
      { id: 11, familyGroupId: 2 },
    ],
    { familyGroupId: 1 },
  );
  assert.deepEqual(
    conflicts.map((row) => row.id),
    [11],
  );
});
