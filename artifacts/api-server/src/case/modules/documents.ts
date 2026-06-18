/**
 * Case Documents Module — وحدة مستندات القضية
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export class CaseDocuments {
  constructor(private readonly tenantId: string) {}

  async getDocuments(caseId: string): Promise<any[]> {
    const r = await db.execute(sql`
      SELECT id, file_name, file_type, file_url, file_size, created_at
      FROM documents
      WHERE case_id = ${caseId} AND office_id = ${this.tenantId}
      ORDER BY created_at DESC
    `);
    return (r as any).rows ?? (r as any) ?? [];
  }

  async addDocument(caseId: string, data: {
    file_name: string;
    file_type: string;
    file_url:  string;
    file_size?: number;
  }): Promise<any> {
    const r = await db.execute(sql`
      INSERT INTO documents (id, case_id, office_id, file_name, file_type, file_url, file_size)
      VALUES (gen_random_uuid()::text, ${caseId}, ${this.tenantId}, ${data.file_name}, ${data.file_type}, ${data.file_url}, ${data.file_size ?? null})
      RETURNING id, file_name, file_type, file_url, created_at
    `);
    return ((r as any).rows ?? (r as any))?.[0] ?? {};
  }
}
