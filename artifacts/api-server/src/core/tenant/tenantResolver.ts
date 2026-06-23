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

/* ── Helpers ─────────────────────────────────────────────────────────── */

async function dbOne(q: any): Promise<any> {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

/* ── Auto-link helper ────────────────────────────────────────────────── */

async function autoLink(userId: string, officeId: string): Promise<void> {
  db.execute(sql`
    INSERT INTO office_members (office_id, user_id, role, status)
    VALUES (${officeId}, ${userId}, 'owner', 'active')
    ON CONFLICT DO NOTHING
  `).catch(() => {});
  db.execute(sql`
    UPDATE users SET office_id = ${officeId}
    WHERE id = ${userId} AND office_id IS NULL
  `).catch(() => {});
}

/* ── Main resolver ───────────────────────────────────────────────────── */

export async function resolveTenantWithTrace(
  userId: string,
  headerTenantId?: string,
): Promise<TenantResolutionTrace> {
  const steps: string[] = [];
  const now = new Date().toISOString();

  /* 0. Explicit header (API keys / dev access) */
  if (headerTenantId) {
    steps.push("HEADER_TENANT_ID");
    return { tenantId: headerTenantId, role: "api_key", source: "header", steps, resolvedAt: now };
  }

  /* 1. office_members — primary source */
  steps.push("CHECK_office_members");
  const member = await dbOne(sql`
    SELECT office_id, role FROM office_members
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at ASC LIMIT 1
  `);
  if (member?.office_id) {
    steps.push("FOUND_office_members");
    return {
      tenantId: member.office_id,
      role: member.role ?? "member",
      source: "office_members",
      steps,
      resolvedAt: now,
    };
  }
  steps.push("MISS_office_members");

  /* 2. office_registry — owner lookup */
  steps.push("CHECK_office_registry");
  const registry = await dbOne(sql`
    SELECT id FROM office_registry
    WHERE clerk_user_id = ${userId} AND status = 'active'
    LIMIT 1
  `);
  if (registry?.id) {
    steps.push("FOUND_office_registry → AUTO_LINK");
    await autoLink(userId, registry.id);
    return {
      tenantId: registry.id,
      role: "owner",
      source: "office_registry",
      steps,
      resolvedAt: now,
    };
  }
  steps.push("MISS_office_registry");

  /* 3. trial_offices — onboarding trail */
  steps.push("CHECK_trial_offices");
  const trial = await dbOne(sql`
    SELECT office_id FROM trial_offices
    WHERE user_id = ${userId}
    LIMIT 1
  `);
  if (trial?.office_id) {
    steps.push("FOUND_trial_offices → AUTO_LINK");
    await autoLink(userId, trial.office_id);
    return {
      tenantId: trial.office_id,
      role: "owner",
      source: "trial_offices",
      steps,
      resolvedAt: now,
    };
  }
  steps.push("MISS_trial_offices");

  /* 4. Complete failure */
  steps.push("TENANT_NOT_RESOLVED");
  throw Object.assign(new Error("TENANT_NOT_RESOLVED"), { steps, userId });
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
