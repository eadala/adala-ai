/**
 * Product Intelligence Layer
 * ───────────────────────────
 * يُصنّف نية الاستخدام بناءً على مقاييس حقيقية من Prometheus.
 * يُعرّض مؤشرات UX وقيمة المنتج لـ Grafana.
 *
 * القيم هنا مؤشرات نسبية — ليست أرباماً مالية حقيقية.
 */

import * as client from "prom-client";
import type { SystemMetrics } from "./prometheusClient.js";

/* ── Prometheus metrics ────────────────────────────────── */
export const userIntentGauge = new client.Gauge({
  name: "de_product_user_intent",
  help: "User intent level: 0=CASUAL, 1=EXPLORATION, 2=HIGH_INTENT",
});

export const platformValueGauge = new client.Gauge({
  name: "de_product_platform_value",
  help: "Relative platform value score (0–100)",
});

export const aiEngagementGauge = new client.Gauge({
  name: "de_product_ai_engagement",
  help: "AI feature engagement index (0–100)",
});

/* ── Types ─────────────────────────────────────────────── */
export type UserIntent = "CASUAL" | "EXPLORATION" | "HIGH_INTENT";

export interface ProductAnalysis {
  intent:          UserIntent;
  platformValue:   number;
  aiEngagement:    number;
  insights:        string[];
}

/* ── Thresholds (calibrate with real traffic over time) ── */
const HIGH_INTENT_AI_REQ     = 20;   // pending AI tasks threshold
const EXPLORATION_ACTIVE_MEM = 50;   // memory % suggesting active use

export function analyzeProductLayer(m: SystemMetrics): ProductAnalysis {
  /* User intent — based on AI queue + system activity */
  const intent: UserIntent =
    m.aiPending > HIGH_INTENT_AI_REQ ? "HIGH_INTENT" :
    m.memPercent > EXPLORATION_ACTIVE_MEM ? "EXPLORATION" :
    "CASUAL";

  /* Platform value score — weighted AI + system utilisation */
  const platformValue = Math.min(
    100,
    (m.aiPending > 0 ? Math.min(m.aiPending * 2, 40) : 0) +
    Math.min(m.cpuPercent * 0.4, 35) +
    (m.dbHealth === 1 ? 25 : 0)
  );

  /* AI engagement index */
  const aiEngagement = Math.min(
    100,
    (m.aiPending > 0 ? 40 : 0) +
    (m.p95LatencyMs < 500 ? 30 : m.p95LatencyMs < 1000 ? 15 : 0) +
    (m.errorRateRps < 0.01 ? 30 : m.errorRateRps < 0.05 ? 15 : 0)
  );

  const insights: string[] = [];

  if (intent === "HIGH_INTENT") {
    insights.push("High AI usage detected — ensure AI response times < 3s");
  }
  if (intent === "CASUAL" && m.errorRateRps > 0.02) {
    insights.push("Low usage + errors may indicate UX friction");
  }
  if (aiEngagement > 70) {
    insights.push("Strong AI engagement — core value proposition working");
  }
  if (aiEngagement < 20 && m.dbHealth === 1) {
    insights.push("Low AI engagement despite healthy system — check feature discoverability");
  }

  /* Update Prometheus metrics */
  userIntentGauge.set(intent === "HIGH_INTENT" ? 2 : intent === "EXPLORATION" ? 1 : 0);
  platformValueGauge.set(platformValue);
  aiEngagementGauge.set(aiEngagement);

  return { intent, platformValue, aiEngagement, insights };
}
