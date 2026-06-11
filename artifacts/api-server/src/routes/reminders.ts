import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reminders (
      id            SERIAL PRIMARY KEY,
      office_id     TEXT NOT NULL DEFAULT 'default',
      title         TEXT NOT NULL,
      body          TEXT,
      due_date      DATE,
      due_time      TEXT,
      priority      TEXT NOT NULL DEFAULT 'medium',
      category      TEXT NOT NULL DEFAULT 'general',
      case_id       INTEGER,
      done          BOOLEAN NOT NULL DEFAULT FALSE,
      created_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function sqlAll(q: any) {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function sqlOne(q: any) {
  const rows = await sqlAll(q);
  return rows[0] ?? null;
}

router.get("/reminders", async (req, res) => {
  await ensureTable();
  try {
    const { done } = req.query;
    const rows = await sqlAll(sql`
      SELECT r.*, c.title as case_title
      FROM reminders r
      LEFT JOIN cases c ON c.id = r.case_id
      WHERE r.office_id = 'default'
        ${done === "true" ? sql`AND r.done = true` : done === "false" ? sql`AND r.done = false` : sql``}
      ORDER BY r.done ASC, r.due_date ASC NULLS LAST, r.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/reminders/count", async (_req, res) => {
  await ensureTable();
  try {
    const row = await sqlOne(sql`
      SELECT COUNT(*)::int as count
      FROM reminders
      WHERE office_id = 'default' AND done = false
        AND (due_date IS NULL OR due_date >= CURRENT_DATE - INTERVAL '1 day')
    `);
    res.json({ count: row?.count ?? 0 });
  } catch { res.json({ count: 0 }); }
});

router.post("/reminders", async (req, res) => {
  await ensureTable();
  try {
    const { userId } = getAuth(req as any);
    const { title, body, dueDate, dueTime, priority, category, caseId } = req.body;
    const row = await sqlOne(sql`
      INSERT INTO reminders (office_id, title, body, due_date, due_time, priority, category, case_id, created_by)
      VALUES ('default', ${title}, ${body ?? null}, ${dueDate ?? null}, ${dueTime ?? null},
              ${priority ?? "medium"}, ${category ?? "general"}, ${caseId ?? null}, ${userId ?? null})
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/reminders/:id", async (req, res) => {
  await ensureTable();
  try {
    const { id } = req.params;
    const { title, body, dueDate, dueTime, priority, category, done } = req.body;
    const row = await sqlOne(sql`
      UPDATE reminders SET
        title    = COALESCE(${title ?? null}, title),
        body     = COALESCE(${body ?? null}, body),
        due_date = COALESCE(${dueDate ?? null}::date, due_date),
        due_time = COALESCE(${dueTime ?? null}, due_time),
        priority = COALESCE(${priority ?? null}, priority),
        category = COALESCE(${category ?? null}, category),
        done     = COALESCE(${done ?? null}, done)
      WHERE id = ${parseInt(id)} AND office_id = 'default'
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/reminders/:id", async (req, res) => {
  await ensureTable();
  try {
    await db.execute(sql`DELETE FROM reminders WHERE id = ${parseInt(req.params.id)} AND office_id = 'default'`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
