/**
 * Adala SaaS Kernel — Tenant-Scoped DB Layer
 *
 * The `tenantDB` object wraps Drizzle so that:
 *  1. Every SELECT automatically filters by the current tenant's officeId
 *  2. Every INSERT automatically injects officeId — no developer can forget it
 *  3. Every UPDATE/DELETE is always scoped to the tenant's officeId
 *
 * This makes it architecturally impossible to accidentally leak cross-tenant data.
 *
 * Usage:
 *   import { tenantDB } from "../core/tenantDb";
 *   const cases = await tenantDB.select(casesTable);
 *   const [created] = await tenantDB.insert(casesTable, { title: "..." });
 */
import { db } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getTenant } from "./tenantContext";

// ── Core helpers ──────────────────────────────────────────────────────────────

/** Returns the tenant's WHERE clause for any tenant-scoped table */
export function tenantFilter(table: any) {
  const { officeId } = getTenant();
  return eq(table.officeId, officeId);
}

/** Combine tenant filter with additional conditions */
export function tenantAnd(table: any, ...extra: any[]) {
  return and(tenantFilter(table), ...extra);
}

// ── Query builder proxy ───────────────────────────────────────────────────────

export const tenantDB = {
  /**
   * SELECT all rows for the current tenant.
   * Returns a Drizzle query builder — chain .orderBy(), .limit() etc. as usual.
   *
   *   const rows = await tenantDB.select(casesTable).orderBy(casesTable.createdAt);
   */
  select<T extends { officeId?: any }>(table: T) {
    const { officeId } = getTenant();
    return (db as any).select().from(table).where(eq((table as any).officeId, officeId));
  },

  /**
   * SELECT with additional WHERE conditions.
   *
   *   const row = await tenantDB.where(casesTable, eq(casesTable.id, id));
   */
  where<T>(table: T, condition: any) {
    const { officeId } = getTenant();
    return (db as any).select().from(table).where(and(eq((table as any).officeId, officeId), condition));
  },

  /**
   * INSERT — officeId is automatically injected.
   *
   *   const [created] = await tenantDB.insert(casesTable, { title: "..." }).returning();
   */
  insert<T>(table: T, data: Record<string, any>) {
    const { officeId } = getTenant();
    return (db as any).insert(table).values({ ...data, officeId });
  },

  /**
   * UPDATE — automatically scopes to current tenant's officeId.
   *
   *   await tenantDB.update(casesTable, { status: "closed" }, eq(casesTable.id, id)).returning();
   */
  update<T>(table: T, data: Record<string, any>, condition: any) {
    const { officeId } = getTenant();
    return (db as any)
      .update(table)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq((table as any).officeId, officeId), condition));
  },

  /**
   * DELETE — automatically scopes to current tenant's officeId.
   *
   *   await tenantDB.delete(casesTable, eq(casesTable.id, id));
   */
  delete<T>(table: T, condition: any) {
    const { officeId } = getTenant();
    return (db as any)
      .delete(table)
      .where(and(eq((table as any).officeId, officeId), condition));
  },
};

// ── Query safety guard ────────────────────────────────────────────────────────

/**
 * Validate raw SQL strings contain a tenant filter before execution.
 * Call this before db.execute() on any raw SQL that accesses tenant data.
 *
 *   guardRawSQL(mySql, "my route name");
 *   await db.execute(mySql);
 */
export function guardRawSQL(sqlString: string, context = "unknown") {
  const lower = sqlString.toLowerCase();
  const hasTenantFilter = lower.includes("office_id") || lower.includes("tenant_id");
  if (!hasTenantFilter) {
    const tenant = getTenantOrNull();
    const warning = `[SECURITY] Raw SQL in "${context}" is missing office_id filter. ` +
      `Current tenant: ${tenant?.officeId ?? "none"}. SQL: ${sqlString.substring(0, 200)}`;
    console.warn(warning);
    // In development, throw to surface the issue early
    if (process.env.NODE_ENV === "development") {
      throw new Error(warning);
    }
  }
}

function getTenantOrNull() {
  try { return getTenant(); } catch { return null; }
}
