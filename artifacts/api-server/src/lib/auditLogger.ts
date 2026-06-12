import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface LogEntry {
  userId?: string;
  userFullName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
}

export async function auditLog(entry: LogEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, user_full_name, action, resource, resource_id, details)
      VALUES (
        ${entry.userId ?? null}, ${entry.userFullName ?? null},
        ${entry.action}, ${entry.resource},
        ${entry.resourceId ?? null}, ${entry.details ?? null}
      )
    `);
  } catch {}
}
