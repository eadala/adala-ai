/**
 * Safe limit/offset parsing for already-paginated list endpoints.
 * Preserves endpoint-specific defaults; clamps limit to MAX_PAGE_LIMIT.
 */

export const MAX_PAGE_LIMIT = 200;

/** Whole non-negative decimal digits only (rejects "-", ".", "1e2", blanks). */
function parseWholeNonNegativeInt(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "" || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n;
}

/**
 * @param defaultLimit Endpoint-specific default when limit is omitted or invalid.
 *   Must be an integer in 1..MAX_PAGE_LIMIT.
 */
export function parseLimitOffset(
  query: { limit?: unknown; offset?: unknown },
  defaultLimit: number,
): { limit: number; offset: number } {
  const fallback =
    Number.isSafeInteger(defaultLimit) && defaultLimit >= 1 && defaultLimit <= MAX_PAGE_LIMIT
      ? defaultLimit
      : MAX_PAGE_LIMIT;

  let limit = fallback;
  const rawLimit = parseWholeNonNegativeInt(query.limit);
  if (rawLimit !== null) {
    if (rawLimit === 0) {
      limit = fallback;
    } else if (rawLimit > MAX_PAGE_LIMIT) {
      limit = MAX_PAGE_LIMIT;
    } else {
      limit = rawLimit;
    }
  }

  let offset = 0;
  const rawOffset = parseWholeNonNegativeInt(query.offset);
  if (rawOffset !== null) {
    offset = rawOffset;
  }

  return { limit, offset };
}
