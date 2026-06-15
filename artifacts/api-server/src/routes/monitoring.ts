import { Router } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import { systemHealthCheck } from "../observability/healthcheck";
import { collectMetrics } from "../observability/metrics";
import { detectAnomalies } from "../observability/anomaly.detector";
import { runAutoHealer } from "../healing/auto.healer";
import { sendAlert, getRecentAlerts, simulate } from "../monitoring/alerts";
import { getPendingRecoveries, recoverWorkflow } from "../recovery/workflow.recovery";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function isSuperAdmin(req: any): boolean {
  const meta = req.auth?.sessionClaims?.publicMetadata as any;
  return meta?.role === "super_admin";
}

function guard(req: any, res: any, next: any) {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "Super admin only" });
  next();
}

/* ─── GET /api/monitoring/health ─── */
router.get("/monitoring/health", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const health = await systemHealthCheck();
    res.json(health);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/monitoring/metrics ─── */
router.get("/monitoring/metrics", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const metrics = await collectMetrics();
    const anomalies = detectAnomalies(metrics);
    res.json({ metrics, anomalies });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /api/monitoring/heal ─── */
router.post("/monitoring/heal", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const results = await runAutoHealer();
    res.json({ results, healed: results.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/monitoring/events ─── */
router.get("/monitoring/events", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db.execute(sql`
      SELECT * FROM healing_events
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    res.json({ events: rows.rows ?? rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/monitoring/metrics-log ─── */
router.get("/monitoring/metrics-log", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 60, 300);
    const rows = await db.execute(sql`
      SELECT * FROM system_metrics_log
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    res.json({ log: rows.rows ?? rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/monitoring/alerts ─── */
router.get("/monitoring/alerts", requireAuthWithTenant, guard, (_req, res) => {
  res.json({ alerts: getRecentAlerts(100) });
});

/* ─── GET /api/monitoring/recovery ─── */
router.get("/monitoring/recovery", requireAuthWithTenant, guard, (_req, res) => {
  res.json({ pending: getPendingRecoveries() });
});

/* ─── POST /api/monitoring/recovery/:id ─── */
router.post("/monitoring/recovery/:id", requireAuthWithTenant, guard, async (req, res) => {
  const result = await recoverWorkflow(String(req.params.id));
  res.json(result);
});

/* ─── POST /api/monitoring/simulate ─── */
router.post("/monitoring/simulate", requireAuthWithTenant, guard, async (req, res) => {
  try {
    await simulate(req.body ?? {});
    res.json({ ok: true, message: "Simulation injected" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /api/monitoring/alert ─── */
router.post("/monitoring/alert", requireAuthWithTenant, guard, async (req, res) => {
  const { severity = "medium", message = "Manual alert" } = req.body ?? {};
  await sendAlert(severity, message);
  res.json({ ok: true });
});

export default router;
