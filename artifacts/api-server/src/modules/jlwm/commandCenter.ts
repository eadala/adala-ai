/**
 * JLWM — AI Command Center
 * Natural language queries about the legal world + system orchestration.
 * Distinct from /ai-command-center (super-admin agents page).
 */

import { Router }                  from "express";
import { db }                      from "@workspace/db";
import { sql }                     from "drizzle-orm";
import { requireAuthWithTenant }   from "../../middlewares/requireAuth";
import { callJLWMAI }              from "./jlwmAI";
import { generateRecommendations } from "./recommendations";
import { generateRadarAlerts }     from "./recommendations";

const router = Router();

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/config
───────────────────────────────────────────────────────────── */
router.get("/jlwm/config", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_config WHERE office_id = ${officeId} LIMIT 1
    `);
    if (!rows.length) {
      /* Auto-create default config */
      const { rows: created } = await db.execute(sql`
        INSERT INTO jlwm_config (office_id) VALUES (${officeId})
        ON CONFLICT (office_id) DO UPDATE SET updated_at=NOW()
        RETURNING *
      `);
      return res.json(created[0]);
    }
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   PUT /jlwm/config
───────────────────────────────────────────────────────────── */
router.put("/jlwm/config", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { enabled, enabledModules, syncFrequency, aiModel } = req.body ?? {};

    await db.execute(sql`
      INSERT INTO jlwm_config (office_id, enabled, enabled_modules, sync_frequency, ai_model)
      VALUES (${officeId},
              ${enabled ?? true},
              ${enabledModules ? `{${enabledModules.join(",")}}` : "{memory_graph,world_state,command_center}"}::text[],
              ${syncFrequency ?? "hourly"},
              ${aiModel ?? "gemini"})
      ON CONFLICT (office_id)
      DO UPDATE SET
        enabled         = EXCLUDED.enabled,
        enabled_modules = EXCLUDED.enabled_modules,
        sync_frequency  = EXCLUDED.sync_frequency,
        ai_model        = EXCLUDED.ai_model,
        updated_at      = NOW()
      RETURNING *
    `);
    const { rows } = await db.execute(sql`SELECT * FROM jlwm_config WHERE office_id=${officeId}`);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/command/status — JLWM system status
───────────────────────────────────────────────────────────── */
router.get("/jlwm/command/status", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;

    const [memNodes, worldState, recommendations, radarAlerts, firmTwin, predictions] =
      await Promise.all([
        db.execute(sql`SELECT COUNT(*) AS c FROM jlwm_memory_nodes WHERE office_id=${officeId}`).catch(() => ({ rows: [{ c: 0 }] })),
        db.execute(sql`SELECT risk_level, computed_at FROM jlwm_world_states WHERE office_id=${officeId} ORDER BY computed_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
        db.execute(sql`SELECT COUNT(*) AS c FROM jlwm_recommendations WHERE office_id=${officeId} AND dismissed=FALSE AND (expires_at IS NULL OR expires_at > NOW())`).catch(() => ({ rows: [{ c: 0 }] })),
        db.execute(sql`SELECT COUNT(*) AS c FROM jlwm_radar_alerts WHERE office_id=${officeId} AND is_acknowledged=FALSE AND auto_resolved=FALSE`).catch(() => ({ rows: [{ c: 0 }] })),
        db.execute(sql`SELECT health_score, performance_score FROM jlwm_firm_twin WHERE office_id=${officeId} ORDER BY snapshot_date DESC LIMIT 1`).catch(() => ({ rows: [] })),
        db.execute(sql`SELECT COUNT(*) AS c FROM jlwm_predictions WHERE office_id=${officeId} AND (expires_at IS NULL OR expires_at > NOW())`).catch(() => ({ rows: [{ c: 0 }] })),
      ]);

    res.json({
      modules: {
        memory_graph:  { status: "active", nodes: Number((memNodes.rows[0] as any)?.c ?? 0) },
        world_state:   { status: worldState.rows.length ? "active" : "pending", lastComputed: (worldState.rows[0] as any)?.computed_at, riskLevel: (worldState.rows[0] as any)?.risk_level },
        recommendations:{ status: "active", count: Number((recommendations.rows[0] as any)?.c ?? 0) },
        radar:         { status: "active", activeAlerts: Number((radarAlerts.rows[0] as any)?.c ?? 0) },
        digital_twins: { status: "active", firmHealth: Number((firmTwin.rows[0] as any)?.health_score ?? 0) },
        predictions:   { status: "active", count: Number((predictions.rows[0] as any)?.c ?? 0) },
      },
      officeId,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/command/sessions
───────────────────────────────────────────────────────────── */
router.get("/jlwm/command/sessions", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { limit = "20" } = req.query as { limit?: string };
    const { rows } = await db.execute(sql`
      SELECT id, query, response, model_used, tokens_est, duration_ms, status, created_at
      FROM   jlwm_command_sessions
      WHERE  office_id = ${officeId}
      ORDER  BY created_at DESC
      LIMIT  ${Math.min(parseInt(limit, 10), 50)}
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/command/query — natural language legal world query
───────────────────────────────────────────────────────────── */
router.post("/jlwm/command/query", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "system";
    const { query } = req.body ?? {};
    if (!query?.trim()) return res.status(400).json({ error: "query مطلوب" });

    /* Create pending session */
    const { rows: sessionRows } = await db.execute(sql`
      INSERT INTO jlwm_command_sessions (office_id, user_id, query, status)
      VALUES (${officeId}, ${userId}, ${query}, 'pending')
      RETURNING id
    `);
    const sessionId = (sessionRows[0] as any)?.id;
    const start     = Date.now();

    /* Gather context */
    const [wsRows, firmRows, recRows, radarRows] = await Promise.all([
      db.execute(sql`SELECT risk_level, state_vector FROM jlwm_world_states WHERE office_id=${officeId} ORDER BY computed_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
      db.execute(sql`SELECT health_score, performance_score, monthly_revenue, win_rate_pct FROM jlwm_firm_twin WHERE office_id=${officeId} ORDER BY snapshot_date DESC LIMIT 1`).catch(() => ({ rows: [] })),
      db.execute(sql`SELECT title, priority, category FROM jlwm_recommendations WHERE office_id=${officeId} AND dismissed=FALSE ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END LIMIT 5`).catch(() => ({ rows: [] })),
      db.execute(sql`SELECT title, severity, alert_type FROM jlwm_radar_alerts WHERE office_id=${officeId} AND is_acknowledged=FALSE LIMIT 5`).catch(() => ({ rows: [] })),
    ]);

    const context = {
      worldState: wsRows.rows[0],
      firmTwin:   firmRows.rows[0],
      topRecommendations: recRows.rows,
      activeAlerts: radarRows.rows,
    };

    const { reply, modelUsed, durationMs } = await callJLWMAI({
      task: "commandQuery", message: query, officeId, userId, context,
    });

    /* Update session */
    const estimatedTokens = Math.ceil((query.length + reply.length) / 4);
    await db.execute(sql`
      UPDATE jlwm_command_sessions
      SET response=${reply}, model_used=${modelUsed}, tokens_est=${estimatedTokens},
          duration_ms=${durationMs}, status='done'
      WHERE id=${sessionId}
    `).catch(() => {});

    res.json({ sessionId, query, response: reply, modelUsed, durationMs });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/command/action — trigger a system action
───────────────────────────────────────────────────────────── */
router.post("/jlwm/command/action", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "system";
    const { actionType } = req.body ?? {};

    const validActions = ["rebuild_graph","compute_state","generate_recommendations","generate_alerts","sync_twins"];
    if (!validActions.includes(actionType))
      return res.status(400).json({ error: "نوع الإجراء غير صالح" });

    const { rows: actionRows } = await db.execute(sql`
      INSERT INTO jlwm_command_actions (office_id, user_id, action_type, status)
      VALUES (${officeId}, ${userId}, ${actionType}, 'running')
      RETURNING id
    `);
    const actionId = (actionRows[0] as any)?.id;

    /* Run asynchronously — respond immediately */
    setImmediate(async () => {
      try {
        let result: any = {};

        if (actionType === "generate_recommendations") {
          const n = await generateRecommendations(officeId);
          result = { generated: n };
        } else if (actionType === "generate_alerts") {
          const n = await generateRadarAlerts(officeId);
          result = { generated: n };
        } else if (actionType === "compute_state") {
          /* Dynamic import to avoid circular deps */
          const { default: wsRouter } = await import("./worldState");
          result = { triggered: true };
        }

        await db.execute(sql`
          UPDATE jlwm_command_actions
          SET status='done', finished_at=NOW(), result=${JSON.stringify(result)}::jsonb
          WHERE id=${actionId}
        `).catch(() => {});
      } catch (err: any) {
        await db.execute(sql`
          UPDATE jlwm_command_actions
          SET status='error', finished_at=NOW(), error_msg=${err.message}
          WHERE id=${actionId}
        `).catch(() => {});
      }
    });

    res.json({ ok: true, actionId, status: "running" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/command/actions — action history
───────────────────────────────────────────────────────────── */
router.get("/jlwm/command/actions", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { rows } = await db.execute(sql`
      SELECT id, action_type, status, result, error_msg, started_at, finished_at
      FROM   jlwm_command_actions
      WHERE  office_id=${officeId}
      ORDER  BY started_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/predictions
───────────────────────────────────────────────────────────── */
router.get("/jlwm/predictions", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { type, limit = "20" } = req.query as { type?: string; limit?: string };
    const q = type
      ? sql`SELECT * FROM jlwm_predictions WHERE office_id=${officeId} AND prediction_type=${type} AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT ${parseInt(limit, 10)}`
      : sql`SELECT * FROM jlwm_predictions WHERE office_id=${officeId} AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY confidence_score DESC, created_at DESC LIMIT ${parseInt(limit, 10)}`;
    const { rows } = await db.execute(q);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/dashboard — aggregated dashboard data
───────────────────────────────────────────────────────────── */
router.get("/jlwm/dashboard", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;

    const [firmTwin, worldState, recommendations, radarAlerts, memStats, predictions] =
      await Promise.all([
        db.execute(sql`SELECT * FROM jlwm_firm_twin WHERE office_id=${officeId} ORDER BY snapshot_date DESC LIMIT 1`).catch(() => ({ rows: [] })),
        db.execute(sql`SELECT * FROM jlwm_world_states WHERE office_id=${officeId} ORDER BY computed_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
        db.execute(sql`SELECT * FROM jlwm_recommendations WHERE office_id=${officeId} AND dismissed=FALSE AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END LIMIT 5`).catch(() => ({ rows: [] })),
        db.execute(sql`SELECT * FROM jlwm_radar_alerts WHERE office_id=${officeId} AND is_acknowledged=FALSE AND auto_resolved=FALSE ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END LIMIT 5`).catch(() => ({ rows: [] })),
        db.execute(sql`SELECT COUNT(*) AS nodes, (SELECT COUNT(*) FROM jlwm_memory_edges WHERE office_id=${officeId}) AS edges FROM jlwm_memory_nodes WHERE office_id=${officeId}`).catch(() => ({ rows: [{ nodes: 0, edges: 0 }] })),
        db.execute(sql`SELECT COUNT(*) AS c FROM jlwm_predictions WHERE office_id=${officeId} AND (expires_at IS NULL OR expires_at > NOW())`).catch(() => ({ rows: [{ c: 0 }] })),
      ]);

    const ft  = firmTwin.rows[0]   as any ?? {};
    const ws  = worldState.rows[0] as any ?? {};
    const ms  = memStats.rows[0]   as any ?? {};

    res.json({
      firmHealthScore:   Number(ft.health_score    ?? 50),
      legalRiskScore:    ws.risk_level === "red" ? 90 : ws.risk_level === "orange" ? 65 : ws.risk_level === "yellow" ? 35 : 10,
      activeCases:       Number(ws.state_vector?.active_cases ?? 0),
      activeThreats:     (ws.active_threats?.items ?? []).length,
      winRate:           Number(ft.win_rate_pct    ?? 0),
      monthlyRevenue:    Number(ft.monthly_revenue ?? 0),
      revenueTrend:      Number(ft.revenue_trend   ?? 0),
      recommendations:   recommendations.rows,
      radarAlerts:       radarAlerts.rows,
      worldState:        ws,
      memoryGraph:       { nodes: Number(ms.nodes ?? 0), edges: Number(ms.edges ?? 0) },
      predictionsCount:  Number((predictions.rows[0] as any)?.c ?? 0),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
