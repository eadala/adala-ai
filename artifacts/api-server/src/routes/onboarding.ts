import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS onboarding_state (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL UNIQUE,
      office_id   TEXT NOT NULL DEFAULT 'default',
      completed   BOOLEAN NOT NULL DEFAULT FALSE,
      step        INTEGER NOT NULL DEFAULT 0,
      data        JSONB DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function sqlOne(q: any) {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

router.get("/onboarding/state", async (req, res) => {
  await ensureTable();
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.json({ completed: false, step: 0, data: {} });
    const row = await sqlOne(sql`SELECT * FROM onboarding_state WHERE user_id = ${userId}`);
    res.json(row ?? { completed: false, step: 0, data: {} });
  } catch { res.json({ completed: false, step: 0, data: {} }); }
});

router.put("/onboarding/state", async (req, res) => {
  await ensureTable();
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { completed, step, data } = req.body;
    const row = await sqlOne(sql`
      INSERT INTO onboarding_state (user_id, office_id, completed, step, data, updated_at)
      VALUES (${userId}, 'default', ${completed ?? false}, ${step ?? 0}, ${JSON.stringify(data ?? {})}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        completed  = EXCLUDED.completed,
        step       = EXCLUDED.step,
        data       = EXCLUDED.data,
        updated_at = NOW()
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
