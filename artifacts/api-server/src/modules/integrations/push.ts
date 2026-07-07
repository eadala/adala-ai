/**
 * Push Notification Routes
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getVapidPublicKey, sendPushToOffice, sendPush } from "../../lib/webPush";
import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { getRequiredTenantId, TenantRequiredError, tenantRequiredResponse } from "../../core/tenantContext";

const router = Router();

/* ── GET /api/push/vapid-public-key ── */
router.get("/push/vapid-public-key", (_req: Request, res: Response) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: "VAPID not initialized yet" });
  res.json({ publicKey: key });
});

/* ── POST /api/push/subscribe ── */
router.post("/push/subscribe", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId   = auth?.userId ?? "anonymous";
    const officeId = getRequiredTenantId(req);
    const { endpoint, keys } = req.body.subscription ?? req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "بيانات الاشتراك غير مكتملة" });
    }

    await db.execute(sql`
      INSERT INTO push_subscriptions (user_id, office_id, endpoint, p256dh, auth_key, user_agent)
      VALUES (${userId}, ${officeId}, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${req.headers["user-agent"] ?? null})
      ON CONFLICT (endpoint) DO UPDATE
        SET user_id   = EXCLUDED.user_id,
            office_id = EXCLUDED.office_id,
            p256dh    = EXCLUDED.p256dh,
            auth_key  = EXCLUDED.auth_key
    `);

    /* Send welcome push */
    await sendPush(endpoint, keys.p256dh, keys.auth, {
      title: "عدالة AI 🎉",
      body:  "تم تفعيل الإشعارات بنجاح! ستصلك التنبيهات فور حدوثها.",
      url:   "/dashboard",
      tag:   "welcome",
    }).catch(() => {});

    res.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof TenantRequiredError) {
      return res.status(403).json(tenantRequiredResponse());
    }
    res.status(500).json({ error: (e as Error).message });
  }
});

/* ── DELETE /api/push/unsubscribe ── */
router.delete("/push/unsubscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "endpoint مطلوب" });
    await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`);
    res.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof TenantRequiredError) {
      return res.status(403).json(tenantRequiredResponse());
    }
    res.status(500).json({ error: (e as Error).message });
  }
});

/* ── POST /api/push/test — send test push to current user ── */
router.post("/push/test", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId   = auth?.userId ?? "anonymous";
    const officeId = getRequiredTenantId(req);

    const rows = await db.execute(sql`
      SELECT endpoint, p256dh, auth_key FROM push_subscriptions
      WHERE user_id = ${userId} AND office_id = ${officeId}
      LIMIT 10
    `);
    const subs = rows.rows as any[];
    if (!subs.length) return res.status(404).json({ error: "لا توجد اشتراكات" });

    await Promise.allSettled(subs.map(s =>
      sendPush(s.endpoint, s.p256dh, s.auth_key, {
        title: "🧪 إشعار تجريبي",
        body:  "يعمل! الإشعارات مفعّلة وتصلك في الوقت الفعلي.",
        url:   "/activity-stream",
        tag:   "test",
      })
    ));
    res.json({ ok: true, sent: subs.length });
  } catch (e: unknown) {
    if (e instanceof TenantRequiredError) {
      return res.status(403).json(tenantRequiredResponse());
    }
    res.status(500).json({ error: (e as Error).message });
  }
});

/* ── GET /api/push/status ── */
router.get("/push/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const auth   = (req as any).auth;
    const userId = auth?.userId ?? "anonymous";
    const count  = await db.execute(sql`
      SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ${userId}
    `);
    const subscribed = Number((count.rows[0] as any)?.c ?? 0) > 0;
    res.json({ subscribed, vapidPublicKey: getVapidPublicKey() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
