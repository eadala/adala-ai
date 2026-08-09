/**
 * Pure FTS config helpers (no DB import).
 * Source of truth at runtime remains the live generated expression;
 * these helpers parse / resolve catalog outcomes only.
 *
 * Stage 20.2 — allow-list + no permanent cache of fallback/not-ready states.
 */

/** Configs permitted for office_messages plainto_tsquery(::regconfig). */
export const MESSAGE_FTS_ALLOWED_CONFIGS = ["arabic", "simple"] as const;
export type MessageFtsAllowedConfig = (typeof MESSAGE_FTS_ALLOWED_CONFIGS)[number];

const ALLOWED = new Set<string>(MESSAGE_FTS_ALLOWED_CONFIGS);

export function isAllowedMessageFtsConfig(
  config: string | null | undefined,
): config is MessageFtsAllowedConfig {
  return typeof config === "string" && ALLOWED.has(config);
}

/** Extract to_tsvector('<config>', ...) literal from pg_get_expr output. */
export function parseFtsConfigFromGeneratedExpr(
  expr: string | null | undefined,
): string | null {
  if (!expr) return null;
  const match = /to_tsvector\(\s*'([^']+)'/i.exec(expr);
  return match?.[1] ?? null;
}

export type MessageFtsResolveReason =
  | "authoritative"
  | "column_absent"
  | "not_generated"
  | "parse_failure"
  | "unsupported_config"
  | "transient_error";

export type MessageFtsResolveResult = {
  /** Allow-listed config for ::regconfig, or null to skip FTS safely. */
  config: MessageFtsAllowedConfig | null;
  /** Only authoritative allow-listed discoveries may be process-cached. */
  cache: boolean;
  reason: MessageFtsResolveReason;
  /** Parsed catalog literal when rejected as unsupported (ops metadata only). */
  rejectedConfig?: string;
};

/**
 * Catalog read outcome used by getMessageFtsConfig.
 * Non-authoritative outcomes must not permanently cache a fallback config.
 */
export function resolveMessageFtsConfigFromCatalogResult(input: {
  status: "ok";
  generated: string | null;
  expr: string | null;
  columnPresent: boolean;
} | {
  status: "transient_error";
}): MessageFtsResolveResult {
  if (input.status === "transient_error") {
    return { config: null, cache: false, reason: "transient_error" };
  }

  if (!input.columnPresent) {
    return { config: null, cache: false, reason: "column_absent" };
  }

  const isGenerated = input.generated === "s" || input.generated === "v";
  if (!isGenerated) {
    return { config: null, cache: false, reason: "not_generated" };
  }

  const parsed = parseFtsConfigFromGeneratedExpr(input.expr);
  if (!parsed) {
    return { config: null, cache: false, reason: "parse_failure" };
  }

  if (!isAllowedMessageFtsConfig(parsed)) {
    return {
      config: null,
      cache: false,
      reason: "unsupported_config",
      rejectedConfig: parsed,
    };
  }

  return { config: parsed, cache: true, reason: "authoritative" };
}
