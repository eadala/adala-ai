/**
 * Self-Healing Routes — 6 endpoints
 */
import { Router } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import { detectAnomalies } from "../healing/anomaly.detector";
import { runSelfHealingCycle, getHealingStats, getLastSafeState } from "../healing/self.healer";
import { isQueryThrottleActive } from "../healing/recovery.actions";
import { getSystemState } from "../hardening/production.lock";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function guard(req: any, res: any, next: any) {
  const meta = (req as any).auth?.sessionClaims?.publicMetadata as any;
  if (meta?.role !== "super_admin") return res.status(403).json({ error: "super_admin only" });
  next();
}

/* ── GET /healing/status ── حالة الإصلاح الذاتي ── */
router.get("/healing/status", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const [detection, stats] = await Promise.all([
      detectAnomalies(),
      getHealingStats(),
    ]);
    res.json({
      system:    getSystemState(),
      anomalies: detection.anomalies,
      healthScore: detection.healthScore,
      dbLatencyMs: detection.dbLatencyMs,
      queryThrottleActive: isQueryThrottleActive(),
      lastSafeState: getLastSafeState(),
      stats:     stats.last24h,
      bySeverity: stats.bySeverity,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /healing/run ── تشغيل دورة إصلاح يدوي ── */
router.post("/healing/run", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const result = await runSelfHealingCycle();
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /healing/events ── سجل أحداث الإصلاح ── */
router.get("/healing/events", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const sev    = req.query.severity as string | undefined;
    const rows   = await db.execute(sql`
      SELECT id, anomaly_type, severity, action_taken, action_result,
             detail, verified, duration_ms, metrics, created_at
      FROM heal_events
      ${sev ? sql`WHERE severity = ${sev}` : sql``}
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    const stats = await getHealingStats();
    res.json({ events: rows.rows ?? rows, stats: stats.last24h, bySeverity: stats.bySeverity });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /healing/safe-state ── آخر حالة مستقرة ── */
router.get("/healing/safe-state", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const inMemory = getLastSafeState();
    const rows     = await db.execute(sql`
      SELECT version, health_score, metrics, is_stable, created_at
      FROM safe_state_snapshots ORDER BY created_at DESC LIMIT 10
    `);
    res.json({ current: inMemory, history: rows.rows ?? rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /healing/anomalies ── فحص الأعطال فقط ── */
router.get("/healing/anomalies", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const result = await detectAnomalies();
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /healing/rules ── قواعد الإصلاح ── */
router.get("/healing/rules", requireAuthWithTenant, guard, (_req, res) => {
  res.json({
    rules: [
      { trigger: "tenant_leak_detected",  action: "ENFORCE_ISOLATION_ALERT + ACTIVATE_SAFE_MODE", autoHeal: true,  severity: "critical" },
      { trigger: "error_rate_critical",   action: "ACTIVATE_SAFE_MODE",                           autoHeal: true,  severity: "critical" },
      { trigger: "memory_critical",       action: "ACTIVATE_SAFE_MODE",                           autoHeal: true,  severity: "critical" },
      { trigger: "db_latency_critical",   action: "FLUSH_SLOW_QUERIES (15 min throttle)",         autoHeal: true,  severity: "critical" },
      { trigger: "db_latency_high",       action: "FLUSH_SLOW_QUERIES (15 min throttle)",         autoHeal: true,  severity: "high"     },
      { trigger: "error_rate_high",       action: "FLUSH_SLOW_QUERIES",                           autoHeal: true,  severity: "high"     },
      { trigger: "stripe_failure_spike",  action: "LOG_STRIPE_RETRY_NEEDED",                      autoHeal: true,  severity: "critical" },
      { trigger: "stripe_failures_high",  action: "يدوي — مراجعة مطلوبة",                        autoHeal: false, severity: "high"     },
      { trigger: "orphan_ledger_entries", action: "يدوي — مراجعة مالية مطلوبة",                  autoHeal: false, severity: "high"     },
      { trigger: "memory_high",           action: "يدوي — مراقبة مطلوبة",                        autoHeal: false, severity: "high"     },
      { trigger: "system_in_safe_mode",   action: "RESTORE_STABLE_MODE إذا انتهت المشاكل",        autoHeal: true,  severity: "medium"   },
    ],
    forbidden: [
      "تغيير business logic",
      "تعديل Financial rules",
      "تعديل DB schema",
      "تعديل Stripe configuration",
      "إنشاء tables جديدة",
      "كتابة كود جديد",
    ],
  });
});

export default router;
