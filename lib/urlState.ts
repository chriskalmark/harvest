export type QueryValue = string | number | boolean | null | undefined;

function coerceToString(value: QueryValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

/**
 * Returns a NEW query string (no leading '?') with updates applied.
 * - `null`/`undefined` removes the key
 * - otherwise sets the key to the coerced string value
 */
export function mergeQueryString(
  currentQueryString: string,
  updates: Record<string, QueryValue>
): string {
  const params = new URLSearchParams(currentQueryString);
  for (const [key, value] of Object.entries(updates)) {
    const next = coerceToString(value);
    if (next === null || next.length === 0) {
      params.delete(key);
    } else {
      params.set(key, next);
    }
  }
  return params.toString();
}

export function buildHref(
  pathname: string,
  currentQueryString: string,
  updates: Record<string, QueryValue> = {}
): string {
  const query = mergeQueryString(currentQueryString, updates);
  return query ? `${pathname}?${query}` : pathname;
}

