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
  const auth = getAuth(req);
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
  const auth = getAuth(req);
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
  // 🔑 Layer 2: PostgreSQL RLS session variable — DB-level enforcement
  // Both run asynchronously but are set before any route handler executes.
  db.execute(sql`SELECT set_config('app.current_tenant', ${officeId}, false)`)
    .catch(() => {}); // Non-blocking — app-level filter is the primary guard

  runWithTenant({ userId, officeId }, () => next());
}
