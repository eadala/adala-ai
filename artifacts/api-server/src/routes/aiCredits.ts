import { requireAuth } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

/* ── helpers ─────────────────────────────── */
async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function one(q: any): Promise<any | null> {
  const r = await rows(q);
  return r[0] ?? null;
}

async function isSuperAdmin(req: any): Promise<boolean> {
  try {
    const { userId } = getAuth(req);
    if (!userId) return false;
    const admins = (process.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const user = await one(sql`SELECT email, public_metadata FROM users WHERE clerk_id = ${userId} LIMIT 1`);
    if (user?.public_metadata?.role === "super_admin") return true;
    if (user?.email && admins.includes(user.email)) return true;
    return false;
  } catch { return false; }
}

async function adminOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req))) return res.status(403).json({ error: "غير مصرح" });
  next();
}

/* ── table setup ─────────────────────────── */
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS office_ai_credits (
      id                SERIAL PRIMARY KEY,
      office_id         TEXT NOT NULL UNIQUE DEFAULT 'default',
      office_name       TEXT NOT NULL DEFAULT 'المكتب الافتراضي',
      balance           INTEGER NOT NULL DEFAULT 0,
      monthly_allowance INTEGER NOT NULL DEFAULT 100,
      auto_renew        BOOLEAN NOT NULL DEFAULT TRUE,
      renew_day         INTEGER NOT NULL DEFAULT 1,
      last_renewed_at   TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_credit_transactions (
      id          SERIAL PRIMARY KEY,
      office_id   TEXT NOT NULL DEFAULT 'default',
      amount      INTEGER NOT NULL,
      type        TEXT NOT NULL DEFAULT 'usage',
      description TEXT,
      model       TEXT,
      created_by  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  /* seed default office if missing */
  await db.execute(sql`
    INSERT INTO office_ai_credits (office_id, office_name, balance, monthly_allowance)
    VALUES ('default', 'المكتب الافتراضي', 100, 100)
    ON CONFLICT (office_id) DO NOTHING
  `);
}

/* ── GET /admin/ai-credits  ── list all offices ── */
router.get("/admin/ai-credits", adminOnly, async (_req, res) => {
  await ensureTables();
  try {
    const data = await rows(sql`
      SELECT c.*,
        COALESCE((
          SELECT SUM(ABS(t.amount)) FROM ai_credit_transactions t
          WHERE t.office_id = c.office_id
            AND t.type = 'usage'
            AND t.created_at >= date_trunc('month', NOW())
        ), 0)::int AS used_this_month
      FROM office_ai_credits c
      ORDER BY c.office_name ASC
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /admin/ai-credits/:officeId/transactions ── */
router.get("/admin/ai-credits/:officeId/transactions", adminOnly, async (req, res) => {
  await ensureTables();
  try {
    const data = await rows(sql`
      SELECT * FROM ai_credit_transactions
      WHERE office_id = ${req.params.officeId}
      ORDER BY created_at DESC LIMIT 100
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /admin/ai-credits/topup ── manually add credits ── */
router.post("/admin/ai-credits/topup", adminOnly, async (req, res) => {
  await ensureTables();
  try {
    const { userId } = getAuth(req as any);
    const { officeId = "default", amount, description = "شحن يدوي" } = req.body;
    if (!amount || isNaN(parseInt(amount)) || parseInt(amount) <= 0)
      return res.status(400).json({ error: "الرصيد يجب أن يكون رقماً موجباً" });

    const n = parseInt(amount);
    await db.execute(sql`
      INSERT INTO office_ai_credits (office_id, balance)
      VALUES (${officeId}, ${n})
      ON CONFLICT (office_id) DO UPDATE SET
        balance    = office_ai_credits.balance + ${n},
        updated_at = NOW()
    `);
    await db.execute(sql`
      INSERT INTO ai_credit_transactions (office_id, amount, type, description, created_by)
      VALUES (${officeId}, ${n}, 'topup', ${description}, ${userId ?? 'admin'})
    `);
    const updated = await one(sql`SELECT * FROM office_ai_credits WHERE office_id = ${officeId}`);
    res.json({ ok: true, balance: updated?.balance ?? 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /admin/ai-credits/settings ── update monthly_allowance / auto_renew ── */
router.post("/admin/ai-credits/settings", adminOnly, async (req, res) => {
  await ensureTables();
  try {
    const { officeId = "default", officeName, monthlyAllowance, autoRenew, renewDay } = req.body;
    await db.execute(sql`
      INSERT INTO office_ai_credits (office_id, office_name, monthly_allowance, auto_renew, renew_day)
      VALUES (
        ${officeId},
        ${officeName ?? 'مكتب'},
        ${monthlyAllowance ?? 100},
        ${autoRenew ?? true},
        ${renewDay ?? 1}
      )
      ON CONFLICT (office_id) DO UPDATE SET
        office_name       = COALESCE(${officeName ?? null}, office_ai_credits.office_name),
        monthly_allowance = COALESCE(${monthlyAllowance ?? null}, office_ai_credits.monthly_allowance),
        auto_renew        = COALESCE(${autoRenew ?? null}, office_ai_credits.auto_renew),
        renew_day         = COALESCE(${renewDay ?? null}, office_ai_credits.renew_day),
        updated_at        = NOW()
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /admin/ai-credits/renew ── force monthly renewal ── */
router.post("/admin/ai-credits/renew", adminOnly, async (req, res) => {
  await ensureTables();
  try {
    const { userId } = getAuth(req as any);
    const { officeId } = req.body;
    const filter = officeId ? sql`WHERE office_id = ${officeId}` : sql`WHERE auto_renew = true`;
    const offices = await rows(sql`SELECT * FROM office_ai_credits ${filter}`);
    let renewed = 0;
    for (const o of offices) {
      await db.execute(sql`
        UPDATE office_ai_credits
        SET balance = ${o.monthly_allowance}, last_renewed_at = NOW(), updated_at = NOW()
        WHERE office_id = ${o.office_id}
      `);
      await db.execute(sql`
        INSERT INTO ai_credit_transactions (office_id, amount, type, description, created_by)
        VALUES (${o.office_id}, ${o.monthly_allowance}, 'renewal',
                ${'تجديد شهري — ' + new Date().toLocaleDateString('ar-SA')},
                ${userId ?? 'system'})
      `);
      renewed++;
    }
    res.json({ ok: true, renewed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /api/ai-credits/deduct  (internal — called by callAI) ── */
router.post("/ai-credits/deduct", requireAuth, async (req, res) => {
  await ensureTables();
  try {
    const { officeId = "default", model = "gemini", cost = 1 } = req.body;
    const credit = await one(sql`SELECT balance FROM office_ai_credits WHERE office_id = ${officeId}`);
    const balance = credit?.balance ?? 0;
    if (balance < cost) return res.status(402).json({ error: "رصيد غير كافٍ", balance });
    await db.execute(sql`
      UPDATE office_ai_credits SET balance = balance - ${cost}, updated_at = NOW()
      WHERE office_id = ${officeId}
    `);
    await db.execute(sql`
      INSERT INTO ai_credit_transactions (office_id, amount, type, description, model)
      VALUES (${officeId}, ${-cost}, 'usage', ${'استخدام AI - ' + model}, ${model})
    `);
    res.json({ ok: true, balance: balance - cost });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /api/office/ai-credits  (for office users to check their balance) ── */
router.get("/office/ai-credits", requireAuth, async (_req, res) => {
  await ensureTables();
  try {
    const credit = await one(sql`SELECT * FROM office_ai_credits WHERE office_id = 'default'`);
    if (!credit) return res.json({ balance: 0, monthly_allowance: 100, auto_renew: true });
    const usedThisMonth = await one(sql`
      SELECT COALESCE(SUM(ABS(amount)), 0)::int AS used
      FROM ai_credit_transactions
      WHERE office_id = 'default' AND type = 'usage'
        AND created_at >= date_trunc('month', NOW())
    `);
    res.json({ ...credit, used_this_month: usedThisMonth?.used ?? 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /admin/ai-credits/add-office ── register new office ── */
router.post("/admin/ai-credits/add-office", adminOnly, async (req, res) => {
  await ensureTables();
  try {
    const { officeId, officeName, monthlyAllowance = 100 } = req.body;
    if (!officeId || !officeName) return res.status(400).json({ error: "المعرف والاسم مطلوبان" });
    await db.execute(sql`
      INSERT INTO office_ai_credits (office_id, office_name, monthly_allowance, balance)
      VALUES (${officeId}, ${officeName}, ${monthlyAllowance}, ${monthlyAllowance})
      ON CONFLICT (office_id) DO NOTHING
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
