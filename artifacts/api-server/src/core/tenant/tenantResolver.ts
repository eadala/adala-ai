/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; schema authority */
/**
 * Tenant Identity Resolution Engine (TIRE v2) — Stage 15.2b
 * ─────────────────────────────────────────────
 * Deterministic — every normal user maps to exactly ONE UUID tenant.
 * Legacy trial_* fail closed. HEAL uses canonical provisionOfficeForUser.
 *
 * Resolution order:
 *   1. office_members   (UUID only)
 *   2. office_registry  (UUID only → await auto-link)
 *   3. trial_offices    (UUID only; legacy trial_* → fail closed)
 *   4. onboarding heal  (await provisionOfficeForUser)
 *   5. FAIL → throw TENANT_NOT_RESOLVED
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { provisionOfficeForUser, OfficeProvisionError } from "../../lib/officeProvision";
import {
  LEGACY_NON_UUID_TENANT,
  PLATFORM_FORBIDDEN_FOR_USER,
  TENANT_PROVISION_FAILED,
  TenantResolutionError,
  acceptNormalUserTenantId,
} from "../../lib/tenantResolution";
import { isUuid } from "../../lib/officePageResolverLogic";

/* ── Types ──────────────────────────────────────────────────────────── */

export type TenantSource =
  | "office_members"
  | "office_registry"
  | "trial_offices"
  | "impersonation"
  | "header"
  | "heal_provision";

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

/* ── Auto-link helper (UUID only, awaited) ───────────────────────────── */

async function autoLink(userId: string, officeId: string): Promise<void> {
  if (!isUuid(officeId)) return;
  await db.execute(sql`
    INSERT INTO office_members (office_id, user_id, role, status)
    VALUES (${officeId}, ${userId}, 'owner', 'active')
    ON CONFLICT (office_id, user_id) DO NOTHING
  `);
  await db.execute(sql`
    UPDATE users SET office_id = ${officeId}
    WHERE id = ${userId} AND (office_id IS NULL OR office_id = 'default')
  `);
}

/* ── Main resolver ───────────────────────────────────────────────────── */

export async function resolveTenantWithTrace(
  userId: string,
  headerTenantId?: string,
): Promise<TenantResolutionTrace> {
  const steps: string[] = [];
  const now = new Date().toISOString();

  /* 0. Explicit header (API keys / dev access) — membership checked by caller paths;
     here we still reject legacy trial_* for normal resolution consistency. */
  if (headerTenantId) {
    steps.push("HEADER_TENANT_ID");
    const accepted = acceptNormalUserTenantId(headerTenantId, {
      userId,
      source: "header",
    });
    if (!accepted) {
      steps.push("HEADER_EMPTY_OR_DEFAULT");
    } else {
      const t: TenantResolutionTrace = {
        tenantId: accepted,
        role: "api_key",
        source: "header",
        steps,
        resolvedAt: now,
      };
      import("./tenantVersioning").then(m => m.bindTenant(userId, accepted, "header")).catch(() => {});
      return t;
    }
  }

  /* 1. office_members — primary source */
  steps.push("CHECK_office_members");
  const member = await dbOne(sql`
    SELECT office_id, role FROM office_members
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at ASC LIMIT 1
  `);
  if (member?.office_id) {
    const accepted = acceptNormalUserTenantId(String(member.office_id), {
      userId,
      source: "office_members",
    });
    if (accepted) {
      steps.push("FOUND_office_members");
      const t: TenantResolutionTrace = {
        tenantId: accepted,
        role: member.role ?? "member",
        source: "office_members",
        steps,
        resolvedAt: now,
      };
      import("./tenantVersioning").then(m => m.bindTenant(userId, accepted, "office_members")).catch(() => {});
      return t;
    }
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
    const accepted = acceptNormalUserTenantId(String(registry.id), {
      userId,
      source: "office_registry",
    });
    if (accepted) {
      steps.push("FOUND_office_registry → AUTO_LINK");
      await autoLink(userId, accepted);
      const t: TenantResolutionTrace = {
        tenantId: accepted,
        role: "owner",
        source: "office_registry",
        steps,
        resolvedAt: now,
      };
      import("./tenantVersioning").then(m => m.bindTenant(userId, accepted, "office_registry")).catch(() => {});
      return t;
    }
  }
  steps.push("MISS_office_registry");

  /* 3. trial_offices — UUID lifecycle only */
  steps.push("CHECK_trial_offices");
  const trial = await dbOne(sql`
    SELECT office_id FROM trial_offices
    WHERE user_id = ${userId}
    LIMIT 1
  `);
  if (trial?.office_id) {
    const accepted = acceptNormalUserTenantId(String(trial.office_id), {
      userId,
      source: "trial_offices",
    });
    if (accepted) {
      steps.push("FOUND_trial_offices → AUTO_LINK");
      await autoLink(userId, accepted);
      const t: TenantResolutionTrace = {
        tenantId: accepted,
        role: "owner",
        source: "trial_offices",
        steps,
        resolvedAt: now,
      };
      import("./tenantVersioning").then(m => m.bindTenant(userId, accepted, "trial_offices")).catch(() => {});
      return t;
    }
  }
  steps.push("MISS_trial_offices");

  /* 4. HEAL — completed onboarding without canonical office */
  steps.push("CHECK_onboarding_heal");
  const onboard = await dbOne(sql`
    SELECT data FROM onboarding_state
    WHERE user_id = ${userId} AND completed = true
    LIMIT 1
  `);
  if (onboard) {
    if (userId === "platform") {
      throw new TenantResolutionError(
        PLATFORM_FORBIDDEN_FOR_USER,
        "Refusing HEAL provision for platform context",
        { userId, source: "heal_provision" },
      );
    }
    steps.push("HEAL_PROVISION_AWAIT");
    let officeName = "مكتب المحاماة";
    try {
      const data = onboard.data;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed && typeof parsed === "object" && (parsed as any).officeName) {
        officeName = String((parsed as any).officeName);
      }
    } catch { /* default name */ }

    try {
      const result = await provisionOfficeForUser({
        ownerUserId: userId,
        officeName,
        plan: "trial",
        lifecycle: "trial",
        context: "onboarding_state",
        writeTrialOffices: true,
        onboarding: { completed: true, step: 10, data: {} },
      });
      if (!isUuid(result.officeId)) {
        throw new TenantResolutionError(
          TENANT_PROVISION_FAILED,
          "HEAL provision returned non-UUID office id",
          { userId, officeId: result.officeId },
        );
      }
      steps.push("FOUND_heal_provision");
      const t: TenantResolutionTrace = {
        tenantId: result.officeId,
        role: "owner",
        source: "heal_provision",
        steps,
        resolvedAt: now,
      };
      import("./tenantVersioning").then(m => m.bindTenant(userId, result.officeId, "office_members")).catch(() => {});
      return t;
    } catch (err: unknown) {
      if (err instanceof TenantResolutionError) throw err;
      if (err instanceof OfficeProvisionError && err.code === "LEGACY_NON_UUID") {
        throw new TenantResolutionError(
          LEGACY_NON_UUID_TENANT,
          err.message,
          {
            userId,
            source: "heal_provision",
            needsMigration: true,
            migrationStage: "15.2c",
            provisionCode: err.code,
          },
        );
      }
      throw err;
    }
  }
  steps.push("MISS_onboarding_heal");

  /* 5. Complete failure */
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
