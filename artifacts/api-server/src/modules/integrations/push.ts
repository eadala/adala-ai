/**
 * Push Notification Routes
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getVapidPublicKey, sendPush } from "../../lib/webPush";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";

const router = Router();

function tenantIdOf(req: Request): string | null {
  const tid = (req as any).tenantId as string | undefined;
  if (!tid || tid === "default" || tid === "platform" || tid === "unknown") return null;
  return tid;
}

/* ── GET /api/push/vapid-public-key ── */
router.get("/push/vapid-public-key", (_req: Request, res: Response) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(503).json({ error: "VAPID not initialized yet" });
  res.json({ publicKey: key });
});

/* ── POST /api/push/subscribe ── */
router.post("/push/subscribe", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const userId = String((req as any).auth?.userId ?? (req as any).userId ?? "");
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── DELETE /api/push/unsubscribe ── */
router.delete("/push/unsubscribe", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const userId = String((req as any).auth?.userId ?? (req as any).userId ?? "");
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "endpoint مطلوب" });
    await db.execute(sql`
      DELETE FROM push_subscriptions
      WHERE endpoint = ${endpoint}
        AND office_id = ${officeId}
        AND user_id = ${userId}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /api/push/test — send test push to current user ── */
router.post("/push/test", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const userId = String((req as any).auth?.userId ?? (req as any).userId ?? "");
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const rows = await db.execute(sql`
      SELECT endpoint, p256dh, auth_key FROM push_subscriptions
      WHERE office_id = ${officeId} AND user_id = ${userId}
      LIMIT 10
    `);
    const subs = ((rows as any).rows ?? rows ?? []) as any[];
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/push/status ── */
router.get("/push/status", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const userId = String((req as any).auth?.userId ?? (req as any).userId ?? "");
    const count  = await db.execute(sql`
      SELECT COUNT(*) as c FROM push_subscriptions
      WHERE user_id = ${userId} AND office_id = ${officeId}
    `);
    const subscribed = Number((((count as any).rows?.[0] ?? (count as any)[0]) as any)?.c ?? 0) > 0;
    res.json({ subscribed, vapidPublicKey: getVapidPublicKey() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
