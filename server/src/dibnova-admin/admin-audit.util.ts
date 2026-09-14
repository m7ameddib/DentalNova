const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|recovery|apikey|api[_-]?key|activationcode|gemini|private[_-]?key|jwt/i;

export function sanitizeAdminAuditDetails(input: unknown, maxLen = 500): string | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
  }
  if (typeof input !== 'object') {
    return String(input).slice(0, maxLen);
  }
  const cleaned = redactRecord(input as Record<string, unknown>);
  try {
    const json = JSON.stringify(cleaned);
    if (!json || json === '{}' || json === '[]') return null;
    return json.slice(0, maxLen);
  } catch {
    return null;
  }
}

function redactRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactRecord(item));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    if (typeof val === 'string' && SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = redactRecord(val);
  }
  return out;
}
