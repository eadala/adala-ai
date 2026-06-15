import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Request } from "express";

export interface AuditEntry {
  userId?:        string;
  userFullName?:  string;
  officeId?:      string;
  action:         string;
  resource:       string;
  resourceId?:    string;
  details?:       string;
  ipAddress?:     string;
  userAgent?:     string;
  requestId?:     string;
  correlationId?: string;
}

/** Extract audit metadata from an Express request */
export function auditMeta(req: Request): Pick<
  AuditEntry,
  "ipAddress" | "userAgent" | "userId" | "officeId" | "requestId" | "correlationId"
> {
  return {
    userId:        (req as any).userId    ?? undefined,
    officeId:      (req as any).tenantId  ?? undefined,
    ipAddress:     (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
                   ?? req.socket?.remoteAddress
                   ?? undefined,
    userAgent:     req.headers["user-agent"] ?? undefined,
    requestId:     (req as any).requestId     ?? undefined,
    correlationId: (req as any).correlationId ?? undefined,
  };
}

/**
 * Append-only audit log write.
 * Table columns include request_id + correlation_id for full observability.
 * Never throws — structured for Elastic/Loki compatibility.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs
        (user_id, user_full_name, office_id, action, resource, resource_id,
         details, ip_address, user_agent, request_id, correlation_id)
      VALUES (
        ${entry.userId        ?? null},
        ${entry.userFullName  ?? null},
        ${entry.officeId      ?? null},
        ${entry.action},
        ${entry.resource},
        ${entry.resourceId    ?? null},
        ${entry.details       ?? null},
        ${entry.ipAddress     ?? null},
        ${entry.userAgent     ?? null},
        ${entry.requestId     ?? null}::uuid,
        ${entry.correlationId ?? null}::uuid
      )
    `);
  } catch {
    /* audit failures must never crash the main request */
  }
}

/**
 * Structured log line for Elastic / Loki sink compatibility.
 * Call from webhook handlers or background jobs where no req object exists.
 */
export function buildLogLine(entry: AuditEntry): Record<string, unknown> {
  return {
    "@timestamp":   new Date().toISOString(),
    level:          "INFO",
    service:        "adala-api",
    event:          {
      action:       entry.action,
      resource:     entry.resource,
      resource_id:  entry.resourceId,
    },
    user:           { id: entry.userId, office_id: entry.officeId },
    http:           { request_id: entry.requestId, correlation_id: entry.correlationId },
    network:        { client: { ip: entry.ipAddress } },
    details:        entry.details,
  };
}
