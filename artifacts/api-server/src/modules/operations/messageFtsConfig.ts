/* eslint-disable @typescript-eslint/no-explicit-any -- drizzle execute row typing */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * FTS query config is owned by the live generated expression on
 * office_messages.search_vector (migration 016). Runtime must not
 * independently prefer arabic vs simple from pg_ts_config.
 */

let cachedMessageFtsConfig: string | null = null;
let messageFtsConfigInflight: Promise<string> | null = null;

/** Extract to_tsvector('<config>', ...) literal from pg_get_expr output. */
export function parseFtsConfigFromGeneratedExpr(
  expr: string | null | undefined,
): string | null {
  if (!expr) return null;
  const match = /to_tsvector\(\s*'([^']+)'/i.exec(expr);
  return match?.[1] ?? null;
}

export function __resetMessageFtsConfigCacheForTests(): void {
  cachedMessageFtsConfig = null;
  messageFtsConfigInflight = null;
}

export function __getCachedMessageFtsConfigForTests(): string | null {
  return cachedMessageFtsConfig;
}

/**
 * Catalog read outcome used by resolveMessageFtsConfigFromCatalogResult.
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

async function readSearchVectorCatalogRow(): Promise<{
  generated: string | null;
  expr: string | null;
  columnPresent: boolean;
}> {
  const result: any = await db.execute(sql`
    SELECT
      a.attgenerated::text AS generated,
      pg_get_expr(ad.adbin, ad.adrelid) AS expr
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad
      ON ad.adrelid = a.attrelid
     AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relname = 'office_messages'
      AND a.attname = 'search_vector'
      AND NOT a.attisdropped
    LIMIT 1
  `);

  const row = result?.rows?.[0];
  if (!row) {
    return { generated: null, expr: null, columnPresent: false };
  }

  return {
    generated: row.generated ?? null,
    expr: row.expr ?? null,
    columnPresent: true,
  };
}

/**
 * Returns the text-search config that matches office_messages.search_vector.
 * Caches only successful catalog reads; transient errors fall back to simple
 * for the current attempt without poisoning the cache.
 */
export async function getMessageFtsConfig(): Promise<string> {
  if (cachedMessageFtsConfig !== null) {
    return cachedMessageFtsConfig;
  }

  if (messageFtsConfigInflight) {
    return messageFtsConfigInflight;
  }

  const inflight = (async () => {
    try {
      const row = await readSearchVectorCatalogRow();
      const resolved = resolveMessageFtsConfigFromCatalogResult({
        status: "ok",
        generated: row.generated,
        expr: row.expr,
        columnPresent: row.columnPresent,
      });
      if (resolved.cache) {
        cachedMessageFtsConfig = resolved.config;
      }
      return resolved.config;
    } catch {
      const resolved = resolveMessageFtsConfigFromCatalogResult({
        status: "transient_error",
      });
      // Intentionally do not set cachedMessageFtsConfig.
      return resolved.config;
    } finally {
      if (messageFtsConfigInflight === inflight) {
        messageFtsConfigInflight = null;
      }
    }
  })();

  messageFtsConfigInflight = inflight;
  return inflight;
}
