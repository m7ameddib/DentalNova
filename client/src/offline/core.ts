/** Pure offline-fallback helpers — no IndexedDB or network. Safe to unit-test. */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

export interface OutboxItem {
  id: string;
  method: Exclude<HttpMethod, 'GET'>;
  url: string;
  data: unknown;
  headers: Record<string, string>;
  tempId?: number;
  createdAt: string;
  status: OutboxStatus;
  lastError?: string;
  attempts?: number;
  lastAttemptAt?: string;
  userId: number | null;
  clinicId: string;
}

export interface CachedGet {
  key: string;
  status: number;
  data: unknown;
  cachedAt: string;
}

const BLOCKED_WRITE_PREFIXES = [
  '/auth/',
  '/installation/',
  '/backup/',
  '/updates/',
  '/ai-assistant/',
  '/ai-provider/',
  '/dibnova-admin/',
  '/sync/',
  '/health',
];

export function normalizePath(url: string): string {
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/i, '');
  const pathOnly = withoutOrigin.split('?')[0] ?? withoutOrigin;
  const trimmed = pathOnly.replace(/^\/api(?=\/)/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function cacheKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

export function isReadMethod(method?: string): boolean {
  return (method ?? 'get').toUpperCase() === 'GET';
}

export function isWriteMethod(method?: string): boolean {
  const m = (method ?? 'get').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

export const DEFAULT_API_TIMEOUT_MS = 8000;
export const FALLBACK_DETECT_TIMEOUT_MS = 2000;

/** Cap clinic requests so a dead upstream fails into local fallback quickly. File uploads keep the long timeout while still online. */
export function resolveFallbackTimeout(args: {
  enabled: boolean;
  skipOfflineFallback?: boolean;
  offlineOrPending: boolean;
  isFormData?: boolean;
  configured?: number;
}): number | undefined {
  if (!args.enabled || args.skipOfflineFallback) return args.configured;
  if (args.isFormData && !args.offlineOrPending) return args.configured;
  return Math.min(args.configured ?? DEFAULT_API_TIMEOUT_MS, FALLBACK_DETECT_TIMEOUT_MS);
}

function unreachableStatus(response: unknown): boolean {
  const rec = asRecord(response);
  const status = Number(rec?.status);
  if (status === 502 || status === 503 || status === 504) return true;
  if (status !== 500) return false;
  const data = rec?.data;
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? '');
  return /proxy|ECONNREFUSED|ECONNRESET|upstream-unreachable/i.test(text);
}

/** True when the API never produced an application response (lost internet, dead upstream, timeout). */
export function isNetworkError(error: {
  response?: unknown;
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  if (error.response && !unreachableStatus(error.response)) return false;
  if (error.response && unreachableStatus(error.response)) return true;
  const code = error.code ?? '';
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ERR_CANCELED' ||
    code === 'ECONNREFUSED' ||
    /network|timeout|offline|ECONNREFUSED/i.test(error.message ?? '')
  );
}

export function isQueueableWrite(method: string | undefined, url: string, data: unknown): boolean {
  if (!isWriteMethod(method)) return false;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return false;
  const path = normalizePath(url);
  if (path === '/auth/login' || path.startsWith('/auth/forgot') || path.startsWith('/auth/reset')) {
    return false;
  }
  return !BLOCKED_WRITE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

export function nextTempId(currentMin: number): number {
  const next = currentMin < 0 ? currentMin - 1 : -1;
  return next;
}

export function isTempId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id < 0;
}

export function remapIds<T>(value: T, idMap: Record<string, number>): T {
  if (value == null) return value;
  if (typeof value === 'number') {
    const mapped = idMap[String(value)];
    return (mapped ?? value) as T;
  }
  if (typeof value === 'string') {
    return value.replace(/(^|\/)(-?\d+)(?=\/|$|\?)/g, (full, prefix: string, raw: string) => {
      const mapped = idMap[raw];
      return mapped == null ? full : `${prefix}${mapped}`;
    }) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => remapIds(item, idMap)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = remapIds(item, idMap);
    }
    return out as T;
  }
  return value;
}

export function classifyReplayError(status?: number): 'conflict' | 'failed' | 'auth' | 'retry' {
  if (!status) return 'retry';
  if (status === 401) return 'auth';
  if (status === 404 || status === 409) return 'conflict';
  if (status >= 400 && status < 500) return 'failed';
  return 'retry';
}

/** 404/409 on replay usually means the write already landed or the row is gone. */
export function isAlreadyAppliedReplay(status?: number): boolean {
  return status === 404 || status === 409;
}

export function parseOutboxHttpStatus(lastError?: string): number | undefined {
  if (!lastError) return undefined;
  const coded = lastError.match(/status code (\d{3})/i) ?? lastError.match(/^http-(\d{3})$/i);
  if (coded) return Number(coded[1]);
  if (lastError === 'conflict') return 409;
  return undefined;
}

/** Client errors that will never sync; keeping them only pins the banner. */
export function isUnreplayableClientError(status?: number): boolean {
  return status === 400 || status === 403 || status === 404 || status === 409 || status === 422;
}

export function isSettledUnreplayable(item: Pick<OutboxItem, 'status' | 'lastError'>): boolean {
  if (item.status === 'conflict') return true;
  if (item.status !== 'failed') return false;
  if (item.lastError === 'unmapped-temp-id') return true;
  return isUnreplayableClientError(parseOutboxHttpStatus(item.lastError));
}

export function stillHasUnmappedTempId(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'number') return isTempId(value);
  if (typeof value === 'string') return /(^|\/)-\d+(?=\/|$|\?)/.test(value);
  if (Array.isArray(value)) return value.some((item) => stillHasUnmappedTempId(item));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => stillHasUnmappedTempId(item));
  }
  return false;
}

export function collectTempIds(value: unknown, into = new Set<number>()): Set<number> {
  if (value == null) return into;
  if (typeof value === 'number') {
    if (isTempId(value)) into.add(value);
    return into;
  }
  if (typeof value === 'string') {
    const re = /(^|\/)(-\d+)(?=\/|$|\?)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      into.add(Number(match[2]));
    }
    return into;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTempIds(item, into));
    return into;
  }
  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectTempIds(item, into));
  }
  return into;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function upsertArrayItem(list: unknown[], item: Record<string, unknown>): unknown[] {
  const id = item.id;
  const index = list.findIndex((entry) => asRecord(entry)?.id === id);
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = { ...asRecord(next[index]), ...item };
  return next;
}

function removeById(value: unknown, id: number): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => asRecord(entry)?.id !== id)
      .map((entry) => removeById(entry, id));
  }
  const rec = asRecord(value);
  if (!rec) return value;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(rec)) {
    next[key] = removeById(item, id);
  }
  return next;
}

function mergeById(value: unknown, id: number, patch: Record<string, unknown>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => mergeById(entry, id, patch));
  }
  const rec = asRecord(value);
  if (!rec) return value;
  if (rec.id === id) {
    return { ...rec, ...patch, id, updatedAt: patch.updatedAt ?? new Date().toISOString() };
  }
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(rec)) {
    next[key] = mergeById(item, id, patch);
  }
  return next;
}

export function buildOptimisticRecord(
  method: string,
  url: string,
  body: unknown,
  tempId: number,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const payload = asRecord(body) ?? {};
  const path = normalizePath(url);
  const base = {
    id: tempId,
    createdAt: now,
    updatedAt: now,
    ...payload,
  };

  if (path === '/patients' || path.startsWith('/patients/')) {
    return {
      fileNumber: `OFF-${Math.abs(tempId)}`,
      fullName: payload.fullName ?? '',
      phone: payload.phone ?? '',
      gender: payload.gender ?? null,
      dateOfBirth: payload.dateOfBirth ?? null,
      approxAge: payload.approxAge ?? null,
      weightKg: payload.weightKg ?? null,
      address: payload.address ?? null,
      areaId: payload.areaId ?? null,
      guarantorId: payload.guarantorId ?? null,
      medicalNotes: null,
      generalNotes: payload.generalNotes ?? null,
      familyGroupId: null,
      archivedAt: null,
      familyMembers: [],
      ...base,
    };
  }

  if (path.startsWith('/appointments')) {
    return {
      patientId: payload.patientId ?? null,
      guestName: payload.guestName ?? null,
      guestPhone: payload.guestPhone ?? null,
      date: payload.date,
      time: payload.time,
      durationMin: payload.durationMin ?? 30,
      appointmentType: payload.appointmentType ?? 'CHECKUP',
      reason: payload.reason ?? null,
      status: payload.status ?? 'SCHEDULED',
      notes: payload.notes ?? null,
      reminderSentAt: null,
      createdById: null,
      patientName: payload.guestName ?? payload.patientName ?? '',
      patientFileNumber: null,
      patientPhone: payload.guestPhone ?? payload.patientPhone ?? null,
      ...base,
    };
  }

  if (path === '/treatments' || path.startsWith('/treatments/')) {
    return {
      patientId: payload.patientId,
      treatmentTypeId: payload.treatmentTypeId,
      toothNumber: Array.isArray(payload.teeth) ? payload.teeth[0] ?? null : null,
      teeth: payload.teeth ?? [],
      treatmentDate: payload.treatmentDate ?? null,
      treatmentScope: payload.treatmentScope ?? null,
      priceCents: 0,
      baseAmountCents: 0,
      discountCents: payload.discount != null ? Math.round(Number(payload.discount) * 100) : 0,
      finalAmountCents: 0,
      status: payload.status ?? 'PLANNED',
      note: payload.note ?? null,
      doctorId: null,
      treatmentCode: '',
      treatmentAbbreviation: '',
      treatmentLabel: '',
      treatmentColor: '',
      doctorName: null,
      followUp1Days: null,
      followUp2Days: null,
      followUp3Days: null,
      ...base,
    };
  }

  if (path === '/payments' || path.startsWith('/payments/')) {
    return {
      patientId: payload.patientId,
      amountCents: payload.amount != null ? Math.round(Number(payload.amount) * 100) : 0,
      method: payload.method ?? 'CASH',
      date: payload.date ?? now.slice(0, 10),
      note: payload.note ?? null,
      recordedById: null,
      status: 'ACTIVE',
      ...base,
    };
  }

  if (path === '/lab-cases' || path.startsWith('/lab-cases/')) {
    const labCost =
      payload.labCostCents ??
      (payload.labCost != null ? Math.round(Number(payload.labCost) * 100) : 0);
    return {
      patientId: payload.patientId,
      laboratoryId: payload.laboratoryId ?? null,
      workType: payload.workType ?? '',
      workTypeLabel: payload.workTypeLabel ?? payload.workType ?? '',
      labCostCents: labCost,
      labCost,
      shade: payload.shade ?? null,
      notes: payload.notes ?? null,
      status: payload.status ?? 'SENT',
      ...base,
    };
  }

  return base;
}

export function patientMatchesQuery(patient: Record<string, unknown>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = String(patient.fullName ?? '').toLowerCase();
  const phone = String(patient.phone ?? '');
  const file = String(patient.fileNumber ?? '').toLowerCase();
  return name.includes(q) || phone.includes(q) || file.includes(q);
}

export function collectCachedPatients(caches: Record<string, CachedGet>): Record<string, unknown>[] {
  const byId = new Map<number, Record<string, unknown>>();
  const ingest = (item: unknown) => {
    const rec = asRecord(item);
    if (!rec || typeof rec.id !== 'number') return;
    byId.set(rec.id, { ...byId.get(rec.id), ...rec });
  };
  for (const [key, entry] of Object.entries(caches)) {
    if (key === 'GET /patients' || key.startsWith('GET /patients?')) {
      if (Array.isArray(entry.data)) entry.data.forEach(ingest);
    }
    if (/^GET \/patients\/-?\d+$/.test(key)) ingest(entry.data);
  }
  return [...byId.values()];
}

export function searchCachedPatients(
  caches: Record<string, CachedGet>,
  query: string,
): Record<string, unknown>[] {
  return collectCachedPatients(caches).filter((patient) => patientMatchesQuery(patient, query));
}

export function cachedPatientDetail(
  caches: Record<string, CachedGet>,
  id: number,
): Record<string, unknown> | null {
  const exact = asRecord(caches[`GET /patients/${id}`]?.data);
  if (exact) return exact;
  const found = collectCachedPatients(caches).find((patient) => patient.id === id);
  if (!found) return null;
  return { ...found, familyMembers: found.familyMembers ?? [] };
}

/** Prefetch of GET /patients only has list rows — seed per-id detail keys so remounts can open a chart. */
export function seedPatientDetailCaches(
  caches: Record<string, CachedGet>,
  listData: unknown,
  cachedAt: string,
): void {
  if (!Array.isArray(listData)) return;
  for (const row of listData) {
    const rec = asRecord(row);
    if (typeof rec?.id !== 'number') continue;
    const detailKey = `GET /patients/${rec.id}`;
    if (caches[detailKey]) continue;
    caches[detailKey] = {
      key: detailKey,
      status: 200,
      data: { ...rec, familyMembers: rec.familyMembers ?? [] },
      cachedAt,
    };
  }
}

export function cachedAppointmentById(
  caches: Record<string, CachedGet>,
  id: number,
): Record<string, unknown> | null {
  for (const entry of Object.values(caches)) {
    const rec = asRecord(entry.data);
    const appointments = rec?.appointments;
    if (!Array.isArray(appointments)) continue;
    for (const item of appointments) {
      const appt = asRecord(item);
      if (appt && appt.id === id) return appt;
    }
  }
  return null;
}

export function parsePatientIdFromUrl(url: string): number | null {
  const path = normalizePath(url.split('?')[0] ?? url);
  const match = path.match(/^\/patients\/(-?\d+)$/);
  return match ? Number(match[1]) : null;
}

export function parseAppointmentIdFromUrl(url: string): number | null {
  const path = normalizePath(url.split('?')[0] ?? url);
  const match = path.match(/^\/appointments\/(-?\d+)$/);
  return match ? Number(match[1]) : null;
}

export function parsePatientsQuery(url: string): string | null {
  const path = normalizePath(url.split('?')[0] ?? url);
  if (path !== '/patients') return null;
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return params.get('q');
}

function emptyAccountSummary(): Record<string, unknown> {
  return {
    subtotalCents: 0,
    accountDiscountCents: 0,
    totalCostCents: 0,
    totalPaidCents: 0,
    remainingCents: 0,
    lastPayments: [],
    lastDiscounts: [],
  };
}

function patchAccountSummaryCache(
  caches: Record<string, CachedGet>,
  writeCache: (key: string, data: unknown) => void,
  patientId: number,
  delta: { paidCents?: number; costCents?: number; payment?: Record<string, unknown> },
): void {
  const key = `GET /patients/${patientId}/account-summary`;
  const rec = asRecord(caches[key]?.data) ?? emptyAccountSummary();
  const totalPaidCents = Number(rec.totalPaidCents ?? 0) + (delta.paidCents ?? 0);
  const totalCostCents = Number(rec.totalCostCents ?? 0) + (delta.costCents ?? 0);
  const lastPayments = Array.isArray(rec.lastPayments) ? rec.lastPayments : [];
  writeCache(key, {
    ...rec,
    subtotalCents: Number(rec.subtotalCents ?? totalCostCents),
    totalPaidCents,
    totalCostCents,
    remainingCents: Math.max(0, totalCostCents - totalPaidCents),
    lastPayments: delta.payment ? [delta.payment, ...lastPayments].slice(0, 10) : lastPayments,
  });
}

/** Keep locally created (temp-id) rows when a server list arrives so reconnect does not drop unsynced work. */
export function mergeServerListWithLocal(
  serverData: unknown,
  localData: unknown,
): unknown {
  if (!Array.isArray(serverData) || !Array.isArray(localData)) return serverData;
  const serverIds = new Set(
    serverData
      .map((item) => asRecord(item)?.id)
      .filter((id): id is number => typeof id === 'number'),
  );
  const extras = localData.filter((item) => {
    const rec = asRecord(item);
    return rec && typeof rec.id === 'number' && rec.id < 0 && !serverIds.has(rec.id);
  });
  return extras.length === 0 ? serverData : [...extras, ...serverData];
}

export function applyMutationToCaches(
  caches: Record<string, CachedGet>,
  mutation: {
    method: string;
    url: string;
    body: unknown;
    result?: Record<string, unknown>;
    tempId?: number;
  },
): Record<string, CachedGet> {
  const next = { ...caches };
  const method = mutation.method.toUpperCase();
  const path = normalizePath(mutation.url);
  const now = new Date().toISOString();
  const result =
    mutation.result ??
    (mutation.tempId != null
      ? buildOptimisticRecord(method, mutation.url, mutation.body, mutation.tempId)
      : asRecord(mutation.body));

  if (!result) return next;

  const writeCache = (key: string, data: unknown) => {
    next[key] = { key, status: 200, data, cachedAt: now };
  };

  if (method === 'POST') {
    if (path === '/patients') {
      for (const [key, entry] of Object.entries(next)) {
        if (key === 'GET /patients' || key.startsWith('GET /patients?')) {
          if (Array.isArray(entry.data)) {
            writeCache(key, upsertArrayItem(entry.data, result));
          }
        }
      }
      writeCache(`GET /patients/${result.id}`, { ...result, familyMembers: result.familyMembers ?? [] });
    }

    if (path === '/appointments') {
      const date = String(result.date ?? '');
      const month = date.slice(0, 7);
      for (const [key, entry] of Object.entries(next)) {
        if (date && (key === `GET /appointments?date=${date}` || key.endsWith(`date=${date}`))) {
          const schedule = asRecord(entry.data);
          if (schedule && Array.isArray(schedule.appointments)) {
            writeCache(key, {
              ...schedule,
              appointments: upsertArrayItem(schedule.appointments, result),
            });
          }
        }
        if (month && key.includes('/appointments/month') && key.includes(month) && Array.isArray(entry.data)) {
          const rows = entry.data.map((row) => {
            const rec = asRecord(row);
            if (rec?.date === date) {
              return { ...rec, count: Number(rec.count ?? 0) + 1 };
            }
            return row;
          });
          writeCache(key, rows);
        }
        if (
          result.patientId != null &&
          key.includes(`/patients/${result.patientId}/appointments/upcoming`) &&
          Array.isArray(entry.data)
        ) {
          writeCache(key, upsertArrayItem(entry.data, result));
        }
      }
    }

    if (path === '/treatments' && result.patientId != null) {
      const treatmentsKey = `GET /patients/${result.patientId}/treatments`;
      if (!next[treatmentsKey] || !Array.isArray(next[treatmentsKey].data)) {
        writeCache(treatmentsKey, [result]);
      }
      for (const [key, entry] of Object.entries(next)) {
        if (key.includes(`/patients/${result.patientId}/treatments`) && Array.isArray(entry.data)) {
          writeCache(key, upsertArrayItem(entry.data, result));
        }
      }
      if (String(result.status ?? '') !== 'VOID') {
        patchAccountSummaryCache(next, writeCache, Number(result.patientId), {
          costCents: Number(result.finalAmountCents ?? 0),
        });
      }
    }

    if (path === '/payments' && result.patientId != null) {
      const paymentsKey = `GET /patients/${result.patientId}/payments`;
      if (!next[paymentsKey] || !Array.isArray(next[paymentsKey].data)) {
        writeCache(paymentsKey, [result]);
      }
      for (const [key, entry] of Object.entries(next)) {
        if (key.includes(`/patients/${result.patientId}/payments`) && Array.isArray(entry.data)) {
          writeCache(key, upsertArrayItem(entry.data, result));
        }
      }
      patchAccountSummaryCache(next, writeCache, Number(result.patientId), {
        paidCents: Number(result.amountCents ?? 0),
        payment: result,
      });
    }
  }

  if (method === 'PATCH' || method === 'PUT') {
    const idMatch = path.match(/\/(\d+|-?\d+)(?:\/|$)/);
    const id = idMatch ? Number(idMatch[1]) : Number(result.id);
    if (!Number.isNaN(id)) {
      const patch = { ...asRecord(mutation.body), ...result, id };
      for (const [key, entry] of Object.entries(next)) {
        writeCache(key, mergeById(entry.data, id, patch));
      }
    }
  }

  if (method === 'DELETE') {
    const idMatch = path.match(/\/(\d+|-?\d+)(?:\/|$)/);
    const id = idMatch ? Number(idMatch[1]) : Number(result.id);
    if (!Number.isNaN(id)) {
      for (const [key, entry] of Object.entries(next)) {
        if (key.endsWith(`/${id}`)) {
          delete next[key];
          continue;
        }
        writeCache(key, removeById(entry.data, id));
      }
    }
  }

  return next;
}

export const MAX_SYNC_ATTEMPTS = 8;
export const STUCK_SYNC_MS = 2 * 60 * 1000;

export function isStuckSyncing(item: OutboxItem, now = Date.now()): boolean {
  if (item.status !== 'syncing') return false;
  const at = item.lastAttemptAt ? Date.parse(item.lastAttemptAt) : 0;
  return !at || now - at > STUCK_SYNC_MS;
}

export function canAutoRetryFailed(item: OutboxItem, now = Date.now()): boolean {
  if (isSettledUnreplayable(item)) return false;
  if (item.status !== 'failed') return false;
  if ((item.attempts ?? 0) >= MAX_SYNC_ATTEMPTS) return false;
  const at = item.lastAttemptAt ? Date.parse(item.lastAttemptAt) : 0;
  return !at || now - at > STUCK_SYNC_MS;
}

export function requeueStuckItems(items: OutboxItem[], now = Date.now()): OutboxItem[] {
  return items.map((item) => {
    if (isStuckSyncing(item, now) || canAutoRetryFailed(item, now)) {
      return { ...item, status: 'pending' as const, lastError: item.lastError };
    }
    return item;
  });
}

export function pendingCount(items: OutboxItem[]): number {
  return items.filter((item) => item.status === 'pending' || item.status === 'syncing').length;
}

export function conflictCount(items: OutboxItem[]): number {
  return items.filter((item) => item.status === 'failed' && !isSettledUnreplayable(item)).length;
}
