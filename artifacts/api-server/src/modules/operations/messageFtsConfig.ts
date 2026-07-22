/* eslint-disable @typescript-eslint/no-explicit-any -- drizzle execute row typing */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resolveMessageFtsConfigFromCatalogResult } from "./messageFtsConfigLogic";

export {
  parseFtsConfigFromGeneratedExpr,
  resolveMessageFtsConfigFromCatalogResult,
} from "./messageFtsConfigLogic";

/**
 * FTS query config is owned by the live generated expression on
 * office_messages.search_vector (migration 016). Runtime must not
 * independently prefer arabic vs simple from the text-search catalog.
 */

let cachedMessageFtsConfig: string | null = null;
let messageFtsConfigInflight: Promise<string> | null = null;

export function __resetMessageFtsConfigCacheForTests(): void {
  cachedMessageFtsConfig = null;
  messageFtsConfigInflight = null;
}

export function __getCachedMessageFtsConfigForTests(): string | null {
  return cachedMessageFtsConfig;
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

  const row = ((result as any)?.rows ?? result)?.[0];
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

  let settleInflight: Promise<string> | null = null;
  settleInflight = (async () => {
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
      if (messageFtsConfigInflight === settleInflight) {
        messageFtsConfigInflight = null;
      }
    }
  })();

  messageFtsConfigInflight = settleInflight;
  return settleInflight;
}
