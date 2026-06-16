/**
 * Zero Trust — Row Level Security Migration
 * Enables RLS on all tenant-scoped tables and creates isolation policies.
 * Run once (idempotent) via: POST /api/zero-trust/apply-rls (super_admin)
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const TENANT_TABLES = [
  "cases", "clients", "contracts", "client_invoices", "documents",
  "ai_tasks", "tasks", "reminders", "case_sessions", "employees",
  "payroll", "revenues", "expenses", "bank_accounts", "cash_advances",
  "audit_logs", "login_logs", "ai_command_sessions", "storage_files",
  "org_units", "org_members", "office_messages", "message_recipients",
  "legal_documents", "document_signatures", "employee_leaves",
  "performance_evaluations", "employee_incentives",
];

function policyName(table: string) { return `zta_tenant_isolation_${table}`; }

export async function applyRLS(): Promise<{ applied: string[]; skipped: string[]; errors: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const errors:  string[] = [];

  // Check which tables exist
  const existsRes = await db.execute(sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `) as any;
  const existingTables = new Set(
    (Array.isArray(existsRes) ? existsRes : existsRes.rows ?? []).map((r: any) => r.tablename)
  );

  for (const table of TENANT_TABLES) {
    if (!existingTables.has(table)) { skipped.push(table); continue; }
    try {
      // 1. Enable RLS (idempotent)
      await db.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
      // 2. Force RLS even for table owner
      await db.execute(sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
      // 3. Drop policy if exists to recreate cleanly
      await db.execute(sql.raw(
        `DROP POLICY IF EXISTS ${policyName(table)} ON ${table}`
      ));
      // 4. Create isolation policy — reads app.current_tenant set by requireAuth
      await db.execute(sql.raw(`
        CREATE POLICY ${policyName(table)} ON ${table}
        USING (
          office_id = NULLIF(current_setting('app.current_tenant', true), '')
        )
      `));
      applied.push(table);
    } catch (e: any) {
      errors.push(`${table}: ${e.message}`);
    }
  }

  return { applied, skipped, errors };
}

export async function disableRLS(): Promise<{ disabled: string[] }> {
  const disabled: string[] = [];
  for (const table of TENANT_TABLES) {
    try {
      await db.execute(sql.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`));
      disabled.push(table);
    } catch { /* table may not exist */ }
  }
  return { disabled };
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
