import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { resolveTenantId } from "./tenantMiddleware";

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
 * requireAuthWithTenant — sets both req.userId and req.tenantId.
 * Use this for routes that need tenant-scoped data.
 */
export async function requireAuthWithTenant(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
  }
  (req as any).userId = userId;
  const headerTenant = req.headers["x-tenant-id"] as string | undefined;
  const tenantId = await resolveTenantId(userId, headerTenant);
  (req as any).tenantId = tenantId ?? "default";
  next();
}
