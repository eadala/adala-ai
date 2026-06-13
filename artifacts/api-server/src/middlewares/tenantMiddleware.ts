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
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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

    /* 5. Fallback — first office_page row (single-tenant backward compat) */
    const pageRows = await db.execute(sql`
      SELECT id::text AS id FROM office_page ORDER BY created_at ASC LIMIT 1
    `);
    const pageId = ((pageRows as any)?.rows ?? [])[0]?.id as string | undefined;
    const officeId = pageId ?? "default";
    CACHE.set(userId, { officeId, ts: Date.now() });
    return officeId;
  } catch {
    return "default";
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
 */
export async function requireAuthWithTenant(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });

  (req as any).userId = userId;

  const headerTenant = req.headers["x-tenant-id"] as string | undefined;
  const tenantId = await resolveTenantId(userId, headerTenant);
  (req as any).tenantId = tenantId ?? "default";

  next();
}
