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

export function isNetworkError(error: {
  response?: unknown;
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  if (error.response) return false;
  const code = error.code ?? '';
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ERR_CANCELED' ||
    /network|timeout|offline/i.test(error.message ?? '')
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
  if (status === 401 || status === 403) return 'auth';
  if (status === 404 || status === 409) return 'conflict';
  if (status >= 400 && status < 500) return 'failed';
  return 'retry';
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

  return base;
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
      for (const [key, entry] of Object.entries(next)) {
        if (key.includes(`/patients/${result.patientId}/treatments`) && Array.isArray(entry.data)) {
          writeCache(key, upsertArrayItem(entry.data, result));
        }
      }
    }

    if (path === '/payments' && result.patientId != null) {
      for (const [key, entry] of Object.entries(next)) {
        if (key.includes(`/patients/${result.patientId}/payments`) && Array.isArray(entry.data)) {
          writeCache(key, upsertArrayItem(entry.data, result));
        }
      }
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

export function pendingCount(items: OutboxItem[]): number {
  return items.filter((item) => item.status === 'pending' || item.status === 'syncing').length;
}

export function conflictCount(items: OutboxItem[]): number {
  return items.filter((item) => item.status === 'conflict' || item.status === 'failed').length;
}
