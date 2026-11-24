import { requireAuthWithTenant, requireSuperAdmin as adminOnly } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  giftOwnerHttpStatus,
  resolveGiftOwner,
  TenantResolutionError,
} from "../../lib/giftOwnership";
import { assertCanonicalBusinessOfficeId } from "../../lib/tenantResolution";

const router = Router();

type SqlRow = Record<string, unknown>;

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function sqlAll(q: ReturnType<typeof sql>): Promise<SqlRow[]> {
  const result = await db.execute(q);
  const withRows = result as { rows?: SqlRow[] };
  return (withRows.rows ?? (result as unknown as SqlRow[])) as SqlRow[];
}
async function sqlOne(q: ReturnType<typeof sql>): Promise<SqlRow | null> {
  const rows = await sqlAll(q);
  return rows[0] ?? null;
}

/* ──────────────────────────────────────────────
   ADMIN — PROMO CODES
────────────────────────────────────────────── */

/* GET /admin/promo-codes */
router.get("/admin/promo", adminOnly, async (_req, res) => {

  try {
    const rows = await sqlAll(sql`
      SELECT id, code, plan_slug, duration_days, max_uses, used_count, notes, expires_at, is_active, created_at
      FROM promo_codes ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
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
  } catch (e: unknown) {
    if (errMessage(e).includes("unique")) return res.status(400).json({ error: "هذا الكود موجود مسبقاً" });
    res.status(500).json({ error: errMessage(e) });
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
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
});

/* DELETE /admin/promo-codes/:id */
router.delete("/admin/promo/:id", adminOnly, async (req, res) => {

  try {
    await db.execute(sql`DELETE FROM promo_codes WHERE id = ${String(req.params.id)}`);
    res.json({ ok: true });
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
});

/* ──────────────────────────────────────────────
   ADMIN — GIFT SUBSCRIPTIONS
────────────────────────────────────────────── */

/* GET /admin/gift-subscriptions */
router.get("/admin/gift", adminOnly, async (_req, res) => {

  try {
    const rows = await sqlAll(sql`
      SELECT gs.*, pc.code AS promo_code_text
      FROM gift_subscriptions gs
      LEFT JOIN promo_codes pc ON pc.id = gs.promo_code_id
      ORDER BY gs.created_at DESC
    `);
    res.json(rows);
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
});

/* POST /admin/gift-subscriptions — create directly without a code (must set ownership) */
router.post("/admin/gift", adminOnly, async (req, res) => {

  try {
    const { plan_slug, duration_days, notes, office_id, user_id } = req.body;
    if (!plan_slug || !duration_days || !office_id || !user_id) {
      return res.status(400).json({ error: "بيانات ناقصة — plan_slug و duration_days و office_id و user_id مطلوبة" });
    }
    const ownerUserId = String(user_id).trim();
    if (!ownerUserId) return res.status(400).json({ error: "user_id مطلوب" });
    let officeId: string;
    try {
      officeId = assertCanonicalBusinessOfficeId(office_id, {
        userId: ownerUserId,
        source: "POST /admin/gift",
      });
    } catch (err: unknown) {
      if (err instanceof TenantResolutionError) {
        return res.status(giftOwnerHttpStatus(err)).json({ error: err.message, code: err.code });
      }
      throw err;
    }
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + Number(duration_days));
    const row = await sqlOne(sql`
      INSERT INTO gift_subscriptions (office_id, user_id, plan_slug, end_date, notes)
      VALUES (${officeId}::uuid, ${ownerUserId}, ${plan_slug}, ${endDate.toISOString()}, ${notes ?? null})
      RETURNING *
    `);
    res.json(row);
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
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
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
});

/* PATCH /admin/gift-subscriptions/:id/cancel */
router.patch("/admin/gift/:id/cancel", adminOnly, async (req, res) => {

  try {
    await db.execute(sql`UPDATE gift_subscriptions SET status = 'cancelled' WHERE id = ${String(req.params.id)}`);
    res.json({ ok: true });
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
});

/* ──────────────────────────────────────────────
   OFFICE — REDEEM & MY GIFT
────────────────────────────────────────────── */

/* POST /promo/redeem */
router.post("/promo/redeem", requireAuthWithTenant, async (req, res) => {
  try {
    let officeId: string;
    let userId: string;
    try {
      ({ officeId, userId } = resolveGiftOwner(
        {
          userId: (req as { userId?: string }).userId,
          tenantId: (req as { tenantId?: string }).tenantId,
        },
        "POST /promo/redeem",
      ));
    } catch (err: unknown) {
      const status = giftOwnerHttpStatus(err);
      const e = err as { message?: string; code?: string };
      return res.status(status).json({ error: e.message ?? "لا يمكن تحديد ملكية الهدية", code: e.code });
    }

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
        AND office_id = ${officeId}::uuid
        AND user_id = ${userId}
    `);
    if (existing) return res.status(400).json({ error: "لديك اشتراك مجاني نشط بالفعل" });

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + Number(promo.duration_days));

    const gift = await sqlOne(sql`
      INSERT INTO gift_subscriptions (office_id, user_id, promo_code_id, plan_slug, end_date, notes)
      VALUES (
        ${officeId}::uuid,
        ${userId},
        ${promo.id},
        ${promo.plan_slug},
        ${endDate.toISOString()},
        ${'تم الاسترداد بكود: ' + upper}
      )
      RETURNING *
    `);

    await db.execute(sql`
      UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ${promo.id}
    `);

    res.json({ ok: true, gift, planSlug: promo.plan_slug, endsAt: endDate.toISOString() });
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
});

/* GET /promo/my-gift */
router.get("/promo/my-gift", requireAuthWithTenant, async (req, res) => {
  try {
    let officeId: string;
    let userId: string;
    try {
      ({ officeId, userId } = resolveGiftOwner(
        {
          userId: (req as { userId?: string }).userId,
          tenantId: (req as { tenantId?: string }).tenantId,
        },
        "GET /promo/my-gift",
      ));
    } catch (err: unknown) {
      const status = giftOwnerHttpStatus(err);
      const e = err as { message?: string; code?: string };
      return res.status(status).json({ error: e.message ?? "لا يمكن تحديد ملكية الهدية", code: e.code });
    }

    const row = await sqlOne(sql`
      SELECT gs.*, pc.code AS promo_code_text
      FROM gift_subscriptions gs
      LEFT JOIN promo_codes pc ON pc.id = gs.promo_code_id
      WHERE gs.status = 'active' AND gs.end_date > NOW()
        AND gs.office_id = ${officeId}::uuid
        AND gs.user_id = ${userId}
      ORDER BY gs.end_date DESC LIMIT 1
    `);
    res.json(row ?? null);
  } catch (e: unknown) { res.status(500).json({ error: errMessage(e) }); }
});

export default router;
