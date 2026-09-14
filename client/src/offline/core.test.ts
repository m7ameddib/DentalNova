import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMutationToCaches,
  buildOptimisticRecord,
  cacheKey,
  cachedAppointmentById,
  cachedPatientDetail,
  classifyReplayError,
  conflictCount,
  isAlreadyAppliedReplay,
  isSettledUnreplayable,
  isNetworkError,
  stillHasUnmappedTempId,
  isQueueableWrite,
  isTempId,
  mergeServerListWithLocal,
  nextTempId,
  pendingCount,
  remapIds,
  requeueStuckItems,
  resolveFallbackTimeout,
  searchCachedPatients,
  seedPatientDetailCaches,
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

test('fallback detection uses a short timeout except for live file uploads', () => {
  assert.equal(
    resolveFallbackTimeout({ enabled: true, offlineOrPending: false, configured: 8000 }),
    2000,
  );
  assert.equal(
    resolveFallbackTimeout({ enabled: true, offlineOrPending: true, configured: 8000 }),
    2000,
  );
  assert.equal(
    resolveFallbackTimeout({
      enabled: true,
      offlineOrPending: false,
      isFormData: true,
      configured: 8000,
    }),
    8000,
  );
  assert.equal(
    resolveFallbackTimeout({ enabled: true, skipOfflineFallback: true, offlineOrPending: false, configured: 4000 }),
    4000,
  );
  assert.equal(resolveFallbackTimeout({ enabled: false, offlineOrPending: false, configured: 8000 }), 8000);
});

test('network errors are distinguished from HTTP errors', () => {
  assert.equal(isNetworkError({ code: 'ERR_NETWORK' }), true);
  assert.equal(isNetworkError({ code: 'ECONNREFUSED' }), true);
  assert.equal(isNetworkError({ response: { status: 422 } }), false);
  assert.equal(isNetworkError({ response: { status: 502 } }), true);
  assert.equal(isNetworkError({ response: { status: 500, data: 'Error occurred while trying to proxy' } }), true);
  assert.equal(isNetworkError({ response: { status: 500, data: { message: 'validation failed' } } }), false);
  assert.equal(classifyReplayError(409), 'conflict');
  assert.equal(classifyReplayError(401), 'auth');
  assert.equal(classifyReplayError(403), 'failed');
  assert.equal(classifyReplayError(422), 'failed');
  assert.equal(classifyReplayError(503), 'retry');
  assert.equal(isAlreadyAppliedReplay(404), true);
  assert.equal(isAlreadyAppliedReplay(409), true);
  assert.equal(isAlreadyAppliedReplay(403), false);
  assert.equal(stillHasUnmappedTempId('/patients/-2/treatments'), true);
  assert.equal(stillHasUnmappedTempId('/patients/88/treatments'), false);
  assert.equal(isSettledUnreplayable({ status: 'conflict' }), true);
  assert.equal(isSettledUnreplayable({ status: 'failed', lastError: 'Request failed with status code 409' }), true);
  assert.equal(isSettledUnreplayable({ status: 'failed', lastError: 'http-403' }), true);
  assert.equal(isSettledUnreplayable({ status: 'failed', lastError: 'ECONNABORTED' }), false);
  assert.equal(conflictCount([{ status: 'conflict' } as never, { status: 'failed', lastError: 'http-409' } as never]), 0);
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

test('offline patient search filters the locally cached clinic list', () => {
  const caches = {
    'GET /patients': {
      key: 'GET /patients',
      status: 200,
      data: [
        { id: 1, fullName: 'Sara Ali', phone: '050111', fileNumber: 'P-1' },
        { id: 2, fullName: 'Omar', phone: '050222', fileNumber: 'P-2' },
      ],
      cachedAt: '',
    },
  };
  assert.equal(searchCachedPatients(caches, 'sara').length, 1);
  assert.equal(searchCachedPatients(caches, '050222')[0].id, 2);
  assert.equal(searchCachedPatients(caches, 'missing').length, 0);
});

test('reconnect merge keeps unsynced local patients', () => {
  const merged = mergeServerListWithLocal(
    [{ id: 10, fullName: 'Cloud' }],
    [{ id: -2, fullName: 'Local' }, { id: 10, fullName: 'Old' }],
  ) as { id: number }[];
  assert.equal(merged.some((row) => row.id === -2), true);
  assert.equal(merged.filter((row) => row.id === 10).length, 1);
});

test('lab case optimistic records keep Lab Cost', () => {
  const result = buildOptimisticRecord('POST', '/lab-cases', { patientId: 1, labCost: 75, workType: 'CROWN' }, -8);
  assert.equal(result.labCostCents, 7500);
});

test('stuck syncing and failed items are requeued without dropping later work', () => {
  const stale = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const next = requeueStuckItems([
    { status: 'syncing', lastAttemptAt: stale } as never,
    { status: 'failed', attempts: 2, lastAttemptAt: stale } as never,
    { status: 'failed', attempts: 8, lastAttemptAt: stale } as never,
  ]);
  assert.equal(next[0].status, 'pending');
  assert.equal(next[1].status, 'pending');
  assert.equal(next[2].status, 'failed');
});

test('prefetching the patient list seeds missing per-id detail caches', () => {
  const caches: Record<string, { key: string; status: number; data: unknown; cachedAt: string }> = {};
  seedPatientDetailCaches(
    caches,
    [{ id: 4, fullName: 'Cached Patient', phone: '07000004', fileNumber: 'P-4' }],
    '2026-09-13T00:00:00.000Z',
  );
  assert.equal((caches['GET /patients/4']?.data as { fullName: string }).fullName, 'Cached Patient');
  seedPatientDetailCaches(caches, [{ id: 4, fullName: 'Stale' }], 'later');
  assert.equal((caches['GET /patients/4']?.data as { fullName: string }).fullName, 'Cached Patient');
});

test('patient detail can be rebuilt from the cached clinic list', () => {
  const caches = {
    'GET /patients': {
      key: 'GET /patients',
      status: 200,
      data: [{ id: 7, fullName: 'Lina', phone: '050', fileNumber: 'P-7' }],
      cachedAt: '',
    },
  };
  const detail = cachedPatientDetail(caches, 7);
  assert.equal(detail?.fullName, 'Lina');
  assert.ok(Array.isArray(detail?.familyMembers));
});

test('appointment by id is found inside a cached day schedule', () => {
  const caches = {
    'GET /appointments?date=2026-09-13': {
      key: 'GET /appointments?date=2026-09-13',
      status: 200,
      data: { date: '2026-09-13', appointments: [{ id: 3, time: '10:00', date: '2026-09-13' }] },
      cachedAt: '',
    },
  };
  assert.equal(cachedAppointmentById(caches, 3)?.time, '10:00');
  assert.equal(cachedAppointmentById(caches, 99), null);
});

test('offline payment updates the cached account remaining without going negative', () => {
  const result = buildOptimisticRecord(
    'POST',
    '/payments',
    { patientId: 4, amount: 20, method: 'CASH' },
    -9,
  );
  const next = applyMutationToCaches(
    {
      'GET /patients/4/account-summary': {
        key: 'GET /patients/4/account-summary',
        status: 200,
        data: { totalCostCents: 1000, totalPaidCents: 500, remainingCents: 500 },
        cachedAt: '',
      },
    },
    { method: 'POST', url: '/payments', body: { patientId: 4, amount: 20 }, result, tempId: -9 },
  );
  const summary = next['GET /patients/4/account-summary'].data as {
    totalPaidCents: number;
    remainingCents: number;
  };
  assert.equal(summary.totalPaidCents, 2500);
  assert.equal(summary.remainingCents, 0);
});

test('offline payment seeds a missing account-summary so the chart is not blank', () => {
  const result = buildOptimisticRecord('POST', '/payments', { patientId: 4, amount: 5, method: 'CASH' }, -11);
  const next = applyMutationToCaches(
    {},
    { method: 'POST', url: '/payments', body: { patientId: 4, amount: 5 }, result, tempId: -11 },
  );
  const summary = next['GET /patients/4/account-summary'].data as {
    totalPaidCents: number;
    remainingCents: number;
    lastPayments: { id: number }[];
  };
  assert.equal(summary.totalPaidCents, 500);
  assert.equal(summary.remainingCents, 0);
  assert.equal(summary.lastPayments[0]?.id, -11);
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

