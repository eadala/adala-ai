/**
 * Tenant Kernel — canonical resolution (PR-TNT-002).
 * Single source of truth for office_id resolution on authenticated requests.
 *
 * Resolution order (fail-closed):
 *   1. X-Tenant-Id header — active membership verified (or super-admin)
 *   2. Developer impersonation (audited)
 *   3. office_members — primary active membership
 *   4. office_registry — owner auto-link
 *   5. trial_offices — onboarding auto-link
 *   6. null — no implicit heal, no users.office_id fallback
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { checkIsSuperAdmin } from "../platform/superAdmin";
import { FORBIDDEN_TENANT_IDS, isRealOfficeTenantId } from "../tenantContext";
import { bindTenant } from "./tenantVersioning";
import { auditTenantResolution, type TenantResolutionTrace, type TenantSource } from "./tenantResolver";

export interface ResolvedTenantContext {
  officeId: string;
  role: string;
  source: TenantSource;
  steps: string[];
}

const CACHE = new Map<string, { officeId: string; role: string; ts: number }>();
const TTL_MS = 5 * 60 * 1000;

async function dbOne(q: ReturnType<typeof sql>): Promise<Record<string, unknown> | null> {
  try {
    const r = (await db.execute(q)) as { rows?: Record<string, unknown>[] } | Record<string, unknown>[];
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function verifyMembership(userId: string, officeId: string): Promise<boolean> {
  const row = await dbOne(sql`
    SELECT 1 AS ok FROM office_members
    WHERE user_id = ${userId} AND office_id = ${officeId} AND status = 'active'
    LIMIT 1
  `);
  return !!row;
}

async function autoLinkMember(userId: string, officeId: string, role = "owner"): Promise<void> {
  await db.execute(sql`
    INSERT INTO office_members (office_id, user_id, role, status)
    VALUES (${officeId}, ${userId}, ${role}, 'active')
    ON CONFLICT DO NOTHING
  `).catch(() => {});
}

function finish(
  userId: string,
  officeId: string,
  role: string,
  source: TenantSource,
  steps: string[],
): ResolvedTenantContext | null {
  if (!isRealOfficeTenantId(officeId) || FORBIDDEN_TENANT_IDS.has(officeId)) {
    steps.push("REJECTED_FORBIDDEN_TENANT_ID");
    return null;
  }
  CACHE.set(userId, { officeId, role, ts: Date.now() });
  bindTenant(userId, officeId, source).catch(() => {});
  return { officeId, role, source, steps };
}

/**
 * Canonical tenant resolution — returns null when no verified tenant exists.
 */
export async function resolveTenantContext(
  userId: string,
  headerTenantId?: string,
): Promise<ResolvedTenantContext | null> {
  const steps: string[] = [];

  /* 1 — explicit header (membership or SA) */
  if (headerTenantId) {
    steps.push("CHECK_HEADER");
    if (await verifyMembership(userId, headerTenantId)) {
      steps.push("HEADER_MEMBERSHIP_VERIFIED");
      return finish(userId, headerTenantId, "member", "header", steps);
    }
    if (await checkIsSuperAdmin(userId)) {
      steps.push("HEADER_SUPER_ADMIN");
      return finish(userId, headerTenantId, "super_admin", "header", steps);
    }
    steps.push("HEADER_DENIED");
  }

  /* 2 — impersonation */
  steps.push("CHECK_IMPERSONATION");
  const imp = await dbOne(sql`
    SELECT impersonated_office_id AS office_id FROM developer_impersonation
    WHERE super_admin_user_id = ${userId}
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `);
  if (imp?.office_id) {
    steps.push("FOUND_IMPERSONATION");
    return finish(userId, String(imp.office_id), "impersonator", "impersonation", steps);
  }
  steps.push("MISS_IMPERSONATION");

  /* cache */
  const cached = CACHE.get(userId);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    steps.push("CACHE_HIT");
    return finish(userId, cached.officeId, cached.role, "office_members", steps);
  }

  /* 3 — office_members */
  steps.push("CHECK_office_members");
  await db.execute(sql`
    ALTER TABLE office_members ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false
  `).catch(() => {});
  const member = await dbOne(sql`
    SELECT office_id, role FROM office_members
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY is_primary DESC NULLS LAST, created_at ASC
    LIMIT 1
  `);
  if (member?.office_id) {
    steps.push("FOUND_office_members");
    return finish(userId, String(member.office_id), String(member.role ?? "member"), "office_members", steps);
  }
  steps.push("MISS_office_members");

  /* 4 — office_registry */
  steps.push("CHECK_office_registry");
  const registry = await dbOne(sql`
    SELECT id FROM office_registry
    WHERE clerk_user_id = ${userId} AND status = 'active'
    LIMIT 1
  `);
  if (registry?.id) {
    steps.push("FOUND_office_registry_AUTO_LINK");
    await autoLinkMember(userId, String(registry.id), "firm_owner");
    return finish(userId, String(registry.id), "firm_owner", "office_registry", steps);
  }
  steps.push("MISS_office_registry");

  /* 5 — trial_offices */
  steps.push("CHECK_trial_offices");
  const trial = await dbOne(sql`
    SELECT office_id FROM trial_offices WHERE user_id = ${userId} LIMIT 1
  `);
  if (trial?.office_id) {
    steps.push("FOUND_trial_offices_AUTO_LINK");
    await autoLinkMember(userId, String(trial.office_id), "firm_owner");
    return finish(userId, String(trial.office_id), "firm_owner", "trial_offices", steps);
  }
  steps.push("MISS_trial_offices");

  steps.push("TENANT_NOT_RESOLVED");
  return null;
}

/** Resolve to office_id string (legacy API) */
export async function resolveTenantId(userId: string, headerTenantId?: string): Promise<string | null> {
  const ctx = await resolveTenantContext(userId, headerTenantId);
  return ctx?.officeId ?? null;
}

export function invalidateTenantCache(userId: string): void {
  CACHE.delete(userId);
}

/** Audit wrapper for middleware */
export function logTenantResolution(
  userId: string,
  ctx: ResolvedTenantContext | null,
  meta?: { ip?: string; userAgent?: string },
): void {
  const trace: TenantResolutionTrace | null = ctx
    ? {
        tenantId: ctx.officeId,
        role: ctx.role,
        source: ctx.source,
        steps: ctx.steps,
        resolvedAt: new Date().toISOString(),
      }
    : null;
  auditTenantResolution(userId, trace, ctx ? undefined : "TENANT_NOT_RESOLVED", meta);
}
