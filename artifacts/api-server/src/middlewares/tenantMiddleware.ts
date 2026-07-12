/**
 * Tenant Middleware — compatibility layer + audit variant.
 *
 * Canonical requireAuthWithTenant: middlewares/requireAuth.ts
 * Tenant resolution (resolveTenantId): middlewares/tenantResolution.ts
 */
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditTenantResolution, resolveTenantWithTrace } from "../core/tenant/tenantResolver";
import { PLATFORM_TENANT_ID, runWithTenant, tenantRequiredResponse } from "../core/tenantContext";
import { checkIsSuperAdmin } from "./requireAuth";
import { resolveTenantId, invalidateTenantCache } from "./tenantResolution";

export { resolveTenantId, invalidateTenantCache } from "./tenantResolution";

/** @see requireAuth.requireAuthWithTenant — canonical implementation */
export { requireAuthWithTenant } from "./requireAuth";

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });

  const headerTenant = req.headers["x-tenant-id"] as string | undefined;
  const tenantId = await resolveTenantId(userId, headerTenant);

  if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب المرتبط بهذا الحساب" });

  (req as any).tenantId = tenantId;
  next();
}

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
    auditTenantResolution(userId, trace, undefined, { ip, userAgent: ua });
    (req as any).tenantId  = trace.tenantId;
    (req as any).tenantTrace = trace.steps;

    await db.execute(sql`
      SELECT
        set_config('app.current_tenant', ${trace.tenantId}, false),
        set_config('app.tenant_id',      ${trace.tenantId}, false)
    `);
    runWithTenant({ userId, officeId: trace.tenantId }, () => next());
  } catch (err: any) {
    auditTenantResolution(userId, null, err.message ?? "UNKNOWN", { ip, userAgent: ua });
    const isSA = await checkIsSuperAdmin(userId);
    if (isSA) {
      (req as any).isSuperAdmin = true;
      (req as any).tenantId = PLATFORM_TENANT_ID;
      return runWithTenant({ userId, officeId: PLATFORM_TENANT_ID }, () => next());
    }
    return res.status(403).json(tenantRequiredResponse(userId));
  }
}
