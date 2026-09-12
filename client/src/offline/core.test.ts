import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMutationToCaches,
  buildOptimisticRecord,
  cacheKey,
  classifyReplayError,
  isNetworkError,
  isQueueableWrite,
  isTempId,
  nextTempId,
  pendingCount,
  remapIds,
} from './core';

test('cache keys and temp ids stay stable', () => {
  assert.equal(cacheKey('get', '/patients'), 'GET /patients');
  assert.equal(nextTempId(-1), -2);
  assert.equal(nextTempId(0), -1);
  assert.equal(isTempId(-4), true);
  assert.equal(isTempId(12), false);
});

test('only essential clinic writes are queued', () => {
  assert.equal(isQueueableWrite('POST', '/patients', { fullName: 'A' }), true);
  assert.equal(isQueueableWrite('PATCH', '/appointments/9/status', { status: 'WAITING' }), true);
  assert.equal(isQueueableWrite('POST', '/auth/login', { username: 'a' }), false);
  assert.equal(isQueueableWrite('POST', '/ai-assistant/chat', {}), false);
  assert.equal(isQueueableWrite('GET', '/patients', null), false);
});

test('network errors are distinguished from HTTP errors', () => {
  assert.equal(isNetworkError({ code: 'ERR_NETWORK' }), true);
  assert.equal(isNetworkError({ response: { status: 500 } }), false);
  assert.equal(classifyReplayError(409), 'conflict');
  assert.equal(classifyReplayError(401), 'auth');
  assert.equal(classifyReplayError(422), 'failed');
  assert.equal(classifyReplayError(503), 'retry');
});

test('id remapping updates nested objects and urls without touching other numbers', () => {
  const mapped = remapIds(
    {
      url: '/patients/-3/treatments',
      patientId: -3,
      amount: 250,
      child: { id: -3 },
    },
    { '-3': 88 },
  );
  assert.deepEqual(mapped, {
    url: '/patients/88/treatments',
    patientId: 88,
    amount: 250,
    child: { id: 88 },
  });
});

test('creating a patient offline updates search cache and detail cache', () => {
  const result = buildOptimisticRecord('POST', '/patients', { fullName: 'Sara', phone: '050' }, -1);
  const next = applyMutationToCaches(
    {
      'GET /patients': { key: 'GET /patients', status: 200, data: [], cachedAt: '' },
    },
    { method: 'POST', url: '/patients', body: { fullName: 'Sara', phone: '050' }, result, tempId: -1 },
  );
  assert.equal((next['GET /patients'].data as { id: number }[])[0].id, -1);
  assert.equal((next['GET /patients/-1'].data as { fullName: string }).fullName, 'Sara');
});

test('creating an appointment updates the day schedule without duplicating', () => {
  const result = buildOptimisticRecord(
    'POST',
    '/appointments',
    { date: '2026-09-12', time: '09:00', patientId: 4 },
    -5,
  );
  const first = applyMutationToCaches(
    {
      'GET /appointments?date=2026-09-12': {
        key: 'GET /appointments?date=2026-09-12',
        status: 200,
        data: { date: '2026-09-12', appointments: [] },
        cachedAt: '',
      },
    },
    { method: 'POST', url: '/appointments', body: result, result, tempId: -5 },
  );
  const second = applyMutationToCaches(first, {
    method: 'POST',
    url: '/appointments',
    body: result,
    result,
    tempId: -5,
  });
  const appointments = (second['GET /appointments?date=2026-09-12'].data as { appointments: unknown[] })
    .appointments;
  assert.equal(appointments.length, 1);
});

test('pending count ignores finished conflicts', () => {
  assert.equal(
    pendingCount([
      { status: 'pending' } as never,
      { status: 'syncing' } as never,
      { status: 'conflict' } as never,
    ]),
    2,
  );
});
