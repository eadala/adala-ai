/**
 * Risk Scoring + Predictive Loop
 *
 * يحسب درجة خطر كل 60 ثانية من مقاييس Prometheus الحقيقية.
 * إذا تجاوزت العتبة → ينبّه قبل أن يحدث العطل.
 *
 * VPS realities:
 *  - لا Kubernetes — لا auto-scaling حقيقي
 *  - بدلاً من ذلك: توصيات مُسجَّلة + metrics قابلة للرسم في Grafana
 */

import { getSystemMetrics, type SystemMetrics } from "./prometheusClient.js";
import { state, recordAction } from "./state.js";
import { logger } from "./logger.js";
import * as client from "prom-client";

/* ── Prometheus metrics يُعرّفها Decision Engine ────────── */
export const riskScoreGauge = new client.Gauge({
  name: "de_risk_score",
  help: "System risk score (0–100)",
});

export const riskStatusGauge = new client.Gauge({
  name: "de_risk_status",
  help: "Risk status (0=STABLE, 1=WARNING, 2=CRITICAL)",
});

export const healCountCounter = new client.Counter({
  name: "de_heal_count_total",
  help: "Total healing actions triggered",
});

export const predictiveAlertsCounter = new client.Counter({
  name: "de_predictive_alerts_total",
  help: "Predictive alerts raised before actual failure",
});

/* ── Risk scoring weights ───────────────────────────────── */
export function computeRisk(m: SystemMetrics): {
  score: number;
  status: "STABLE" | "WARNING" | "CRITICAL";
  reasons: string[];
} {
  let score   = 0;
  const reasons: string[] = [];

  if (m.cpuPercent > 85)    { score += 30; reasons.push(`CPU ${m.cpuPercent.toFixed(0)}%`); }
  else if (m.cpuPercent > 70) { score += 15; reasons.push(`CPU ${m.cpuPercent.toFixed(0)}% (elevated)`); }

  if (m.memPercent > 90)    { score += 30; reasons.push(`RAM ${m.memPercent.toFixed(0)}%`); }
  else if (m.memPercent > 80) { score += 15; reasons.push(`RAM ${m.memPercent.toFixed(0)}% (elevated)`); }

  if (m.p95LatencyMs > 1500) { score += 20; reasons.push(`p95=${m.p95LatencyMs.toFixed(0)}ms`); }
  else if (m.p95LatencyMs > 800) { score += 10; reasons.push(`p95=${m.p95LatencyMs.toFixed(0)}ms (high)`); }

  if (m.errorRateRps > 0.1)  { score += 20; reasons.push(`errors=${m.errorRateRps.toFixed(3)}/s`); }
  else if (m.errorRateRps > 0.02) { score += 10; reasons.push(`errors=${m.errorRateRps.toFixed(3)}/s (low)`); }

  if (m.dbHealth === 0)      { score += 30; reasons.push("DB_DOWN"); }

  if (m.aiPending > 50)      { score += 10; reasons.push(`AI_queue=${m.aiPending}`); }

  const capped  = Math.min(score, 100);
  const status  = capped >= 70 ? "CRITICAL" : capped >= 40 ? "WARNING" : "STABLE";

  return { score: capped, status, reasons };
}

/* ── Cost/load recommendations (no real action — VPS single-node) ── */
export function costRecommendations(m: SystemMetrics): string[] {
  const tips: string[] = [];
  if (m.cpuPercent < 20 && m.memPercent < 30) {
    tips.push("Consider downgrading VPS tier (low utilisation)");
  }
  if (m.aiPending === 0 && m.errorRateRps < 0.01 && m.cpuPercent < 15) {
    tips.push("System idle — AI workers can be throttled");
  }
  if (m.p95LatencyMs > 2000) {
    tips.push("High latency — consider upgrading VPS CPU");
  }
  return tips;
}

const API_BASE = process.env.API_URL ?? "http://api:8080";

/* ── Predictive loop — يعمل كل 60 ثانية ─────────────────── */
export function startPredictiveLoop(): void {
  const INTERVAL_MS = 60_000;

  async function tick() {
    try {
      const metrics = await getSystemMetrics();
      const risk    = computeRisk(metrics);

      /* Update Prometheus metrics */
      riskScoreGauge.set(risk.score);
      riskStatusGauge.set(risk.status === "CRITICAL" ? 2 : risk.status === "WARNING" ? 1 : 0);

      /* Update state */
      state.lastRiskScore  = risk.score;
      state.lastRiskStatus = risk.status;

      const tips = costRecommendations(metrics);

      logger.info({
        riskScore:  risk.score,
        riskStatus: risk.status,
        reasons:    risk.reasons,
        metrics: {
          cpu: `${metrics.cpuPercent.toFixed(1)}%`,
          mem: `${metrics.memPercent.toFixed(1)}%`,
          p95: `${metrics.p95LatencyMs.toFixed(0)}ms`,
          err: `${metrics.errorRateRps.toFixed(3)}/s`,
        },
        tips: tips.length > 0 ? tips : undefined,
      }, `[Predictor] ${risk.status} risk=${risk.score}`);

      /* Predictive alert: CRITICAL before actual failure */
      if (risk.status === "CRITICAL" && !state.healing) {
        predictiveAlertsCounter.inc();
        recordAction({
          alert:     "PredictedCritical",
          severity:  "critical",
          action:    "risk_alert_sent",
          riskScore: risk.score,
          reason:    risk.reasons.join(", "),
        });

        /* Post to API's self-heal endpoint if DB is down */
        if (metrics.dbHealth === 0) {
          logger.warn("[Predictor] DB down detected — triggering heal");
          await fetch(`${API_BASE}/internal/heal`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization:  `Bearer ${process.env.HEAL_SECRET ?? "adala-heal-token-change-me"}`,
            },
            body: JSON.stringify({
              alerts: [{ status: "firing", labels: { alertname: "DBDown", severity: "critical" } }],
            }),
            signal: AbortSignal.timeout(10_000),
          }).catch(() => {});
        }
      }

    } catch (err: any) {
      logger.warn({ err: err?.message }, "[Predictor] tick error");
    }
  }

  /* First tick after 30s (let Prometheus warm up) */
  setTimeout(() => {
    tick();
    setInterval(tick, INTERVAL_MS);
  }, 30_000);

  logger.info("[Predictor] ✅ Predictive loop started (60s interval)");
}
