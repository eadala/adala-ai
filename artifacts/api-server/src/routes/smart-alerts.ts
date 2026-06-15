/**
 * Smart Alerts Routes
 */
import { Router, type Request, type Response } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import {
  sendSmartAlert,
  getLiveAlerts,
  acknowledgeAlert,
  acknowledgeAll,
  getAlertStats,
  setSuppressedMode,
  clearSuppression,
  checkTrendAlerts,
} from "../alerts/smart.alerts";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function guard(req: any, res: any, next: any) {
  const meta = req.auth?.sessionClaims?.publicMetadata as any;
  if (meta?.role !== "super_admin") {
    return res.status(403).json({ error: "super_admin only" });
  }
  next();
}

/* ─── GET /api/smart-alerts/feed ─── التنبيهات الحية ─── */
router.get("/smart-alerts/feed", requireAuthWithTenant, guard, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  res.json({ alerts: getLiveAlerts(limit) });
});

/* ─── GET /api/smart-alerts/stats ─── الإحصائيات ─── */
router.get("/smart-alerts/stats", requireAuthWithTenant, guard, (_req, res) => {
  res.json(getAlertStats());
});

/* ─── GET /api/smart-alerts/history ─── من قاعدة البيانات ─── */
router.get("/smart-alerts/history", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const severity = req.query.severity as string | undefined;

    const rows = await db.execute(sql`
      SELECT id, severity, message, metadata, resolved, created_at
      FROM healing_events
      WHERE event_type = 'ALERT'
        ${severity ? sql`AND severity = ${severity}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    res.json({ history: rows.rows ?? rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /api/smart-alerts/acknowledge/:id ─── اعتراف ─── */
router.post("/smart-alerts/acknowledge/:id", requireAuthWithTenant, guard, async (req, res) => {
  const id = String(req.params.id);
  const ok = acknowledgeAlert(id);

  /* حاول تحديث DB أيضاً (إذا كان id رقمياً) */
  if (/^\d+$/.test(id)) {
    await db.execute(sql`
      UPDATE healing_events SET resolved = true WHERE id = ${Number(id)} AND event_type = 'ALERT'
    `).catch(() => {});
  }
  res.json({ ok });
});

/* ─── POST /api/smart-alerts/acknowledge-all ─── اعتراف بالكل ─── */
router.post("/smart-alerts/acknowledge-all", requireAuthWithTenant, guard, async (_req, res) => {
  acknowledgeAll();
  await db.execute(sql`
    UPDATE healing_events SET resolved = true WHERE event_type = 'ALERT' AND resolved = false
  `).catch(() => {});
  res.json({ ok: true });
});

/* ─── POST /api/smart-alerts/suppress ─── وضع صامت ─── */
router.post("/smart-alerts/suppress", requireAuthWithTenant, guard, (req, res) => {
  const minutes = Math.min(Number(req.body?.minutes) || 30, 480);
  setSuppressedMode(minutes * 60 * 1000);
  res.json({ ok: true, suppressedUntil: new Date(Date.now() + minutes * 60_000).toISOString() });
});

/* ─── POST /api/smart-alerts/unsuppress ─── إلغاء الصمت ─── */
router.post("/smart-alerts/unsuppress", requireAuthWithTenant, guard, (_req, res) => {
  clearSuppression();
  res.json({ ok: true });
});

/* ─── POST /api/smart-alerts/check-trends ─── فحص اتجاهات ─── */
router.post("/smart-alerts/check-trends", requireAuthWithTenant, guard, async (_req, res) => {
  await checkTrendAlerts();
  res.json({ ok: true, checkedAt: new Date().toISOString() });
});

/* ─── POST /api/smart-alerts/test ─── اختبار التسليم ─── */
router.post("/smart-alerts/test", requireAuthWithTenant, guard, async (req, res) => {
  const severity = (req.body?.severity ?? "medium") as any;
  const message = req.body?.message ?? "🧪 تنبيه اختباري من نظام عدالة AI";
  const result = await sendSmartAlert(severity, message, { forceSkipDedup: true });
  res.json({ ...result, severity, message });
});

/* ─── GET /api/smart-alerts/channels ─── حالة القنوات ─── */
router.get("/smart-alerts/channels", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const telegram = await db.execute(sql`
      SELECT office_id, enabled, chat_id IS NOT NULL as has_chat, notify_system_alerts
      FROM telegram_settings
      WHERE bot_token IS NOT NULL
    `);
    const rows = (telegram.rows ?? telegram) as any[];
    res.json({
      channels: {
        telegram: {
          configured: rows.length > 0,
          activeCount: rows.filter((r: any) => r.enabled).length,
          systemAlertsEnabled: rows.some((r: any) => r.notify_system_alerts),
          offices: rows,
        },
        email: { configured: false, note: "قريباً" },
        inApp:  { configured: true,  note: "دائماً نشط" },
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
