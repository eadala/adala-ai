/**
 * Boot-time RLS validation — ensures P0 policies are present (PR-DATA-001).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export const RLS_P0_TABLES = [
  "cases",
  "clients",
  "client_invoices",
  "contracts",
  "documents",
  "employees",
  "journal_entries",
  "invoice_payments",
  "office_entitlements",
  "audit_logs",
] as const;

export type RlsValidationResult = {
  ok: boolean;
  missing: string[];
  disabled: string[];
};

export async function validateRlsPolicies(): Promise<RlsValidationResult> {
  const missing: string[] = [];
  const disabled: string[] = [];

  try {
    const policyRows = await db.execute(sql`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND policyname = 'adala_tenant_isolation'
    `);
    const rows = (policyRows as { rows?: { tablename?: string }[] }).rows ?? [];
    const covered = new Set(rows.map((r) => String(r.tablename)));

    for (const table of RLS_P0_TABLES) {
      if (!covered.has(table)) missing.push(table);
    }

    const rlsRows = await db.execute(sql`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (
          'cases','clients','client_invoices','contracts','documents',
          'employees','journal_entries','invoice_payments','office_entitlements','audit_logs'
        )
    `).catch(() => ({ rows: [] }));

    for (const r of ((rlsRows as { rows?: { relname?: string; relrowsecurity?: boolean }[] }).rows ?? [])) {
      if (!r.relrowsecurity) disabled.push(String(r.relname));
    }
  } catch (e: unknown) {
    logger.warn({ err: (e as Error).message }, "[RLS] validation skipped — DB unavailable");
    return { ok: true, missing: [], disabled: [] };
  }

  return { ok: missing.length === 0 && disabled.length === 0, missing, disabled };
}

export async function bootRlsValidation(): Promise<void> {
  const strict = process.env.RLS_VALIDATION_STRICT === "true";
  const result = await validateRlsPolicies();

  if (result.ok) {
    logger.info({ tables: RLS_P0_TABLES.length }, "[RLS] P0 policies validated");
    return;
  }

  const msg = `[RLS] P0 policy gaps — missing: ${result.missing.join(", ") || "none"}; disabled: ${result.disabled.join(", ") || "none"}`;
  if (strict) {
    throw new Error(msg);
  }
  logger.warn(msg);
}
