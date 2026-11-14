/**
 * Object-level office authorization — F-TENANT-OFFICE-IDOR-001
 * Path/body office IDs are selectors; membership must already be verified
 * via requireAuthWithTenant (req.tenantId) or explicit check.
 */
import type { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";

type DbLike = { execute: (q: ReturnType<typeof sql>) => Promise<unknown> };

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return (result as { rows?: Record<string, unknown>[] } | null)?.rows ?? [];
}

/** Deny if path/query officeId does not match verified req.tenantId (or SA). */
export function requirePathOfficeMatchesTenant(
  paramName: "officeId" | "id" = "officeId",
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as { tenantId?: string }).tenantId;
    const isSA = !!(req as { isSuperAdmin?: boolean }).isSuperAdmin;
    if (isSA) return next();
    if (!tenantId || tenantId === "platform") {
      return res.status(403).json({
        error: "سياق المكتب مطلوب",
        code: "TNT_403",
      });
    }
    const pathOffice = String(req.params[paramName] ?? "");
    if (!pathOffice) {
      return res.status(400).json({ error: "معرّف المكتب مفقود", code: "OFFICE_ID_REQUIRED" });
    }
    if (pathOffice !== tenantId) {
      return res.status(403).json({
        error: "غير مصرح بالوصول إلى هذا المكتب",
        code: "OFFICE_FORBIDDEN",
      });
    }
    next();
  };
}

/** Active membership check (for cases without requireAuthWithTenant). */
export async function assertActiveOfficeMember(
  userId: string,
  officeId: string,
  db: DbLike,
): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM office_members
    WHERE user_id = ${userId} AND office_id = ${officeId} AND status = 'active'
    LIMIT 1
  `);
  return rowsOf(r).length > 0;
}
