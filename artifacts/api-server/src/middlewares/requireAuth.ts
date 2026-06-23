import { getAuth, createClerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { resolveTenantId } from "./tenantMiddleware";
import { runWithTenant } from "../core/tenantContext";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ── Super-admin bypass helper ─────────────────────────────────────────
   Super admins have no office in DB — they get tenantId = "platform".
   We check both the env whitelist AND Clerk publicMetadata for resilience.
───────────────────────────────────────────────────────────────────────── */
let _saClerk: ReturnType<typeof createClerkClient> | null = null;
function getSAClerk() {
  if (!_saClerk) _saClerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _saClerk;
}

async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? process.env.PLATFORM_OWNER_EMAIL ?? "";
  const saEmails = raw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!saEmails.length) return false;
  try {
    const clerk = getSAClerk();
    const user = await clerk.users.getUser(userId);
    const email = (user.emailAddresses[0]?.emailAddress ?? "").toLowerCase();
    return saEmails.includes(email) || user.publicMetadata?.role === "super_admin";
  } catch { return false; }
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
      (req as any).tenantId = "platform";
      return runWithTenant({ userId, officeId: "platform" }, () => next());
    }
    return res.status(403).json({ error: "لا يمكن تحديد المكتب. تأكد من اكتمال إعداد الحساب." });
  }
  const officeId = tenantId;
  (req as any).tenantId = officeId;

  // 🔑 Layer 1: AsyncLocalStorage — getTenant() works anywhere in the stack
  // 🔑 Layer 2: PostgreSQL RLS session variable — DB-level enforcement (AWAITED)
  // set_config(..., false) = session-level — persists on pooled connection for
  // the lifetime of this request. Must be awaited before route handler runs.
  try {
    await db.execute(sql`
      SELECT
        set_config('app.current_tenant', ${officeId}, false),
        set_config('app.tenant_id',      ${officeId}, false)
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
    // Super-admins bypass all RBAC checks
    if ((req as any).isSuperAdmin) return next();

    const userId: string | undefined = (req as any).userId;
    const officeId: string | undefined = (req as any).tenantId;

    if (!userId || !officeId || officeId === "platform") {
      return res.status(403).json({ error: "سياق المصادقة مفقود — يجب استدعاء requireAuthWithTenant أولاً" });
    }

    try {
      // Step 1: resolve user's role in this office
      const memberRows = await db.execute(sql`
        SELECT role FROM office_members
        WHERE user_id = ${userId} AND office_id = ${officeId} AND status = 'active'
        LIMIT 1
      `) as any;
      const mArr = Array.isArray(memberRows) ? memberRows : (memberRows?.rows ?? []);
      const roleName: string = mArr[0]?.role ?? "trainee_lawyer";

      // Step 2: load that role's permission list from the roles table
      const roleRows = await db.execute(sql`
        SELECT permissions FROM roles WHERE name = ${roleName} LIMIT 1
      `) as any;
      const rArr = Array.isArray(roleRows) ? roleRows : (roleRows?.rows ?? []);
      const permissions: string[] = rArr[0]?.permissions
        ? (JSON.parse(rArr[0].permissions) as string[])
        : [];

      // Step 3: wildcard ("*") = full access; otherwise check exact match
      if (permissions.includes("*") || permissions.includes(permission)) {
        return next();
      }

      return res.status(403).json({
        error: "ليس لديك صلاحية تنفيذ هذا الإجراء",
        required: permission,
        role: roleName,
      });
    } catch (_e) {
      return res.status(500).json({ error: "خطأ داخلي أثناء التحقق من الصلاحيات" });
    }
  };
}
