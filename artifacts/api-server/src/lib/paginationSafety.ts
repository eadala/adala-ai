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

function resolveDefaultLimit(defaultLimit: number): number {
  return Number.isSafeInteger(defaultLimit) && defaultLimit >= 1 && defaultLimit <= MAX_PAGE_LIMIT
    ? defaultLimit
    : MAX_PAGE_LIMIT;
}

/**
 * Dual-mode list APIs: paginated envelope only when both page and limit are present.
 * Omitting either preserves the legacy raw-array contract for secondary consumers.
 */
export function queryHasPageAndLimit(query: { page?: unknown; limit?: unknown }): boolean {
  const pageRaw = query.page;
  const limitRaw = query.limit;
  const hasPage = pageRaw !== undefined && pageRaw !== null && String(pageRaw).trim() !== "";
  const hasLimit = limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== "";
  return hasPage && hasLimit;
}

/**
 * @param defaultLimit Endpoint-specific default when limit is omitted or invalid.
 *   Must be an integer in 1..MAX_PAGE_LIMIT.
 */
export function parseLimitOffset(
  query: { limit?: unknown; offset?: unknown },
  defaultLimit: number,
): { limit: number; offset: number } {
  const fallback = resolveDefaultLimit(defaultLimit);

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

/**
 * 1-based page + limit → safe { page, limit, offset }.
 * Invalid/missing page → 1; limit follows parseLimitOffset policy.
 */
export function parsePageLimit(
  query: { page?: unknown; limit?: unknown },
  defaultLimit: number,
): { page: number; limit: number; offset: number } {
  const { limit } = parseLimitOffset({ limit: query.limit, offset: "0" }, defaultLimit);
  let page = 1;
  const rawPage = parseWholeNonNegativeInt(query.page);
  if (rawPage !== null && rawPage >= 1) {
    page = rawPage;
  }
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Dual-mode list paging: when both page+limit are present, return safe page/limit/offset;
 * otherwise soft-cap at MAX_PAGE_LIMIT (legacy raw-array contract).
 */
export function resolveDualModePaging(
  query: { page?: unknown; limit?: unknown },
  defaultLimit = 50,
): { paginated: boolean; page: number; limit: number; offset: number } {
  const paginated = queryHasPageAndLimit(query);
  if (paginated) {
    const { page, limit, offset } = parsePageLimit(query, defaultLimit);
    return { paginated, page, limit, offset };
  }
  return { paginated: false, page: 1, limit: MAX_PAGE_LIMIT, offset: 0 };
}

/** Standard paginated list envelope. */
export function listPageEnvelope<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    data,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
  };
}

/**
 * Dual-mode array soft-cap: paginated mode uses page limit;
 * legacy array mode uses a caller-chosen soft-cap (default MAX_PAGE_LIMIT).
 * Attendance restores historical 500 via arraySoftCap=500.
 */
export function dualModeEffectiveBounds(
  paging: { paginated: boolean; limit: number; offset: number },
  arraySoftCap: number = MAX_PAGE_LIMIT,
): { limit: number; offset: number } {
  const cap =
    Number.isSafeInteger(arraySoftCap) && arraySoftCap >= 1
      ? arraySoftCap
      : MAX_PAGE_LIMIT;
  if (paging.paginated) {
    return { limit: paging.limit, offset: paging.offset };
  }
  return { limit: cap, offset: 0 };
}

/** Optional equality filter; treats missing/"all"/blank as inactive. */
export function parseOptionalEq(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v === "all") return null;
  return v;
}

/** Optional search string; blank → inactive. */
export function parseOptionalSearch(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v : null;
}

export type LedgerRow = { id: string; title: string; category: string; createdAt: string };
export type AdvanceRow = { id: string; status: string; createdAt: string };
export type StatusRow = { id: string; status: string; createdAt: string; label?: string };

/** In-memory ledger filter matching revenues/expenses SQL semantics. */
export function filterLedgerRows(
  rows: LedgerRow[],
  opts: { search?: string | null; category?: string | null },
): LedgerRow[] {
  const search = opts.search?.toLowerCase() ?? null;
  const category = opts.category ?? null;
  return rows.filter((r) => {
    if (category && r.category !== category) return false;
    if (search) {
      const hay = `${r.title} ${r.category}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export function filterByStatus<T extends { status: string }>(
  rows: T[],
  status: string | null,
): T[] {
  if (!status) return rows;
  return rows.filter((r) => r.status === status);
}

export function filterBySearchFields<T>(
  rows: T[],
  search: string | null,
  fields: (row: T) => Array<string | null | undefined>,
): T[] {
  if (!search) return rows;
  const q = search.toLowerCase();
  return rows.filter((r) =>
    fields(r).some((f) => (f ?? "").toLowerCase().includes(q)),
  );
}

/**
 * Deterministic sort: primary createdAt DESC, id DESC tie-breaker.
 * Mirrors SQL `ORDER BY created_at DESC, id DESC`.
 */
export function sortCreatedAtDescIdDesc<T extends { id: string; createdAt: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (tb !== ta) return tb - ta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/**
 * Apply the same filtered dataset to COUNT (total) and page slice —
 * the contract dual-mode list endpoints must satisfy.
 */
export function paginateFilteredDataset<T>(
  filteredSorted: T[],
  query: { page?: unknown; limit?: unknown },
  defaultLimit = 50,
) {
  const paging = resolveDualModePaging(query, defaultLimit);
  const total = filteredSorted.length;
  if (!paging.paginated) {
    const { limit } = dualModeEffectiveBounds(paging);
    return {
      mode: "array" as const,
      data: filteredSorted.slice(0, limit),
      total,
      paging,
    };
  }
  const data = filteredSorted.slice(paging.offset, paging.offset + paging.limit);
  return {
    mode: "envelope" as const,
    ...listPageEnvelope(data, total, paging.page, paging.limit),
    paging,
  };
}

