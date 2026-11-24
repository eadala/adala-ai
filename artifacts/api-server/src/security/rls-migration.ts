/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; Stage 7 orphan AI refs remediation */
/**
 * Zero Trust — Row Level Security readiness
 * Schema owned by Migration 056 (ENABLE/FORCE RLS + zta_tenant_isolation_*).
 * Readiness / verification only — no Runtime ALTER/CREATE/DROP POLICY.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const TENANT_TABLES = [
  "cases", "clients", "contracts", "client_invoices", "documents",
  "ai_tasks", "tasks", "reminders", "case_sessions", "employees",
  "payroll", "revenues", "expenses", "bank_accounts", "cash_advances",
  "audit_logs", "login_logs", "storage_files",
  "org_units", "org_members", "office_messages", "message_recipients",
  "legal_documents", "document_signatures", "employee_leaves",
  "performance_evaluations", "employee_incentives",
];

function policyName(table: string) { return `zta_tenant_isolation_${table}`; }

/** Verify Migration 056 ZTA RLS readiness (no DDL). */
export async function applyRLS(): Promise<{ applied: string[]; skipped: string[]; errors: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const errors:  string[] = [];

  const existsRes = await db.execute(sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `) as any;
  const existingTables = new Set(
    (Array.isArray(existsRes) ? existsRes : existsRes.rows ?? []).map((r: any) => r.tablename)
  );

  for (const table of TENANT_TABLES) {
    if (!existingTables.has(table)) { skipped.push(table); continue; }
    try {
      const r = await db.execute(sql`
        SELECT
          c.relrowsecurity AS rls_enabled,
          c.relforcerowsecurity AS rls_forced,
          EXISTS(
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public'
              AND p.tablename = ${table}
              AND p.policyname = ${policyName(table)}
          ) AS has_policy
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ${table}
      `) as any;
      const row = (Array.isArray(r) ? r[0] : (r?.rows ?? [])[0]) ?? {};
      if (!row.rls_enabled || !row.rls_forced || !row.has_policy) {
        errors.push(`${table}: Migration 056 RLS not ready (rls/force/policy)`);
        continue;
      }
      applied.push(table);
    } catch (e: any) {
      errors.push(`${table}: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    console.error("[rls-migration] Migration 056 schema not ready — ZTA RLS incomplete");
  }
  return { applied, skipped, errors };
}

/** Emergency disable is migration-owned; Runtime no longer issues DISABLE DDL. */
export async function disableRLS(): Promise<{ disabled: string[]; errors: string[] }> {
  return {
    disabled: [],
    errors: ["RLS disable is schema-authority owned (Migration 056) — Runtime DDL removed; use DBA/migration rollback path"],
  };
}

export async function getRLSStatus(): Promise<{
  table: string;
  rlsEnabled: boolean;
  hasPolicy: boolean;
  hasOfficeId: boolean;
}[]> {
  const r = await db.execute(sql`
    SELECT
      t.tablename                                                           AS table,
      t.rowsecurity                                                         AS rls_enabled,
      EXISTS(
        SELECT 1 FROM pg_policies p
        WHERE p.tablename = t.tablename AND p.schemaname = 'public'
          AND p.policyname LIKE 'zta_%'
      )                                                                     AS has_policy,
      EXISTS(
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_name = t.tablename AND c.table_schema = 'public'
          AND c.column_name = 'office_id'
      )                                                                     AS has_office_id
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename = ANY(${TENANT_TABLES}::text[])
    ORDER BY t.tablename
  `) as any;
  return (Array.isArray(r) ? r : r.rows ?? []).map((row: any) => ({
    table:       row.table,
    rlsEnabled:  row.rls_enabled,
    hasPolicy:   row.has_policy,
    hasOfficeId: row.has_office_id,
  }));
}
