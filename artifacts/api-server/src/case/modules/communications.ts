/**
 * Case Communications Module — وحدة الاتصالات الداخلية للقضية
 * ─────────────────────────────────────────────────────────────
 * chat داخلي مرتبط بكل قضية (case_messages table)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export class CaseCommunications {
  constructor(private readonly tenantId: string) {}

  async getMessages(caseId: string): Promise<any[]> {
    const r = await db.execute(sql`
      SELECT id, case_id, sender_name, body, msg_type, is_read, created_at
      FROM case_messages
      WHERE case_id = ${caseId} AND office_id = ${this.tenantId}
      ORDER BY created_at ASC
    `);
    return (r as any).rows ?? (r as any) ?? [];
  }

  async sendMessage(caseId: string, data: {
    body:         string;
    sender_id?:   string;
    sender_name?: string;
    msg_type?:    string;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO case_messages (id, case_id, office_id, sender_id, sender_name, body, msg_type)
      VALUES (${id}, ${caseId}, ${this.tenantId}, ${data.sender_id ?? null}, ${data.sender_name ?? "المحامي"}, ${data.body}, ${data.msg_type ?? "internal"})
    `);
    return { id, case_id: caseId, ...data, created_at: new Date().toISOString() };
  }

  async markRead(caseId: string): Promise<void> {
    await db.execute(sql`
      UPDATE case_messages SET is_read = true
      WHERE case_id = ${caseId} AND office_id = ${this.tenantId}
    `);
  }
}
