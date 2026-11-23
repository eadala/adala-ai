import type { Request, Response, NextFunction } from "express";
import { TenantContext } from "../tenant-context";

declare module "express" {
  interface Request { aiTenant?: TenantContext; }
}

export function aiTenantGuard(req: Request, res: Response, next: NextFunction): void {
  const officeId = (req as any).tenantId as string | undefined;
  const userId   = (req as any).userId   as string | undefined;
  const role     = (req as any).role     as string | undefined;

  if (!officeId || !userId) {
    res.status(403).json({ error: "MISSING_TENANT_CONTEXT — AI services require a valid office session" });
    return;
  }

  try {
    req.aiTenant = new TenantContext(officeId, userId, role ?? "member");
  } catch (e: any) {
    res.status(403).json({ error: e.message });
    return;
  }

  const bodyOfficeId = (req.body as any)?.officeId;
  if (bodyOfficeId && bodyOfficeId !== officeId) {
    res.status(403).json({ error: "TENANT_ISOLATION_VIOLATION" });
    return;
  }

  next();
}
