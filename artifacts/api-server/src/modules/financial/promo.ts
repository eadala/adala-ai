import { requireAuth, requireSuperAdmin as adminOnly } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();


async function sqlAll(q: any) {
  const result = await db.execute(q);
  return (result.rows ?? result) as any[];
}
async function sqlOne(q: any) {
  const rows = await sqlAll(q);
  return rows[0] ?? null;
}

/* ──────────────────────────────────────────────
   ADMIN — PROMO CODES
────────────────────────────────────────────── */

/* GET /admin/promo-codes */
router.get("/admin/promo", adminOnly, async (req, res) => {

  try {
    const rows = await sqlAll(sql`
      SELECT id, code, plan_slug, duration_days, max_uses, used_count, notes, expires_at, is_active, created_at
      FROM promo_codes ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/promo-codes */
router.post("/admin/promo", adminOnly, async (req, res) => {

  try {
    const { code, plan_slug, duration_days, max_uses, notes, expires_at } = req.body;
    if (!code || !plan_slug || !duration_days) return res.status(400).json({ error: "بيانات ناقصة" });
    const upper = String(code).toUpperCase().trim();
    const row = await sqlOne(sql`
      INSERT INTO promo_codes (code, plan_slug, duration_days, max_uses, notes, expires_at)
      VALUES (${upper}, ${plan_slug}, ${Number(duration_days)}, ${Number(max_uses ?? 1)},
              ${notes ?? null}, ${expires_at ? new Date(expires_at).toISOString() : null})
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) {
    if (e.message?.includes("unique")) return res.status(400).json({ error: "هذا الكود موجود مسبقاً" });
    res.status(500).json({ error: e.message });
  }
});

/* PATCH /admin/promo-codes/:id */
router.patch("/admin/promo/:id", adminOnly, async (req, res) => {

  try {
    const { id } = req.params as Record<string, string>;
    const { is_active, notes, max_uses, expires_at } = req.body;
    await db.execute(sql`
      UPDATE promo_codes SET
        is_active  = COALESCE(${is_active ?? null}, is_active),
        notes      = COALESCE(${notes ?? null}, notes),
        max_uses   = COALESCE(${max_uses != null ? Number(max_uses) : null}, max_uses),
        expires_at = COALESCE(${expires_at ? new Date(expires_at).toISOString() : null}, expires_at)
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /admin/promo-codes/:id */
router.delete("/admin/promo/:id", adminOnly, async (req, res) => {

  try {
    await db.execute(sql`DELETE FROM promo_codes WHERE id = ${String(req.params.id)}`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ──────────────────────────────────────────────
   ADMIN — GIFT SUBSCRIPTIONS
────────────────────────────────────────────── */

/* GET /admin/gift-subscriptions */
router.get("/admin/gift", adminOnly, async (req, res) => {

  try {
    const rows = await sqlAll(sql`
      SELECT gs.*, pc.code AS promo_code_text
      FROM gift_subscriptions gs
      LEFT JOIN promo_codes pc ON pc.id = gs.promo_code_id
      ORDER BY gs.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/gift-subscriptions — create directly without a code */
router.post("/admin/gift", adminOnly, async (req, res) => {

  try {
    const { plan_slug, duration_days, notes } = req.body;
    if (!plan_slug || !duration_days) return res.status(400).json({ error: "بيانات ناقصة" });
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + Number(duration_days));
    const row = await sqlOne(sql`
      INSERT INTO gift_subscriptions (plan_slug, end_date, notes)
      VALUES (${plan_slug}, ${endDate.toISOString()}, ${notes ?? null})
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/gift-subscriptions/:id/renew */
router.post("/admin/gift/:id/renew", adminOnly, async (req, res) => {

  try {
    const { days } = req.body;
    if (!days || Number(days) < 1) return res.status(400).json({ error: "حدد عدد الأيام" });
    const row = await sqlOne(sql`
      UPDATE gift_subscriptions
      SET end_date      = GREATEST(end_date, NOW()) + (${Number(days)} || ' days')::INTERVAL,
          status        = 'active',
          renewed_count = renewed_count + 1
      WHERE id = ${String(req.params.id)}
      RETURNING *
    `);
    if (!row) return res.status(404).json({ error: "غير موجود" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /admin/gift-subscriptions/:id/cancel */
router.patch("/admin/gift/:id/cancel", adminOnly, async (req, res) => {

  try {
    await db.execute(sql`UPDATE gift_subscriptions SET status = 'cancelled' WHERE id = ${String(req.params.id)}`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ──────────────────────────────────────────────
   OFFICE — REDEEM & MY GIFT
────────────────────────────────────────────── */

/* POST /promo/redeem */
router.post("/promo/redeem", requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "أدخل الكود" });
    const upper = String(code).toUpperCase().trim();

    const promo = await sqlOne(sql`
      SELECT * FROM promo_codes
      WHERE code = ${upper}
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
        AND used_count < max_uses
    `);
    if (!promo) return res.status(400).json({ error: "الكود غير صالح أو منتهي الصلاحية" });

    const existing = await sqlOne(sql`
      SELECT id FROM gift_subscriptions
      WHERE status = 'active' AND end_date > NOW()
    `);
    if (existing) return res.status(400).json({ error: "لديك اشتراك مجاني نشط بالفعل" });

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + Number(promo.duration_days));

    const gift = await sqlOne(sql`
      INSERT INTO gift_subscriptions (promo_code_id, plan_slug, end_date, notes)
      VALUES (${promo.id}, ${promo.plan_slug}, ${endDate.toISOString()}, ${'تم الاسترداد بكود: ' + upper})
      RETURNING *
    `);

    await db.execute(sql`
      UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ${promo.id}
    `);

    res.json({ ok: true, gift, planSlug: promo.plan_slug, endsAt: endDate.toISOString() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /promo/my-gift */
router.get("/promo/my-gift", requireAuth, async (_req, res) => {
  try {
    const row = await sqlOne(sql`
      SELECT gs.*, pc.code AS promo_code_text
      FROM gift_subscriptions gs
      LEFT JOIN promo_codes pc ON pc.id = gs.promo_code_id
      WHERE gs.status = 'active' AND gs.end_date > NOW()
      ORDER BY gs.end_date DESC LIMIT 1
    `);
    res.json(row ?? null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
