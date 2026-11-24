/**
 * عدالة AI — Decision Engine
 * ────────────────────────────
 * خدمة مستقلة تُنسّق بين Alertmanager والـ API للتعافي الذكي.
 *
 * Endpoints:
 *   POST /alert      ← Alertmanager webhook
 *   GET  /status     ← state snapshot
 *   GET  /metrics    ← Prometheus scrape
 *
 * الإجراءات المتاحة (VPS واحد):
 *   • trigger heal   → POST /internal/heal على الـ API
 *   • log + metric   → يُظهر Risk Score في Grafana
 *   • recommendations → مقترحات بدون تدخل تلقائي
 */

import express from "express";
import * as client from "prom-client";
import { logger } from "./logger.js";
import { state, canHeal, startHeal, recordAction } from "./state.js";
import { getSystemMetrics } from "./prometheusClient.js";
import {
  computeRisk,
  startPredictiveLoop,
  riskScoreGauge,
  riskStatusGauge,
  healCountCounter,
  lastSnapshot,
} from "./predictor.js";

const app     = express();
const PORT    = parseInt(process.env.PORT ?? "3002");
const API_URL = process.env.API_URL  ?? "http://api:8080";
const HEAL_SECRET = process.env.HEAL_SECRET ?? "adala-heal-token-change-me";

app.use(express.json());

/* ── Prometheus registry ─────────────────────────────────── */
client.collectDefaultMetrics({ prefix: "de_node_" });

/* ═══════════════════════════════════════════════════════════
   POST /alert — Alertmanager webhook
═══════════════════════════════════════════════════════════ */
app.post("/alert", async (req, res) => {
  const body = req.body ?? {};

  /* Alertmanager sends: { alerts: [...], status: 'firing'|'resolved' } */
  const alerts: any[] = Array.isArray(body.alerts) ? body.alerts : [body];
  const firingAlerts  = alerts.filter((a) => a.status !== "resolved");

  if (firingAlerts.length === 0) {
    return void res.json({ ok: true, action: "resolved_ignored" });
  }

  const results: any[] = [];

  for (const alert of firingAlerts) {
    const name     = alert.labels?.alertname ?? "Unknown";
    const severity = alert.labels?.severity  ?? "unknown";

    logger.warn({ alert: name, severity }, "[DE] Alert received");

    /* ── APIDown → heal ──────────────────────────────── */
    if (name === "APIDown" || name === "PredictedCritical") {
      const r = await handleHeal(name, severity);
      results.push(r);
      continue;
    }

    /* ── Critical → check context, decide ───────────── */
    if (severity === "critical") {
      const r = await handleCritical(name, alert);
      results.push(r);
      continue;
    }

    /* ── Warning → log only ──────────────────────────── */
    recordAction({ alert: name, severity, action: "no_action", riskScore: 0, reason: "warning — logged only" });
    results.push({ alert: name, action: "no_action" });
  }

  res.json({ ok: true, results });
});

/* ── Heal action ─────────────────────────────────────────── */
async function handleHeal(alertName: string, severity: string) {
  if (!canHeal()) {
    const reason = state.healing
      ? "heal already in progress"
      : `cooldown until ${new Date(state.healingUntil).toISOString()}`;

    logger.info({ alertName, reason }, "[DE] Heal skipped");
    recordAction({ alert: alertName, severity, action: "heal_skipped_cooldown",
      riskScore: state.lastRiskScore, reason });
    return { alert: alertName, action: "heal_skipped", reason };
  }

  /* Fetch current metrics for context */
  const metrics = await getSystemMetrics().catch(() => null);
  const risk    = metrics ? computeRisk(metrics) : null;

  startHeal();
  healCountCounter.inc();

  logger.warn({
    alertName,
    riskScore:  risk?.score,
    riskStatus: risk?.status,
  }, "[DE] 🔄 Triggering heal on API");

  try {
    const resp = await fetch(`${API_URL}/internal/heal`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${HEAL_SECRET}`,
      },
      body: JSON.stringify({
        alerts: [{ status: "firing", labels: { alertname: alertName, severity } }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await resp.json().catch(() => ({}));
    recordAction({
      alert:     alertName,
      severity,
      action:    "heal_triggered",
      riskScore: risk?.score ?? 0,
      reason:    `http ${resp.status}`,
    });
    return { alert: alertName, action: "heal_triggered", status: resp.status, body };

  } catch (err: any) {
    logger.error({ err: err?.message }, "[DE] Heal request failed");
    recordAction({ alert: alertName, severity, action: "heal_triggered",
      riskScore: risk?.score ?? 0, reason: `failed: ${err?.message}` });
    return { alert: alertName, action: "heal_failed", error: err?.message };
  }
}

/* ── Critical — context-aware decision ──────────────────── */
async function handleCritical(alertName: string, alert: any) {
  const metrics = await getSystemMetrics().catch(() => null);
  const risk    = metrics ? computeRisk(metrics) : null;

  logger.warn({
    alertName,
    riskScore:  risk?.score,
    riskStatus: risk?.status,
    reasons:    risk?.reasons,
  }, "[DE] Critical alert — context-aware decision");

  /* DB down → heal */
  if (alertName === "DatabaseDown" || alertName === "DBDown") {
    return handleHeal(alertName, "critical");
  }

  /* High memory → log recommendation, no auto-action (VPS, single node) */
  if (alertName === "HighMemoryUsage" && metrics && metrics.memPercent > 90) {
    recordAction({
      alert: alertName, severity: "critical", action: "no_action",
      riskScore: risk?.score ?? 0,
      reason: `Memory ${metrics.memPercent.toFixed(0)}% — manual intervention recommended`,
    });
    logger.warn({ mem: metrics.memPercent },
      "[DE] High memory — manual action needed (single-VPS, no auto-scale)");
    return { alert: alertName, action: "no_action_recommendation_logged" };
  }

  /* Default: log, no action */
  recordAction({ alert: alertName, severity: "critical", action: "no_action",
    riskScore: risk?.score ?? 0, reason: "critical logged, no safe auto-action" });
  return { alert: alertName, action: "no_action_safe_mode" };
}

/* ═══════════════════════════════════════════════════════════
   GET /status — unified intelligence snapshot
═══════════════════════════════════════════════════════════ */
app.get("/status", (_req, res) => {
  const snap = lastSnapshot;

  res.json({
    ok:      true,
    ts:      snap?.ts ?? new Date().toISOString(),
    uptime:  Math.floor(process.uptime()),

    /* Risk layer */
    risk: snap ? {
      score:   snap.risk.score,
      status:  snap.risk.status,
      reasons: snap.risk.reasons,
    } : { score: state.lastRiskScore, status: state.lastRiskStatus, reasons: [] },

    /* Business layer */
    business: snap ? {
      workloadLevel: snap.business.workloadLevel,
      workloadScore: snap.business.workloadScore,
      costIndex:     snap.business.costIndex,
      recommendations: snap.business.recommendations,
    } : null,

    /* Product layer */
    product: snap ? {
      intent:        snap.product.intent,
      platformValue: snap.product.platformValue,
      aiEngagement:  snap.product.aiEngagement,
      insights:      snap.product.insights,
    } : null,

    /* System state */
    healing:       state.healing,
    frozen:        state.frozen,
    healCount:     state.healCount,
    healCooldown:  state.healingUntil > Date.now()
      ? Math.ceil((state.healingUntil - Date.now()) / 1000) + "s"
      : null,

    /* Raw metrics */
    metrics: snap?.metrics ?? null,

    /* Last 10 decisions */
    recentActions: state.actionLog.slice(0, 10),
  });
});

/* ── Prometheus scrape ────────────────────────────────────── */
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

/* ── Health ───────────────────────────────────────────────── */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ── 404 ──────────────────────────────────────────────────── */
app.use((_req, res) => res.status(404).json({ error: "not found" }));

/* ── Boot ─────────────────────────────────────────────────── */
app.listen(PORT, () => {
  logger.info({ port: PORT }, "✅ Decision Engine started");
  startPredictiveLoop();
});
