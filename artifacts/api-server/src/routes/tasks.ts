import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function sqlAll(r: any): any[] {
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r.rows)) return r.rows;
  return [];
}

function sqlOne(r: any): any {
  const rows = sqlAll(r);
  return rows[0] ?? null;
}

router.get("/tasks", async (_req, res) => {
  try {
    const r = await db.execute(sql`
      SELECT * FROM tasks ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        COALESCE(due_date, '9999-12-31'::date),
        created_at DESC
    `);
    res.json(sqlAll(r));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/tasks/stats", async (_req, res) => {
  try {
    const r = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'todo') as todo,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'done') as done,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'done') as overdue
      FROM tasks
    `);
    res.json(sqlOne(r) ?? { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const { title, description, status = "todo", priority = "medium", assigneeName, dueDate, caseTitle, tags, createdBy } = req.body;
    if (!title) return res.status(400).json({ error: "عنوان المهمة مطلوب" });
    const r = await db.execute(sql`
      INSERT INTO tasks (title, description, status, priority, assignee_name, due_date, case_title, tags, created_by)
      VALUES (
        ${title}, ${description ?? null}, ${status}, ${priority},
        ${assigneeName ?? null}, ${dueDate ?? null}, ${caseTitle ?? null},
        ${tags ? sql`${JSON.stringify(tags)}::text[]` : sql`NULL`},
        ${createdBy ?? null}
      )
      RETURNING *
    `);
    res.json(sqlOne(r));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, assigneeName, dueDate, caseTitle, tags } = req.body;
    const r = await db.execute(sql`
      UPDATE tasks SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        status = COALESCE(${status ?? null}, status),
        priority = COALESCE(${priority ?? null}, priority),
        assignee_name = COALESCE(${assigneeName ?? null}, assignee_name),
        due_date = COALESCE(${dueDate ?? null}, due_date),
        case_title = COALESCE(${caseTitle ?? null}, case_title),
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `);
    res.json(sqlOne(r));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM tasks WHERE id = ${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
