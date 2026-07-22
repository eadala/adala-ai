/**
 * Pure FTS config helpers (no DB import).
 * Source of truth at runtime remains the live generated expression;
 * these helpers parse / resolve catalog outcomes only.
 */

/** Extract to_tsvector('<config>', ...) literal from pg_get_expr output. */
export function parseFtsConfigFromGeneratedExpr(
  expr: string | null | undefined,
): string | null {
  if (!expr) return null;
  const match = /to_tsvector\(\s*'([^']+)'/i.exec(expr);
  return match?.[1] ?? null;
}

/**
 * Catalog read outcome used by getMessageFtsConfig.
 * Transient failures must not permanently cache the request-scoped fallback.
 */
export function resolveMessageFtsConfigFromCatalogResult(input: {
  status: "ok";
  generated: string | null;
  expr: string | null;
  columnPresent: boolean;
} | {
  status: "transient_error";
}): { config: string; cache: boolean } {
  if (input.status === "transient_error") {
    return { config: "simple", cache: false };
  }

  if (!input.columnPresent) {
    return { config: "simple", cache: true };
  }

  const isGenerated = input.generated === "s" || input.generated === "v";
  if (isGenerated) {
    const parsed = parseFtsConfigFromGeneratedExpr(input.expr);
    if (parsed) {
      return { config: parsed, cache: true };
    }
  }

  // Column exists but expression is absent/unreadable — definitive catalog read.
  return { config: "simple", cache: true };
}
