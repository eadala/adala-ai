/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; pagination touch-up */
/**
 * Case Tasks Module — وحدة المهام المرتبطة بالقضية
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resolveTaskOfficeId } from "../../lib/taskTenantVisibility";

export class CaseTasks {
  constructor(private readonly tenantId: string) {}

  async getTasks(caseId: string): Promise<any[]> {
    const officeId = resolveTaskOfficeId(this.tenantId);
    if (!officeId) return [];

    /* tasks.case_id is TEXT (was UUID, migrated). Compare as text. */
    const r = await db.execute(sql`
      SELECT id, title, description, status, priority, assignee_name, due_date, created_at
      FROM tasks
      WHERE case_id = ${caseId}
        AND office_id = ${officeId}::uuid
      ORDER BY created_at DESC
    `).catch(() => ({ rows: [] }));
    return (r as any).rows ?? (r as any) ?? [];
  }

  async createTask(caseId: string, caseTitle: string, data: {
    title:         string;
    description?:  string;
    priority?:     string;
    assignee_name?: string;
    due_date?:     string;
  }): Promise<any> {
    const officeId = resolveTaskOfficeId(this.tenantId);
    if (!officeId) {
      throw new Error("تعذر تحديد المكتب — صلاحية إنشاء المهمة مرفوضة");
    }

    const r = await db.execute(sql`
      INSERT INTO tasks (case_id, case_title, office_id, title, description, priority, assignee_name, due_date, status)
      VALUES (
        ${caseId},
        ${caseTitle},
        ${officeId}::uuid,
        ${data.title},
        ${data.description ?? null},
        ${data.priority ?? "medium"},
        ${data.assignee_name ?? null},
        ${data.due_date ? sql`${data.due_date}::date` : sql`NULL`},
        'todo'
      )
      RETURNING id, title, status, priority, assignee_name, due_date, created_at
    `);
    return ((r as any).rows ?? (r as any))?.[0] ?? {};
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    const officeId = resolveTaskOfficeId(this.tenantId);
    if (!officeId) {
      throw new Error("تعذر تحديد المكتب — صلاحية تحديث المهمة مرفوضة");
    }

    await db.execute(sql`
      UPDATE tasks SET status = ${status}, updated_at = NOW()
      WHERE id = ${taskId}::uuid AND office_id = ${officeId}::uuid
    `);
  }
}
