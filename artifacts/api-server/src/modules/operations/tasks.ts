/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; pagination touch-up */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  MAX_PAGE_LIMIT,
  parsePageLimit,
  queryHasPageAndLimit,
} from "../../lib/paginationSafety";
import { toUuid } from "../../lib/taskTenantVisibility";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** SQL predicate (no WHERE) aligned with GET visibility. */
function taskTenantVisibilityPred(tenantId: unknown) {
  const officeId = toUuid(tenantId);
  if (officeId) {
    return sql`(office_id = ${officeId}::uuid OR office_id IS NULL)`;
  }
  return sql`TRUE`;
}

/** SQL WHERE clause for list/stats — same predicate as mutations. */
function taskListOfficeCond(tenantId: unknown) {
  return sql`WHERE ${taskTenantVisibilityPred(tenantId)}`;
}

const TASK_ORDER = sql`
  ORDER BY
    CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
    COALESCE(due_date, '9999-12-31'::date),
    created_at DESC
`;

function taskFilterSql(q: Record<string, unknown>) {
  const search = typeof q.search === "string" && q.search.trim() ? q.search.trim() : null;
  const status = typeof q.status === "string" && q.status && q.status !== "all" ? q.status : null;
  const priority = typeof q.priority === "string" && q.priority && q.priority !== "all" ? q.priority : null;
  const assignee =
    typeof q.assignee === "string" && q.assignee.trim() && q.assignee !== "all"
      ? q.assignee.trim()
      : null;

  return {
    searchCond: search
      ? sql`AND (
          title ILIKE ${"%" + search + "%"}
          OR COALESCE(assignee_name, '') ILIKE ${"%" + search + "%"}
          OR COALESCE(case_title, '') ILIKE ${"%" + search + "%"}
        )`
      : sql``,
    statusCond: status ? sql`AND status = ${status}` : sql``,
    priorityCond: priority ? sql`AND priority = ${priority}` : sql``,
    assigneeCond: assignee ? sql`AND assignee_name = ${assignee}` : sql``,
  };
}

router.get("/office-tasks", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const paginated = queryHasPageAndLimit(req.query);
    const { page, limit, offset } = paginated
      ? parsePageLimit(req.query, 50)
      : { page: 1, limit: MAX_PAGE_LIMIT, offset: 0 };
    const { searchCond, statusCond, priorityCond, assigneeCond } = taskFilterSql(
      req.query as Record<string, unknown>,
    );
    const officeCond = taskListOfficeCond(tenantId);

    const r = await db.execute(sql`
      SELECT * FROM tasks
      ${officeCond}
      ${searchCond} ${statusCond} ${priorityCond} ${assigneeCond}
      ${TASK_ORDER}
      LIMIT ${limit} OFFSET ${offset}
    `);
    const rows = sqlAll(r);

    if (!paginated) {
      res.json(rows);
      return;
    }

    const countR = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM tasks
      ${officeCond}
      ${searchCond} ${statusCond} ${priorityCond} ${assigneeCond}
    `);
    const total = Number(sqlOne(countR)?.total ?? 0);
    res.json({
      data: rows,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e: any) {
    console.error("[office-tasks] GET error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get("/office-tasks/stats", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const officeCond = taskListOfficeCond(tenantId);
    const r = await db.execute(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'todo')::int as todo,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress,
        COUNT(*) FILTER (WHERE status = 'done')::int as done,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'done')::int as overdue
      FROM tasks
      ${officeCond}
    `);
    res.json(sqlOne(r) ?? { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 });
  } catch (e: any) {
    console.error("[office-tasks/stats] GET error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post("/office-tasks", requireAuthWithTenant, async (req, res) => {
  try {
    const { title, description, status = "todo", priority = "medium", assigneeName, dueDate, caseTitle, createdBy } = req.body;
    if (!title) return res.status(400).json({ error: "عنوان المهمة مطلوب" });

    const officeId = toUuid((req as any).tenantId);
    const dueDateVal = dueDate || null;

    const r = await db.execute(sql`
      INSERT INTO tasks (office_id, title, description, status, priority, assignee_name, due_date, case_title, created_by)
      VALUES (
        ${officeId ? sql`${officeId}::uuid` : sql`NULL`},
        ${title},
        ${description || null},
        ${status},
        ${priority},
        ${assigneeName || null},
        ${dueDateVal ? sql`${dueDateVal}::date` : sql`NULL`},
        ${caseTitle || null},
        ${createdBy || null}
      )
      RETURNING *
    `);
    res.json(sqlOne(r));
  } catch (e: any) {
    console.error("[office-tasks] POST error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.patch("/office-tasks/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "معرف غير صالح" });
    const { title, description, status, priority, assigneeName, dueDate, caseTitle } = req.body;
    const dueDateVal = dueDate || null;
    const tenantId = (req as any).tenantId as string;
    const vis = taskTenantVisibilityPred(tenantId);
    const r = await db.execute(sql`
      UPDATE tasks SET
        title = COALESCE(${title || null}, title),
        description = COALESCE(${description || null}, description),
        status = COALESCE(${status || null}, status),
        priority = COALESCE(${priority || null}, priority),
        assignee_name = COALESCE(${assigneeName || null}, assignee_name),
        due_date = COALESCE(${dueDateVal ? sql`${dueDateVal}::date` : sql`NULL`}, due_date),
        case_title = COALESCE(${caseTitle || null}, case_title),
        updated_at = NOW()
      WHERE id = ${id}::uuid AND ${vis}
      RETURNING *
    `);
    const row = sqlOne(r);
    if (!row) return res.status(404).json({ error: "المهمة غير موجودة" });
    res.json(row);
  } catch (e: any) {
    console.error("[office-tasks] PATCH error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/office-tasks/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: "معرف غير صالح" });
    const tenantId = (req as any).tenantId as string;
    const vis = taskTenantVisibilityPred(tenantId);
    const r = await db.execute(sql`
      DELETE FROM tasks
      WHERE id = ${id}::uuid AND ${vis}
      RETURNING id
    `);
    const row = sqlOne(r);
    if (!row) return res.status(404).json({ error: "المهمة غير موجودة" });
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[office-tasks] DELETE error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
