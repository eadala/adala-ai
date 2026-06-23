/**
 * Tenant Middleware — Multi-Tenant Resolution
 *
 * Resolves the current office (tenant) from the authenticated Clerk userId.
 * Strategy (in order):
 *   1. x-tenant-id header     (developer API keys / programmatic access)
 *   2. office_members lookup  (user belongs to an office)
 *   3. users.office_id        (primary office stored on user row)
 *   4. First office_page row  (backward-compat single-tenant fallback)
 *
 * Sets req.tenantId on success; returns 401/403 on failure.
 */
import type { Request, Response, NextFunction } from "express";
import { getAuth, createClerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditTenantResolution, resolveTenantWithTrace } from "../core/tenant/tenantResolver";

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

/* Simple in-memory cache: userId → officeId (TTL 5 min) */
const CACHE = new Map<string, { officeId: string; ts: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function resolveTenantId(userId: string, headerTenantId?: string): Promise<string | null> {
  /* 1. Explicit header (API keys, dev access) */
  if (headerTenantId) return headerTenantId;

  /* 1b. Developer impersonation — SA viewing as another office */
  try {
    const imp = await db.execute(sql`
      SELECT impersonated_office_id FROM developer_impersonation
      WHERE super_admin_user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);
    const impOffice = ((imp as any)?.rows ?? [])[0]?.impersonated_office_id as string | undefined;
    if (impOffice) return impOffice;
  } catch {}

  /* 2. Cache */
  const cached = CACHE.get(userId);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.officeId;

  try {
    /* 3. office_members join */
    const memberRows = await db.execute(sql`
      SELECT office_id FROM office_members
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `);
    const memberId = ((memberRows as any)?.rows ?? [])[0]?.office_id as string | undefined;
    if (memberId) {
      CACHE.set(userId, { officeId: memberId, ts: Date.now() });
      return memberId;
    }

    /* 4. users.office_id (primary office) */
    const userRows = await db.execute(sql`
      SELECT office_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    const userOffice = ((userRows as any)?.rows ?? [])[0]?.office_id as string | undefined;
    if (userOffice) {
      CACHE.set(userId, { officeId: userOffice, ts: Date.now() });
      return userOffice;
    }

    /* 5. office_registry — owner lookup by Clerk userId (safe: matches by owner) */
    const regRows = await db.execute(sql`
      SELECT id FROM office_registry
      WHERE clerk_user_id = ${userId} AND status = 'active'
      LIMIT 1
    `);
    const regOffice = ((regRows as any)?.rows ?? [])[0]?.id as string | undefined;
    if (regOffice) {
      /* Auto-heal: create office_members entry so future lookups hit step 3 */
      db.execute(sql`
        INSERT INTO office_members (office_id, user_id, role, status)
        VALUES (${regOffice}, ${userId}, 'owner', 'active')
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      /* Also set users.office_id so step 4 works next time */
      db.execute(sql`
        UPDATE users SET office_id = ${regOffice}
        WHERE id = ${userId} AND office_id IS NULL
      `).catch(() => {});
      CACHE.set(userId, { officeId: regOffice, ts: Date.now() });
      return regOffice;
    }

    /* 6. trial_offices — users who completed onboarding but never got office_members */
    const trialRows = await db.execute(sql`
      SELECT office_id FROM trial_offices
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    const trialOffice = ((trialRows as any)?.rows ?? [])[0]?.office_id as string | undefined;
    if (trialOffice) {
      /* Auto-heal: persist to office_members so future requests hit step 3 */
      db.execute(sql`
        INSERT INTO office_members (office_id, user_id, role, status)
        VALUES (${trialOffice}, ${userId}, 'owner', 'active')
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      db.execute(sql`
        UPDATE users SET office_id = ${trialOffice}
        WHERE id = ${userId} AND office_id IS NULL
      `).catch(() => {});
      CACHE.set(userId, { officeId: trialOffice, ts: Date.now() });
      return trialOffice;
    }

    return null;
  } catch {
    return null;
  }
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
  const tenantId = await resolveTenantId(userId, headerTenant);

  if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب المرتبط بهذا الحساب" });

  (req as any).tenantId = tenantId;
  next();
}

/**
 * Combined guard: auth + tenant resolution in one middleware.
 * Replaces requireAuth for routes that need both userId and tenantId.
 * Also injects AsyncLocalStorage tenant context (Kernel Layer 1).
 */
export async function requireAuthWithTenant(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });

  (req as any).userId = userId;

  const headerTenant = req.headers["x-tenant-id"] as string | undefined;
  const tenantId = await resolveTenantId(userId, headerTenant);
  if (!tenantId) {
    /* Super-admin has no office — allow with synthetic "platform" tenant */
    const isSA = await isSuperAdminUser(userId);
    if (isSA) {
      (req as any).isSuperAdmin = true;
      (req as any).tenantId = "platform";
      const { runWithTenant } = await import("../core/tenantContext");
      return runWithTenant({ userId, officeId: "platform" }, () => next());
    }
    return res.status(403).json({ error: "لا يمكن تحديد المكتب. تأكد من اكتمال إعداد الحساب." });
  }
  const officeId = tenantId;
  (req as any).tenantId = officeId;

  const { runWithTenant } = await import("../core/tenantContext");
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");

  /* Layer 3 — RLS: force all queries to see only this tenant's rows */
  db.execute(sql`SELECT set_config('app.current_tenant', ${officeId}, false)`)
    .catch(() => {});

  runWithTenant({ userId, officeId }, () => next());
}

/**
 * requireAuthWithTenantAudit — same as requireAuthWithTenant but also
 * writes a non-blocking entry to tenant_audit_logs via TIRE.
 * Use on sensitive endpoints that need full audit trail.
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

  try {
    const trace = await resolveTenantWithTrace(userId, headerTenant);
    /* Non-blocking audit */
    auditTenantResolution(userId, trace, undefined, { ip, userAgent: ua });
    (req as any).tenantId  = trace.tenantId;
    (req as any).tenantTrace = trace.steps;

    const { runWithTenant } = await import("../core/tenantContext");
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    db.execute(sql`SELECT set_config('app.current_tenant', ${trace.tenantId}, false)`).catch(() => {});
    runWithTenant({ userId, officeId: trace.tenantId }, () => next());
  } catch (err: any) {
    auditTenantResolution(userId, null, err.message ?? "UNKNOWN", { ip, userAgent: ua });
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
