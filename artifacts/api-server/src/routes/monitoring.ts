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

/* ─── GET /api/monitoring/stripe-check ─── read-only Stripe event audit ─── */
router.get("/monitoring/stripe-check", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const [total, recent, dupes, ledger] = await Promise.all([
      /* Total stripe events */
      db.execute(sql`SELECT COUNT(*) as total FROM stripe_events`),
      /* Events last 24h */
      db.execute(sql`
        SELECT type, COUNT(*) as cnt
        FROM stripe_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY type ORDER BY cnt DESC LIMIT 10
      `),
      /* Duplicate stripe_event_id check */
      db.execute(sql`
        SELECT stripe_event_id, COUNT(*) as cnt
        FROM stripe_events
        GROUP BY stripe_event_id
        HAVING COUNT(*) > 1
        LIMIT 10
      `),
      /* Ledger vs revenue mismatch */
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM office_ledger) as ledger_rows,
          (SELECT COALESCE(SUM(net_amount),0) FROM office_ledger) as ledger_total,
          (SELECT COUNT(*) FROM stripe_events WHERE type='checkout.session.completed') as sessions
      `),
    ]);

    const dupeRows = (dupes.rows ?? dupes) as any[];
    const recentRows = (recent.rows ?? recent) as any[];
    const ledgerRow = ((ledger.rows ?? ledger) as any[])[0] ?? {};
    const totalRow  = ((total.rows ?? total) as any[])[0] ?? {};

    res.json({
      totalEvents: Number(totalRow.total ?? 0),
      last24h: recentRows,
      duplicates: dupeRows,
      duplicateCount: dupeRows.length,
      ledger: {
        rows: Number(ledgerRow.ledger_rows ?? 0),
        totalNet: Number(ledgerRow.ledger_total ?? 0),
        completedSessions: Number(ledgerRow.sessions ?? 0),
      },
      health: dupeRows.length === 0 ? "green" : "yellow",
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/monitoring/db-integrity ─── read-only orphan/integrity check ─── */
router.get("/monitoring/db-integrity", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const [orphanDocs, orphanTasks, orphanTimeline, tableCount, dbSize] = await Promise.all([
      /* Documents with no matching case */
      db.execute(sql`
        SELECT COUNT(*) as cnt FROM documents d
        WHERE d.case_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = d.case_id)
      `),
      /* Tasks with no matching case */
      db.execute(sql`
        SELECT COUNT(*) as cnt FROM tasks t
        WHERE t.case_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM cases c WHERE c.id::text = t.case_id::text)
      `),
      /* Timeline events with no matching case */
      db.execute(sql`
        SELECT COUNT(*) as cnt FROM case_timeline ct
        WHERE NOT EXISTS (SELECT 1 FROM cases c WHERE c.id = ct.case_id)
      `).catch(() => ({ rows: [{ cnt: 0 }] })),
      /* Total table count */
      db.execute(sql`
        SELECT COUNT(*) as cnt
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `),
      /* DB size */
      db.execute(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `),
    ]);

    const get = (r: any) => Number(((r.rows ?? r) as any[])[0]?.cnt ?? 0);

    const orphans = {
      documents: get(orphanDocs),
      tasks: get(orphanTasks),
      timeline: get(orphanTimeline),
    };
    const totalOrphans = Object.values(orphans).reduce((a, b) => a + b, 0);

    res.json({
      orphans,
      totalOrphans,
      tableCount: get(tableCount),
      dbSize: ((dbSize.rows ?? dbSize) as any[])[0]?.size ?? "unknown",
      health: totalOrphans === 0 ? "green" : totalOrphans < 10 ? "yellow" : "red",
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/monitoring/alerts-log ─── historical alerts from DB ─── */
router.get("/monitoring/alerts-log", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db.execute(sql`
      SELECT id, severity, message, created_at
      FROM healing_events
      WHERE event_type = 'ALERT'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    res.json({ alerts: rows.rows ?? rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/monitoring/metrics-history ─── sparkline data ─── */
router.get("/monitoring/metrics-history", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 120);
    const rows = await db.execute(sql`
      SELECT health_score, error_rate, db_latency, memory_used, memory_total, created_at
      FROM system_metrics_log
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    const data = ((rows.rows ?? rows) as any[]).reverse();
    res.json({ history: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
