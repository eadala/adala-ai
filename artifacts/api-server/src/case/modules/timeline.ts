/**
 * Case Timeline Module — وحدة الجدول الزمني للقضية
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export class CaseTimeline {
  constructor(private readonly tenantId: string) {}

  async getEntries(caseId: string): Promise<any[]> {
    const r = await db.execute(sql`
      SELECT id, case_id, entry_type, title, description, happened_at, is_shared, created_by, created_at
      FROM case_timeline
      WHERE case_id = ${caseId}
      ORDER BY happened_at DESC
    `);
    return (r as any).rows ?? (r as any) ?? [];
  }

  async addEntry(caseId: string, data: {
    entry_type:   string;
    title:        string;
    description?: string;
    is_shared?:   boolean;
    created_by?:  string;
  }): Promise<any> {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO case_timeline (id, case_id, entry_type, title, description, is_shared, created_by)
      VALUES (${id}, ${caseId}, ${data.entry_type}, ${data.title}, ${data.description ?? null}, ${data.is_shared ?? true}, ${data.created_by ?? null})
    `);
    return { id, case_id: caseId, ...data, happened_at: new Date().toISOString() };
  }

  async deleteEntry(entryId: string): Promise<void> {
    await db.execute(sql`DELETE FROM case_timeline WHERE id = ${entryId}`);
  }
}
