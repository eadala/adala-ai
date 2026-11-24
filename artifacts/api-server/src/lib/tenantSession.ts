/**
 * Trusted PostgreSQL session GUCs for tenant isolation (ADR-001).
 * Ordinary traffic must never rely on empty/missing app.current_tenant
 * as an implicit privilege (Migrations 056/057 historically fail-open).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Non-matching sentinel — denies under both legacy and 059 fail-closed policies. */
export const TENANT_DENY_SENTINEL = "__unscoped__";

export async function setFailClosedTenantSession(): Promise<void> {
  await db.execute(sql`
    SELECT
      set_config('app.current_tenant', ${TENANT_DENY_SENTINEL}, false),
      set_config('app.tenant_id', ${TENANT_DENY_SENTINEL}, false),
      set_config('app.bypass_rls', 'off', false)
  `);
}

export async function setOfficeTenantSession(officeId: string): Promise<void> {
  await db.execute(sql`
    SELECT
      set_config('app.current_tenant', ${officeId}, false),
      set_config('app.tenant_id', ${officeId}, false),
      set_config('app.bypass_rls', 'off', false)
  `);
}

/** Explicit privileged path — Super Admin / signed webhooks / approved system jobs. */
export async function setBypassRlsSession(): Promise<void> {
  await db.execute(sql`
    SELECT
      set_config('app.bypass_rls', 'on', false),
      set_config('app.current_tenant', ${TENANT_DENY_SENTINEL}, false),
      set_config('app.tenant_id', ${TENANT_DENY_SENTINEL}, false)
  `);
}

export async function clearTenantSessionFailClosed(): Promise<void> {
  await setFailClosedTenantSession();
}
