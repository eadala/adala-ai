/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Tenant Middleware — Multi-Tenant Resolution (Stage 15.2b)
 *
 * Resolves the current office (tenant) from the authenticated Clerk userId.
 * Normal users resolve only to canonical UUID offices (or fail closed).
 * HEAL-7 awaits provisionOfficeForUser — never mints trial_*.
 *
 * Strategy (in order):
 *   1. x-tenant-id header (membership-validated; SA may target any office)
 *   1b. developer impersonation
 *   2. in-memory cache (UUID only)
 *   3. office_members
 *   4. users.office_id
 *   5. office_registry (await membership link for UUID)
 *   6. trial_offices (UUID only; legacy trial_* → fail closed)
 *   7. onboarding completed → await canonical provision (HEAL-7)
 *
 * Sets req.tenantId on success; returns 401/403/409 on failure.
 */
import type { Request, Response, NextFunction } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { sql } from "drizzle-orm";
import {
  OfficeProvisionError,
  provisionOfficeForUser,
  type ProvisionOfficeForUserResult,
} from "../lib/officeProvision";
import {
  LEGACY_NON_UUID_TENANT,
  PLATFORM_FORBIDDEN_FOR_USER,
  TENANT_PROVISION_FAILED,
  TenantResolutionError,
  acceptNormalUserTenantId,
  isCacheableTenantId,
} from "../lib/tenantResolution";
import { isUuid } from "../lib/officePageResolverLogic";

async function defaultDb(): Promise<DbLike> {
  const { db } = await import("@workspace/db");
  return db as unknown as DbLike;
}

let _saClerk2: ReturnType<typeof createClerkClient> | null = null;
async function isSuperAdminUser(userId: string): Promise<boolean> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_OWNER_EMAIL ?? "";
  const saEmails = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!saEmails.length) return false;
  try {
    if (!_saClerk2) _saClerk2 = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    const user = await _saClerk2.users.getUser(userId);
    const email = (user.emailAddresses[0]?.emailAddress ?? "").toLowerCase();
    return saEmails.includes(email) || user.publicMetadata?.role === "super_admin";
  } catch { return false; }
}

/* Simple in-memory cache: userId → officeId (TTL 5 min) — UUID only */
const CACHE = new Map<string, { officeId: string; ts: number }>();
const TTL_MS = 5 * 60 * 1000;

/** Coalesce concurrent HEAL-7 provisions for the same user */
const HEAL_INFLIGHT = new Map<string, Promise<string>>();

type DbLike = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export type ResolveTenantDeps = {
  db?: DbLike;
  provision?: (input: Parameters<typeof provisionOfficeForUser>[0]) => Promise<ProvisionOfficeForUserResult>;
  isSuperAdmin?: (userId: string) => Promise<boolean>;
  cache?: Map<string, { officeId: string; ts: number }>;
  healInflight?: Map<string, Promise<string>>;
  now?: () => number;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

function firstVal(result: unknown, key: string): string | undefined {
  const row = rowsOf(result)[0];
  if (!row || row[key] == null) return undefined;
  return String(row[key]);
}

function cacheSet(
  cache: Map<string, { officeId: string; ts: number }>,
  userId: string,
  officeId: string,
  now: number,
): void {
  if (!isCacheableTenantId(officeId)) return;
  cache.set(userId, { officeId, ts: now });
}

async function awaitLinkMembership(client: DbLike, userId: string, officeId: string): Promise<void> {
  if (!isUuid(officeId)) return;
  await client.execute(sql`
    INSERT INTO office_members (office_id, user_id, role, status)
    VALUES (${officeId}, ${userId}, 'owner', 'active')
    ON CONFLICT (office_id, user_id) DO NOTHING
  `);
  await client.execute(sql`
    UPDATE users SET office_id = ${officeId}
    WHERE id = ${userId} AND (office_id IS NULL OR office_id = 'default')
  `);
}

async function healProvisionOffice(
  userId: string,
  deps: Required<Pick<ResolveTenantDeps, "provision" | "healInflight">> & {
    officeName?: string;
  },
): Promise<string> {
  const existing = deps.healInflight.get(userId);
  if (existing) return existing;

  /* Register the in-flight promise synchronously so concurrent resolvers coalesce */
  let settle!: (officeId: string) => void;
  let fail!: (err: unknown) => void;
  const gate = new Promise<string>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  deps.healInflight.set(userId, gate);

  void (async () => {
    try {
      const result = await deps.provision({
        ownerUserId: userId,
        officeName: deps.officeName?.trim() || "مكتب المحاماة",
        plan: "trial",
        lifecycle: "trial",
        context: "onboarding_state",
        writeTrialOffices: true,
        onboarding: { completed: true, step: 10, data: {} },
      });
      if (!isUuid(result.officeId)) {
        throw new TenantResolutionError(
          TENANT_PROVISION_FAILED,
          "HEAL-7 provision returned a non-UUID office id",
          { userId, officeId: result.officeId },
        );
      }
      settle(result.officeId);
    } catch (err: unknown) {
      if (err instanceof TenantResolutionError) {
        fail(err);
        return;
      }
      if (err instanceof OfficeProvisionError) {
        if (err.code === "LEGACY_NON_UUID") {
          fail(new TenantResolutionError(
            LEGACY_NON_UUID_TENANT,
            err.message,
            {
              userId,
              source: "TENANT-HEAL-7",
              needsMigration: true,
              migrationStage: "15.2c",
              provisionCode: err.code,
            },
          ));
          return;
        }
        fail(new TenantResolutionError(
          TENANT_PROVISION_FAILED,
          err.message,
          { userId, source: "TENANT-HEAL-7", provisionCode: err.code },
        ));
        return;
      }
      fail(err);
    } finally {
      deps.healInflight.delete(userId);
    }
  })();

  return gate;
}

export async function resolveTenantId(
  userId: string,
  headerTenantId?: string,
  deps?: ResolveTenantDeps,
): Promise<string | null> {
  const client = deps?.db ?? (await defaultDb());
  const cache = deps?.cache ?? CACHE;
  const healInflight = deps?.healInflight ?? HEAL_INFLIGHT;
  const nowFn = deps?.now ?? Date.now;
  const checkSA = deps?.isSuperAdmin ?? isSuperAdminUser;
  const provision = deps?.provision ?? ((input) => provisionOfficeForUser(input));

  /* 1. Explicit header — membership-validated; SA may target any office UUID */
  if (headerTenantId) {
    try {
      const memberCheck = await client.execute(sql`
        SELECT 1 FROM office_members
        WHERE user_id = ${userId} AND office_id = ${headerTenantId} AND status = 'active'
        LIMIT 1
      `);
      const isMember = rowsOf(memberCheck).length > 0;
      if (isMember) {
        return acceptNormalUserTenantId(headerTenantId, {
          userId,
          source: "header_membership",
        });
      }

      const isSA = await checkSA(userId);
      if (isSA) {
        /* SA may inspect a specific office via header; never treat as normal-user cache */
        return headerTenantId;
      }
    } catch (err) {
      if (err instanceof TenantResolutionError) throw err;
      /* Header validation DB blip — fall through */
    }
  }

  /* 1b. Developer impersonation — SA viewing as another office */
  try {
    const imp = await client.execute(sql`
      SELECT impersonated_office_id FROM developer_impersonation
      WHERE super_admin_user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);
    const impOffice = firstVal(imp, "impersonated_office_id");
    if (impOffice) {
      /* Impersonation is SA-only; return target as-is without normal-user cache */
      return impOffice;
    }
  } catch { /* optional table */ }

  /* 2. Cache — UUID only */
  const cached = cache.get(userId);
  if (cached && nowFn() - cached.ts < TTL_MS) {
    if (isCacheableTenantId(cached.officeId)) return cached.officeId;
    cache.delete(userId);
  }

  /* 3. office_members */
  const memberRows = await client.execute(sql`
    SELECT office_id FROM office_members
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1
  `);
  const memberId = firstVal(memberRows, "office_id");
  if (memberId) {
    const accepted = acceptNormalUserTenantId(memberId, {
      userId,
      source: "office_members",
    });
    if (accepted) {
      cacheSet(cache, userId, accepted, nowFn());
      return accepted;
    }
  }

  /* 4. users.office_id */
  const userRows = await client.execute(sql`
    SELECT office_id FROM users WHERE id = ${userId} LIMIT 1
  `);
  const userOffice = firstVal(userRows, "office_id");
  if (userOffice) {
    const accepted = acceptNormalUserTenantId(userOffice, {
      userId,
      source: "users.office_id",
    });
    if (accepted) {
      cacheSet(cache, userId, accepted, nowFn());
      return accepted;
    }
  }

  /* 5. office_registry — owner lookup */
  const regRows = await client.execute(sql`
    SELECT id FROM office_registry
    WHERE clerk_user_id = ${userId} AND status = 'active'
    LIMIT 1
  `);
  const regOffice = firstVal(regRows, "id");
  if (regOffice) {
    const accepted = acceptNormalUserTenantId(regOffice, {
      userId,
      source: "office_registry",
    });
    if (accepted) {
      await awaitLinkMembership(client, userId, accepted);
      cacheSet(cache, userId, accepted, nowFn());
      return accepted;
    }
  }

  /* 6. trial_offices — UUID lifecycle only; legacy trial_* fail closed */
  const trialRows = await client.execute(sql`
    SELECT office_id FROM trial_offices
    WHERE user_id = ${userId}
    LIMIT 1
  `);
  const trialOffice = firstVal(trialRows, "office_id");
  if (trialOffice) {
    const accepted = acceptNormalUserTenantId(trialOffice, {
      userId,
      source: "trial_offices",
    });
    if (accepted) {
      await awaitLinkMembership(client, userId, accepted);
      cacheSet(cache, userId, accepted, nowFn());
      return accepted;
    }
  }

  /* 7. TENANT-HEAL-7 — completed onboarding, no canonical office → await provision */
  const onboardRows = await client.execute(sql`
    SELECT office_id, data FROM onboarding_state
    WHERE user_id = ${userId} AND completed = true
    LIMIT 1
  `);
  const onboard = rowsOf(onboardRows)[0];
  if (onboard) {
    /* Never provision for synthetic platform context */
    if (userId === "platform") {
      throw new TenantResolutionError(
        PLATFORM_FORBIDDEN_FOR_USER,
        "Refusing HEAL-7 provision for platform context",
        { userId, source: "TENANT-HEAL-7" },
      );
    }

    let officeName = "مكتب المحاماة";
    try {
      const data = onboard.data;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed && typeof parsed === "object" && parsed !== null && "officeName" in parsed) {
        const name = (parsed as { officeName?: unknown }).officeName;
        if (typeof name === "string" && name.trim()) officeName = name;
      }
    } catch { /* keep default name */ }

    console.warn(`[TENANT-HEAL-7] Awaiting canonical provision for onboarded user ${userId}`);
    const officeId = await healProvisionOffice(userId, {
      provision,
      healInflight,
      officeName,
    });
    cacheSet(cache, userId, officeId, nowFn());
    return officeId;
  }

  console.warn(
    `[TENANT-403] userId=${userId} headerTenant=${headerTenantId ?? "none"} ` +
    `→ all 7 resolution steps failed — no office found`,
  );
  return null;
}

/** Invalidate cache for a user (call after membership changes) */
export function invalidateTenantCache(userId: string) {
  CACHE.delete(userId);
}

/**
 * Express middleware — attaches req.tenantId
 * Use AFTER requireAuth so req.userId is already set.
 */
export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });

  const headerTenant = req.headers["x-tenant-id"] as string | undefined;
  try {
    const tenantId = await resolveTenantId(userId, headerTenant);
    if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب المرتبط بهذا الحساب" });
    (req as any).tenantId = tenantId;
    next();
  } catch (err: any) {
    if (err instanceof TenantResolutionError && err.code === LEGACY_NON_UUID_TENANT) {
      return res.status(409).json({
        error: "حسابك يستخدم معرّف مكتب قديم ويتطلب ترحيل البيانات",
        code: err.code,
        ...err.details,
      });
    }
    if (err instanceof TenantResolutionError) {
      return res.status(403).json({
        error: err.message,
        code: err.code,
        ...err.details,
      });
    }
    console.error(`[TENANT-ERR] userId=${userId} resolveTenantId threw: ${err?.message ?? err}`);
    return res.status(403).json({ error: "خطأ في تحديد المكتب — حاول مجدداً." });
  }
}

/**
 * requireAuthWithTenantAudit — auth + tenant resolution with a non-blocking
 * tenant_audit_logs entry via TIRE. Use on sensitive endpoints that need a
 * full audit trail.
 */
export async function requireAuthWithTenantAudit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
  (req as any).userId = userId;

  const headerTenant = req.headers["x-tenant-id"] as string | undefined;
  const ip = (req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? "";
  const ua = req.headers["user-agent"] ?? "";

  const { auditTenantResolution, resolveTenantWithTrace } = await import("../core/tenant/tenantResolver");
  try {
    const trace = await resolveTenantWithTrace(userId, headerTenant);
    /* Non-blocking audit */
    auditTenantResolution(userId, trace, undefined, { ip, userAgent: ua });
    (req as any).tenantId  = trace.tenantId;
    (req as any).tenantTrace = trace.steps;

    const { runWithTenant } = await import("../core/tenantContext");
    const { db } = await import("@workspace/db");
    db.execute(sql`SELECT set_config('app.current_tenant', ${trace.tenantId}, false)`).catch(() => {});
    runWithTenant({ userId, officeId: trace.tenantId }, () => next());
  } catch (err: any) {
    auditTenantResolution(userId, null, err.message ?? "UNKNOWN", { ip, userAgent: ua });
    if (err instanceof TenantResolutionError && err.code === LEGACY_NON_UUID_TENANT) {
      return res.status(409).json({
        error: "حسابك يستخدم معرّف مكتب قديم ويتطلب ترحيل البيانات",
        code: err.code,
        ...err.details,
      });
    }
    const isSA = await isSuperAdminUser(userId);
    if (isSA) {
      (req as any).isSuperAdmin = true;
      (req as any).tenantId = "platform";
      const { runWithTenant } = await import("../core/tenantContext");
      return runWithTenant({ userId, officeId: "platform" }, () => next());
    }
    return res.status(403).json({ error: "لا يمكن تحديد المكتب. تأكد من اكتمال إعداد الحساب.", code: "TNT_403" });
  }
}
