/**
 * Tenant Identity Resolution Engine (TIRE v2)
 * ─────────────────────────────────────────────
 * Deterministic — every user maps to exactly ONE tenant.
 * No guessing. No silent fallbacks. Full audit trail.
 *
 * Resolution order:
 *   1. office_members   (primary — fast path after first visit)
 *   2. office_registry  (owner lookup by clerk_user_id)
 *   3. trial_offices    (onboarding trail — auto-links to office_members)
 *   4. FAIL → throw TENANT_NOT_RESOLVED
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resolveTenantContext } from "./tenantKernel";

/* ── Types ──────────────────────────────────────────────────────────── */

export type TenantSource =
  | "office_members"
  | "office_registry"
  | "trial_offices"
  | "impersonation"
  | "header";

export interface TenantResolutionTrace {
  tenantId: string;
  role: string;
  source: TenantSource;
  steps: string[];
  resolvedAt: string;
}

/* ── Main resolver — delegates to tenantKernel (PR-TNT-002) ─────────── */

export async function resolveTenantWithTrace(
  userId: string,
  headerTenantId?: string,
): Promise<TenantResolutionTrace> {
  const ctx = await resolveTenantContext(userId, headerTenantId);
  if (!ctx) {
    const steps = ["TENANT_NOT_RESOLVED"];
    throw Object.assign(new Error("TENANT_NOT_RESOLVED"), { steps, userId });
  }
  return {
    tenantId: ctx.officeId,
    role: ctx.role,
    source: ctx.source,
    steps: ctx.steps,
    resolvedAt: new Date().toISOString(),
  };
}

/* ── Audit logging (non-blocking) ───────────────────────────────────── */

export function auditTenantResolution(
  userId: string,
  trace: TenantResolutionTrace | null,
  error?: string,
  meta?: { ip?: string; userAgent?: string },
): void {
  db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_audit_logs (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id     TEXT NOT NULL,
      tenant_id   TEXT,
      source      TEXT NOT NULL,
      steps       JSONB NOT NULL DEFAULT '[]',
      resolved    BOOLEAN NOT NULL DEFAULT false,
      error_msg   TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() =>
    db.execute(sql`
      INSERT INTO tenant_audit_logs
        (user_id, tenant_id, source, steps, resolved, error_msg, ip_address, user_agent)
      VALUES (
        ${userId},
        ${trace?.tenantId ?? null},
        ${trace?.source ?? "none"},
        ${JSON.stringify(trace?.steps ?? [error ?? "UNKNOWN"])}::jsonb,
        ${trace != null},
        ${error ?? null},
        ${meta?.ip ?? null},
        ${meta?.userAgent?.slice(0, 200) ?? null}
      )
    `)
  ).catch(() => {});
}
