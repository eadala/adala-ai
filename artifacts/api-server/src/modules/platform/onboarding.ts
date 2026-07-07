import { requireAuth } from "../../middlewares/requireAuth";
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
      office_id   TEXT,
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

router.get("/onboarding/state", requireAuth, async (req, res) => {
  await ensureTable();
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.json({ completed: false, step: 0, data: {} });
    const row = await sqlOne(sql`SELECT * FROM onboarding_state WHERE user_id = ${userId}`);
    res.json(row ?? { completed: false, step: 0, data: {} });
  } catch { res.json({ completed: false, step: 0, data: {} }); }
});

router.put("/onboarding/state", requireAuth, async (req, res) => {
  await ensureTable();
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { completed, step, data } = req.body;

    /* ── When completing onboarding, provision a real office if none exists ── */
    let resolvedOfficeId: string | null = null;
    if (completed) {
      /* Check if user already has an active office membership */
      const existingMember = await sqlOne(sql`
        SELECT office_id FROM office_members
        WHERE user_id = ${userId} AND status = 'active'
        LIMIT 1
      `);

      if (existingMember?.office_id) {
        resolvedOfficeId = existingMember.office_id;
      } else {
        /* Provision a new trial office for this user */
        const safeId = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8);
        const newOfficeId = `trial_${safeId}`;
        const officeName: string =
          (data as any)?.officeName ?? (data as any)?.name ?? "مكتب المحاماة";

        /* Insert into trial_offices (source of truth for trial tenants) */
        await db.execute(sql`
          INSERT INTO trial_offices (user_id, office_id, office_name)
          VALUES (${userId}, ${newOfficeId}, ${officeName})
          ON CONFLICT (user_id) DO UPDATE SET office_name = EXCLUDED.office_name
        `);

        /* Insert into office_members so tenant resolution hits step 3 immediately */
        await db.execute(sql`
          INSERT INTO office_members (office_id, user_id, role, status)
          VALUES (${newOfficeId}, ${userId}, 'owner', 'active')
          ON CONFLICT (office_id, user_id) DO NOTHING
        `);

        resolvedOfficeId = newOfficeId;
        console.log(`[ONBOARDING] Provisioned office ${newOfficeId} for user ${userId}`);
      }
    }

    const row = await sqlOne(sql`
      INSERT INTO onboarding_state (user_id, office_id, completed, step, data, updated_at)
      VALUES (
        ${userId},
        ${resolvedOfficeId},
        ${completed ?? false},
        ${step ?? 0},
        ${JSON.stringify(data ?? {})}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        completed  = EXCLUDED.completed,
        step       = EXCLUDED.step,
        data       = EXCLUDED.data,
        office_id  = COALESCE(EXCLUDED.office_id, onboarding_state.office_id),
        updated_at = NOW()
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
