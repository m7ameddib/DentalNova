/** Converts snake_case SQLite row keys to camelCase domain object keys. */
export function toCamel<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

export function toCamelList<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => toCamel<T>(r));
}
