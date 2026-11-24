/* eslint-disable @typescript-eslint/no-explicit-any -- drizzle execute row typing */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  isAllowedMessageFtsConfig,
  resolveMessageFtsConfigFromCatalogResult,
  type MessageFtsAllowedConfig,
  type MessageFtsResolveResult,
} from "./messageFtsConfigLogic";

export {
  isAllowedMessageFtsConfig,
  MESSAGE_FTS_ALLOWED_CONFIGS,
  parseFtsConfigFromGeneratedExpr,
  resolveMessageFtsConfigFromCatalogResult,
} from "./messageFtsConfigLogic";

/**
 * FTS query config is owned by the live generated expression on
 * office_messages.search_vector (migration 016). Runtime must not
 * independently prefer arabic vs simple from the text-search catalog,
 * and must never pass non-allow-listed values to ::regconfig.
 *
 * Stage 20.2 — only authoritative allow-listed discoveries are cached.
 * Absent / unreadable / unsupported / transient states return null
 * (caller skips FTS) without poisoning the process cache.
 */

export type SearchVectorCatalogRow = {
  generated: string | null;
  expr: string | null;
  columnPresent: boolean;
};

type CatalogReader = () => Promise<SearchVectorCatalogRow>;

let cachedMessageFtsConfig: MessageFtsAllowedConfig | null = null;
let messageFtsConfigInflight: Promise<MessageFtsAllowedConfig | null> | null = null;
let catalogReaderOverride: CatalogReader | null = null;

export function __resetMessageFtsConfigCacheForTests(): void {
  cachedMessageFtsConfig = null;
  messageFtsConfigInflight = null;
}

export function __getCachedMessageFtsConfigForTests(): string | null {
  return cachedMessageFtsConfig;
}

export function __setMessageFtsCatalogReaderForTests(
  reader: CatalogReader | null,
): void {
  catalogReaderOverride = reader;
}

async function readSearchVectorCatalogRow(): Promise<SearchVectorCatalogRow> {
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

function logFtsConfigOps(resolved: MessageFtsResolveResult): void {
  if (
    resolved.reason !== "unsupported_config" &&
    resolved.reason !== "parse_failure" &&
    resolved.reason !== "not_generated"
  ) {
    return;
  }
  /* Structured ops metadata only — never search terms / message bodies / secrets. */
  console.warn(
    JSON.stringify({
      component: "messageFtsConfig",
      event: "fts_config_not_usable",
      reason: resolved.reason,
      rejectedConfig: resolved.rejectedConfig ?? null,
      cache: resolved.cache,
    }),
  );
}

/**
 * Returns the allow-listed text-search config that matches
 * office_messages.search_vector, or null when FTS must be skipped.
 * Caches only successful authoritative allow-listed catalog reads.
 */
export async function getMessageFtsConfig(): Promise<MessageFtsAllowedConfig | null> {
  if (cachedMessageFtsConfig !== null) {
    return cachedMessageFtsConfig;
  }

  if (messageFtsConfigInflight) {
    return messageFtsConfigInflight;
  }

  let settleInflight: Promise<MessageFtsAllowedConfig | null> | null = null;
  settleInflight = (async () => {
    try {
      const reader = catalogReaderOverride ?? readSearchVectorCatalogRow;
      const row = await reader();
      const resolved = resolveMessageFtsConfigFromCatalogResult({
        status: "ok",
        generated: row.generated,
        expr: row.expr,
        columnPresent: row.columnPresent,
      });
      logFtsConfigOps(resolved);
      if (resolved.cache && resolved.config && isAllowedMessageFtsConfig(resolved.config)) {
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
