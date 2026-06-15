import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Request } from "express";

export interface AuditEntry {
  userId?: string;
  userFullName?: string;
  officeId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Extract audit metadata from an Express request */
export function auditMeta(req: Request): Pick<AuditEntry, "ipAddress" | "userAgent" | "userId" | "officeId"> {
  return {
    userId:    (req as any).userId    ?? undefined,
    officeId:  (req as any).tenantId  ?? undefined,
    ipAddress: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
               ?? req.socket?.remoteAddress
               ?? undefined,
    userAgent: req.headers["user-agent"] ?? undefined,
  };
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs
        (user_id, user_full_name, office_id, action, resource, resource_id, details, ip_address, user_agent)
      VALUES (
        ${entry.userId    ?? null},
        ${entry.userFullName ?? null},
        ${entry.officeId  ?? null},
        ${entry.action},
        ${entry.resource},
        ${entry.resourceId ?? null},
        ${entry.details   ?? null},
        ${entry.ipAddress ?? null},
        ${entry.userAgent ?? null}
      )
    `);
  } catch {}
}
