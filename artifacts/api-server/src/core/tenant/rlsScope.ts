/**
 * RLS session scope — explicit tenant binding for DB queries (PR-DATA-001).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runAsSystemTenant } from "./backgroundScope";

export const RLS_TENANT_KEY = "app.current_tenant" as const;
export const RLS_BYPASS_KEY = "app.bypass_rls" as const;

export async function setRlsSession(officeId: string, bypass = false): Promise<void> {
  await db.execute(sql`
    SELECT
      set_config(${RLS_TENANT_KEY}, ${officeId}, false),
      set_config('app.tenant_id', ${officeId}, false),
      set_config(${RLS_BYPASS_KEY}, ${bypass ? "true" : "false"}, false)
  `);
}

export async function clearRlsSession(): Promise<void> {
  await db.execute(sql`
    SELECT
      set_config(${RLS_TENANT_KEY}, '', false),
      set_config('app.tenant_id', '', false),
      set_config(${RLS_BYPASS_KEY}, 'false', false)
  `);
}

/** Run async work with RLS session bound to a tenant (background jobs). */
export async function withTenantRls<T>(officeId: string, fn: () => Promise<T>): Promise<T> {
  return runAsSystemTenant(officeId, async () => {
    await setRlsSession(officeId, false);
    try {
      return await fn();
    } finally {
      await clearRlsSession().catch(() => {});
    }
  });
}

/**
 * Platform-only RLS bypass — disabled in production unless ALLOW_PLATFORM_RLS_BYPASS=true.
 * Use only for audited cross-tenant platform operations (control-tower, reconciliation).
 */
export async function withPlatformRlsBypass<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  const allowed =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_PLATFORM_RLS_BYPASS === "true";
  if (!allowed) {
    throw new Error(`PLATFORM_RLS_BYPASS_DENIED: ${reason}`);
  }
  console.warn(`[RLS-BYPASS] ${reason}`);
  await db.execute(sql`SELECT set_config(${RLS_BYPASS_KEY}, 'true', false)`);
  try {
    return await fn();
  } finally {
    await db.execute(sql`SELECT set_config(${RLS_BYPASS_KEY}, 'false', false)`).catch(() => {});
  }
}

export function bindRlsFromContext(ctx: { officeId: string }): Promise<void> {
  return setRlsSession(ctx.officeId, ctx.officeId === "platform");
}
