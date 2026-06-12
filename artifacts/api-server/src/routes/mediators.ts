import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

function exAll(q: any) {
  return db.execute(q).then((r: any) => (r as any)?.rows ?? r ?? []);
}
function exOne(q: any) {
  return exAll(q).then((rows: any[]) => rows[0] ?? null);
}

function requireAuth(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "غير مصرح" });
  (req as any).userId = userId;
  next();
}

async function getOfficeId(userId: string): Promise<string | null> {
  const row = await exOne(sql`SELECT id FROM offices WHERE clerk_user_id = ${userId} LIMIT 1`);
  return row?.id ?? null;
}

/* ── List open tasks (public — any authenticated user) ── */
router.get("/mediators/tasks", requireAuth, async (req: any, res) => {
  try {
    const { status = "open", category, search } = req.query as any;
    let q = `
      SELECT mt.*, o.name AS office_name,
             (SELECT COUNT(*) FROM mediator_applications WHERE task_id = mt.id) AS application_count
      FROM mediator_tasks mt
      LEFT JOIN offices o ON o.id = mt.office_id
      WHERE mt.status = $1
    `;
    const params: any[] = [status];
    let idx = 2;
    if (category) { q += ` AND mt.category = $${idx++}`; params.push(category); }
    if (search) { q += ` AND (mt.title ILIKE $${idx++} OR mt.description ILIKE $${idx - 1})`; params.push(`%${search}%`); }
    q += ` ORDER BY mt.created_at DESC`;
    const rows = await exAll(sql.raw(
      q.replace(/\$(\d+)/g, (_, n) => `$${n}`),
      ...params
    ));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Get my posted tasks (office) ── */
router.get("/mediators/my-tasks", requireAuth, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.userId);
    if (!officeId) return res.json([]);
    const rows = await exAll(sql`
      SELECT mt.*,
             (SELECT COUNT(*) FROM mediator_applications WHERE task_id = mt.id) AS application_count
      FROM mediator_tasks mt
      WHERE mt.office_id = ${officeId}
      ORDER BY mt.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Create task (office posts a task) ── */
router.post("/mediators/tasks", requireAuth, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.userId);
    if (!officeId) return res.status(403).json({ error: "يجب أن يكون لديك مكتب مسجل" });
    const { title, description, category = "research", commission = 0, currency = "SAR", deadline, required_skills } = req.body;
    if (!title) return res.status(400).json({ error: "العنوان مطلوب" });
    const row = await exOne(sql`
      INSERT INTO mediator_tasks (office_id, title, description, category, commission, currency, deadline, required_skills)
      VALUES (${officeId}, ${title}, ${description ?? null}, ${category}, ${Number(commission)}, ${currency}, ${deadline ?? null}, ${required_skills ?? null})
      RETURNING *
    `);
    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Update task status ── */
router.put("/mediators/tasks/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.userId);
    const { status } = req.body;
    const row = await exOne(sql`
      UPDATE mediator_tasks SET status = ${status}, updated_at = NOW()
      WHERE id = ${req.params.id} AND office_id = ${officeId}
      RETURNING *
    `);
    if (!row) return res.status(404).json({ error: "المهمة غير موجودة" });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Delete task ── */
router.delete("/mediators/tasks/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.userId);
    await db.execute(sql`DELETE FROM mediator_tasks WHERE id = ${req.params.id} AND office_id = ${officeId}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Apply to task ── */
router.post("/mediators/tasks/:id/apply", requireAuth, async (req: any, res) => {
  try {
    const taskId = req.params.id;
    const { applicant_name, applicant_email, message, agreed_to_terms } = req.body;
    if (!agreed_to_terms) return res.status(400).json({ error: "يجب الموافقة على اتفاقية السرية" });
    const existing = await exOne(sql`SELECT id FROM mediator_applications WHERE task_id = ${taskId} AND applicant_clerk_id = ${req.userId}`);
    if (existing) return res.status(409).json({ error: "لقد تقدمت على هذه المهمة مسبقاً" });
    const row = await exOne(sql`
      INSERT INTO mediator_applications (task_id, applicant_clerk_id, applicant_name, applicant_email, message, agreed_to_terms, agreed_at)
      VALUES (${taskId}, ${req.userId}, ${applicant_name}, ${applicant_email ?? null}, ${message ?? null}, TRUE, NOW())
      RETURNING *
    `);
    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Get applications for a task (office owner) ── */
router.get("/mediators/tasks/:id/applications", requireAuth, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.userId);
    const task = await exOne(sql`SELECT id FROM mediator_tasks WHERE id = ${req.params.id} AND office_id = ${officeId}`);
    if (!task) return res.status(403).json({ error: "غير مصرح" });
    const rows = await exAll(sql`SELECT * FROM mediator_applications WHERE task_id = ${req.params.id} ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── My applications ── */
router.get("/mediators/my-applications", requireAuth, async (req: any, res) => {
  try {
    const rows = await exAll(sql`
      SELECT ma.*, mt.title AS task_title, mt.commission, mt.currency, mt.status AS task_status,
             o.name AS office_name
      FROM mediator_applications ma
      JOIN mediator_tasks mt ON mt.id = ma.task_id
      LEFT JOIN offices o ON o.id = mt.office_id
      WHERE ma.applicant_clerk_id = ${req.userId}
      ORDER BY ma.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Update application status (office owner) ── */
router.put("/mediators/applications/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.userId);
    const { status } = req.body;
    const row = await exOne(sql`
      UPDATE mediator_applications ma
      SET status = ${status}
      FROM mediator_tasks mt
      WHERE ma.id = ${req.params.id} AND ma.task_id = mt.id AND mt.office_id = ${officeId}
      RETURNING ma.*
    `);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Stats for admin ── */
router.get("/mediators/stats", requireAuth, async (_req, res) => {
  try {
    const stats = await exOne(sql`
      SELECT
        (SELECT COUNT(*) FROM mediator_tasks) AS total_tasks,
        (SELECT COUNT(*) FROM mediator_tasks WHERE status = 'open') AS open_tasks,
        (SELECT COUNT(*) FROM mediator_tasks WHERE status = 'completed') AS completed_tasks,
        (SELECT COUNT(*) FROM mediator_applications) AS total_applications,
        (SELECT COUNT(*) FROM mediator_applications WHERE status = 'accepted') AS accepted_applications,
        (SELECT COALESCE(SUM(commission),0) FROM mediator_tasks WHERE status = 'completed') AS total_commissions
    `);
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
