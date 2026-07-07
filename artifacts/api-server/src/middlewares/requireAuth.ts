import { getAuth } from "@clerk/express";
import { checkIsSuperAdmin } from "../core/platform/superAdmin";
import type { Request, Response, NextFunction } from "express";
import { resolveTenantId } from "./tenantResolution";
import {
  runWithTenant,
  PLATFORM_TENANT_ID,
  tenantRequiredResponse,
} from "../core/tenantContext";
import {
  assertTenantActive,
  tenantLifecycleResponse,
  TenantLifecycleError,
} from "../core/tenant/tenantLifecycle";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  authorize,
  authorizationContextMissingResponse,
  authorizationDeniedResponse,
  membershipRequiredResponse,
  ensureAuthorizationContext,
  type AuthzRequest,
} from "../core/authorization";

/* ── SA Route Rate Limiting ────────────────────────────────────────────
   Tracks failed SA-access attempts per IP. After MAX_SA_FAILS failures
   within WINDOW_MS the IP is blocked for BLOCK_MS and all attempts are
   logged to audit_logs.
───────────────────────────────────────────────────────────────────────── */
const WINDOW_MS    = 60_000;   // 60-second sliding window
const MAX_SA_FAILS = 5;        // failures before block
const BLOCK_MS     = 300_000;  // 5-minute block
interface _SaBucket { count: number; firstAt: number; blocked: boolean; blockedAt?: number }
const _saBuckets = new Map<string, _SaBucket>();

function _getSaBucket(ip: string): _SaBucket {
  const now = Date.now();
  let b = _saBuckets.get(ip);
  if (!b)                                     { b = { count: 0, firstAt: now, blocked: false }; _saBuckets.set(ip, b); return b; }
  if (b.blocked && now - (b.blockedAt ?? 0) > BLOCK_MS) { b.count = 0; b.firstAt = now; b.blocked = false; delete b.blockedAt; }
  else if (!b.blocked && now - b.firstAt > WINDOW_MS)   { b.count = 0; b.firstAt = now; }
  return b;
}
function _recordSaFail(ip: string, userId: string | null, path: string): boolean {
  const b = _getSaBucket(ip);
  if (b.blocked) return true;
  b.count++;
  if (b.count > MAX_SA_FAILS) { b.blocked = true; b.blockedAt = Date.now(); }
  /* Non-blocking audit log */
  db.execute(sql`
    INSERT INTO audit_logs (user_id, user_full_name, action, resource, resource_id, details)
    VALUES (${userId ?? "anonymous"}, ${"Unknown"}, 'SA_ACCESS_DENIED', 'super_admin_route', ${path},
            ${JSON.stringify({ ip, path, blocked: b.blocked, attempts: b.count, ts: new Date().toISOString() })}::jsonb)
  `).catch(() => {/* audit failure must never break the 403 flow */});
  if (b.blocked) console.warn(`[SA-RATELIMIT] IP ${ip} BLOCKED after ${MAX_SA_FAILS}+ failed SA attempts`);
  return b.blocked;
}
/** Expose stats for Engineering/Developer Center dashboards */
export function getSaRateLimitStats() {
  const blocked: string[] = [];
  const top: { ip: string; count: number }[] = [];
  for (const [ip, b] of _saBuckets) { if (b.blocked) blocked.push(ip); if (b.count >= 3) top.push({ ip, count: b.count }); }
  return { totalBuckets: _saBuckets.size, blockedIps: blocked, topOffenders: top.sort((a, b) => b.count - a.count).slice(0, 10) };
}

/** Re-export canonical super-admin check from platform kernel. */
export { checkIsSuperAdmin } from "../core/platform/superAdmin";

/**
 * requireSuperAdmin — Express middleware (drop-in replacement for all local
 * isSuperAdmin guards). Must be placed AFTER clerkMiddleware in the chain.
 * Sets req.isSuperAdmin = true and req.userId on success.
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const ip = (
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    "unknown"
  );

  /* ── 1. Check if IP is currently blocked ── */
  const bucket = _getSaBucket(ip);
  if (bucket.blocked) {
    const retryAfter = Math.ceil((BLOCK_MS - (Date.now() - (bucket.blockedAt ?? Date.now()))) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "عدد كبير من محاولات الوصول المرفوضة. حاول مجدداً لاحقاً.",
      retryAfterSeconds: retryAfter,
    });
  }

  /* ── 2. Verify authentication ── */
  let auth: ReturnType<typeof getAuth> | null = null;
  try { auth = getAuth(req); } catch { /* malformed/tampered token */ }
  const userId = auth?.userId;
  if (!userId) {
    _recordSaFail(ip, null, req.path);
    return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
  }

  /* ── 3. Verify super-admin via Clerk (always fresh, never cached) ── */
  const ok = await checkIsSuperAdmin(userId);
  if (!ok) {
    const nowBlocked = _recordSaFail(ip, userId, req.path);
    if (nowBlocked) {
      res.setHeader("Retry-After", String(BLOCK_MS / 1000));
      return res.status(429).json({ error: "تم حظر الوصول مؤقتاً بسبب محاولات متكررة." });
    }
    return res.status(403).json({ error: "للمشرف العام فقط — Super Admin Access Required" });
  }

  /* ── 4. Success — reset failure counter ── */
  _saBuckets.delete(ip);
  (req as any).isSuperAdmin = true;
  (req as any).userId = userId;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  let auth: ReturnType<typeof getAuth> | null = null;
  try { auth = getAuth(req); } catch { /* malformed/tampered token */ }
  const userId = auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
  }
  (req as any).userId = userId;
  next();
}

/**
 * requireAuthWithTenant — authenticates the request AND injects the tenant
 * context into BOTH req.tenantId (classic pattern) and AsyncLocalStorage
 * (kernel pattern). All async work triggered by next() sees the same context.
 */
export async function requireAuthWithTenant(req: Request, res: Response, next: NextFunction) {
  let auth: ReturnType<typeof getAuth> | null = null;
  try { auth = getAuth(req); } catch { /* malformed/tampered token */ }
  const userId = auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
  }

  (req as any).userId = userId;
  const headerTenant = req.headers["x-tenant-id"] as string | undefined;
  let tenantId: string | null = null;
  try {
    tenantId = await resolveTenantId(userId, headerTenant);
  } catch {
    return res.status(403).json({ error: "خطأ في تحديد المكتب — حاول مجدداً." });
  }
  if (!tenantId) {
    /* Super-admin has no office — allow with synthetic "platform" tenant */
    const isSA = await checkIsSuperAdmin(userId);
    if (isSA) {
      (req as any).isSuperAdmin = true;
      (req as any).tenantId = PLATFORM_TENANT_ID;
      return runWithTenant({ userId, officeId: PLATFORM_TENANT_ID }, () => next());
    }
    console.warn(
      `[TENANT-403] path=${req.path} method=${req.method} ` +
      `userId=${userId} headerTenant=${headerTenant ?? "none"} ` +
      `→ tenant kernel returned null (fail-closed)`
    );
    return res.status(403).json(tenantRequiredResponse(userId));
  }
  const officeId = tenantId;
  if (officeId !== PLATFORM_TENANT_ID) {
    try {
      await assertTenantActive(officeId);
    } catch (e) {
      if (e instanceof TenantLifecycleError) {
        return res.status(403).json(tenantLifecycleResponse(e));
      }
      throw e;
    }
  }
  (req as any).tenantId = officeId;

  // 🔑 Layer 1: AsyncLocalStorage — getTenant() works anywhere in the stack
  // 🔑 Layer 2: PostgreSQL RLS session variable — DB-level enforcement (AWAITED)
  // set_config(..., false) = session-level — persists on pooled connection for
  // the lifetime of this request. Must be awaited before route handler runs.
  try {
    await db.execute(sql`
      SELECT
        set_config('app.current_tenant', ${officeId}, false),
        set_config('app.tenant_id',      ${officeId}, false),
        set_config('app.bypass_rls',     'false', false)
    `);
  } catch { /* DB config failure is non-fatal — app-level WHERE is primary guard */ }

  runWithTenant({ userId, officeId }, () => next());
}

/* ══════════════════════════════════════════════════════════════════════
   requirePermission — fine-grained RBAC check (runs AFTER requireAuthWithTenant)
   Usage: router.delete("/cases/:id", requireAuthWithTenant, requirePermission("cases:delete"), handler)
   Super-admins always bypass. All other users must hold the named permission
   in their office role (or the wildcard "*").
══════════════════════════════════════════════════════════════════════ */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthzRequest;
    const userId = authReq.userId;
    const officeId = authReq.tenantId;

    if (!userId || !officeId || officeId === PLATFORM_TENANT_ID) {
      return res.status(403).json(authorizationContextMissingResponse());
    }

    try {
      const ctx = await ensureAuthorizationContext(authReq);
      if (!ctx) {
        return res.status(403).json(membershipRequiredResponse(officeId));
      }

      if (ctx.isSuperAdmin && !ctx.isImpersonating) {
        db.execute(sql`
          INSERT INTO audit_logs (user_id, user_full_name, action, resource, resource_id, details)
          VALUES (${userId}, ${"Super Admin"}, 'SA_RBAC_BYPASS', 'authorization', ${req.path},
                  ${JSON.stringify({ officeId, permission, path: req.path, ts: new Date().toISOString() })}::jsonb)
        `).catch(() => {});
        return next();
      }

      const result = authorize(ctx, permission);
      if (result.allowed) return next();

      return res.status(403).json(
        authorizationDeniedResponse(permission, {
          role: ctx.roleName,
          officeId: ctx.officeId,
        }),
      );
    } catch (_e) {
      return res.status(500).json({ error: "خطأ داخلي أثناء التحقق من الصلاحيات" });
    }
  };
}

/** Re-export authorization kernel middleware for route modules. */
export { enforceRoutePolicy, loadAuthorizationContext } from "../core/authorization";
export type { AuthorizationContext, RouteClass } from "../core/authorization";
