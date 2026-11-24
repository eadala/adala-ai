/**
 * Business Intelligence Layer
 * ─────────────────────────────
 * يُحلّل الحمل التشغيلي وتكلفة الموارد من مقاييس Prometheus الحقيقية.
 *
 * لا يتخذ إجراءات تلقائية (VPS واحد) — يُعرّض metrics لـ Grafana.
 */

import * as client from "prom-client";
import type { SystemMetrics } from "./prometheusClient.js";

/* ── Prometheus metrics ────────────────────────────────── */
export const workloadScoreGauge = new client.Gauge({
  name: "de_business_workload_score",
  help: "Business workload score (0–100)",
});

export const workloadStatusGauge = new client.Gauge({
  name: "de_business_workload_status",
  help: "Workload status: 0=LOW, 1=MEDIUM, 2=HIGH",
});

export const costIndexGauge = new client.Gauge({
  name: "de_business_cost_index",
  help: "Relative cost index (AI requests × weight + CPU × weight)",
});

/* ── Types ─────────────────────────────────────────────── */
export type WorkloadLevel = "LOW" | "MEDIUM" | "HIGH";

export interface BusinessAnalysis {
  workloadScore: number;
  workloadLevel: WorkloadLevel;
  costIndex:     number;
  recommendations: string[];
}

/* ── Analysis ──────────────────────────────────────────── */
export function analyzeBusinessLayer(m: SystemMetrics): BusinessAnalysis {
  /* Workload = weighted mix of AI demand + system load */
  const workloadScore = Math.min(
    100,
    m.aiPending   * 0.4 +
    m.cpuPercent  * 0.35 +
    (m.p95LatencyMs > 0 ? Math.min(m.p95LatencyMs / 20, 30) : 0) * 0.25
  );

  const workloadLevel: WorkloadLevel =
    workloadScore > 70 ? "HIGH" :
    workloadScore > 35 ? "MEDIUM" :
    "LOW";

  /* Cost index — هذا مؤشر نسبي وليس تكلفة مالية حقيقية */
  const costIndex = parseFloat(
    (m.aiPending * 0.01 + m.cpuPercent * 0.02).toFixed(4)
  );

  const recommendations: string[] = [];

  if (workloadLevel === "HIGH" && m.aiPending > 30) {
    recommendations.push("AI queue congested — consider throttling non-critical AI tasks");
  }
  if (workloadLevel === "LOW" && m.cpuPercent < 15 && m.memPercent < 30) {
    recommendations.push("System underutilised — VPS downgrade may reduce costs");
  }
  if (m.p95LatencyMs > 2000 && workloadLevel === "HIGH") {
    recommendations.push("High latency under load — profile slow endpoints");
  }

  /* Update Prometheus metrics */
  workloadScoreGauge.set(workloadScore);
  workloadStatusGauge.set(workloadLevel === "HIGH" ? 2 : workloadLevel === "MEDIUM" ? 1 : 0);
  costIndexGauge.set(costIndex);

  return { workloadScore, workloadLevel, costIndex, recommendations };
}
