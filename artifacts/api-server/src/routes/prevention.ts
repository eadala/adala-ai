/**
 * Prevention Routes — لوحة تحكم طبقة منع الانهيار
 * جميع المسارات محمية بـ super_admin
 */

import { Router } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import { circuitBreaker, CIRCUITS } from "../prevention/circuit.breaker";
import { evaluateRules, buildRuleContext, PREVENTION_RULES } from "../prevention/rules.engine";
import { runPreventionCheck } from "../prevention/request.guard";
import { getCounters } from "../prevention/prevention.log";
import { collectMetrics } from "../observability/metrics";
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

/* ─── GET /api/prevention/status ─── تقرير شامل ─── */
router.get("/prevention/status", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const [metrics, preventionResult] = await Promise.all([
      collectMetrics(),
      runPreventionCheck(),
    ]);

    const ctx = buildRuleContext({
      dbLatency:       metrics.dbLatency,
      memoryPercent:   metrics.memory.percent,
      webhookFailures: metrics.webhookFailures,
      errorRate:       metrics.errorRate,
      activeRequests:  metrics.activeRequests,
    });
    const { results } = evaluateRules(ctx);

    res.json({
      status: preventionResult.blocked ? "blocking" : preventionResult.throttled ? "throttling" : "normal",
      circuits: circuitBreaker.getStats(),
      triggeredRules: results,
      counters: getCounters(),
      metrics: {
        dbLatency:       metrics.dbLatency,
        memoryPercent:   metrics.memory.percent,
        webhookFailures: metrics.webhookFailures,
        errorRate:       metrics.errorRate,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/prevention/rules ─── قائمة القواعد ─── */
router.get("/prevention/rules", requireAuthWithTenant, guard, (_req, res) => {
  res.json({
    rules: PREVENTION_RULES.map(r => ({
      id:          r.id,
      condition:   r.condition,
      description: r.description,
      action:      r.action,
      severity:    r.severity,
    })),
    total: PREVENTION_RULES.length,
  });
});

/* ─── GET /api/prevention/circuits ─── حالة الدوائر ─── */
router.get("/prevention/circuits", requireAuthWithTenant, guard, (_req, res) => {
  res.json({
    circuits: circuitBreaker.getStats(),
    definitions: Object.entries(CIRCUITS).map(([name, key]) => ({ name, key })),
  });
});

/* ─── POST /api/prevention/circuits/:name/reset ─── إعادة ضبط دائرة ─── */
router.post("/prevention/circuits/:name/reset", requireAuthWithTenant, guard, (req, res) => {
  const name = String(req.params.name).toLowerCase();
  circuitBreaker.reset(name);
  res.json({ ok: true, circuit: name, state: "CLOSED" });
});

/* ─── POST /api/prevention/circuits/:name/open ─── فتح دائرة يدوياً ─── */
router.post("/prevention/circuits/:name/open", requireAuthWithTenant, guard, (req, res) => {
  const name = String(req.params.name).toLowerCase();
  /* نُضخ فشل كافٍ لفتح الدائرة */
  for (let i = 0; i < 20; i++) circuitBreaker.record(name, false);
  res.json({ ok: true, circuit: name, state: circuitBreaker.getState(name) });
});

/* ─── POST /api/prevention/run-check ─── تشغيل فحص يدوي ─── */
router.post("/prevention/run-check", requireAuthWithTenant, guard, async (_req, res) => {
  const result = await runPreventionCheck();
  res.json({ ...result, ranAt: new Date().toISOString() });
});

/* ─── GET /api/prevention/events ─── سجل أحداث المنع ─── */
router.get("/prevention/events", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db.execute(sql`
      SELECT id, severity, message, metadata, created_at
      FROM healing_events
      WHERE event_type = 'PREVENTION'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    res.json({ events: rows.rows ?? rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
