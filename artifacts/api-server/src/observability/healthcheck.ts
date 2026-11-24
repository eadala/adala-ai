import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { collectMetrics } from "./metrics";

export interface HealthResult {
  status: "healthy" | "degraded" | "critical";
  score: number;
  checks: Record<string, { ok: boolean; latency?: number; detail?: string }>;
  metrics: Awaited<ReturnType<typeof collectMetrics>>;
}

export async function systemHealthCheck(): Promise<HealthResult> {
  const metrics = await collectMetrics();
  const checks: HealthResult["checks"] = {};

  checks.database = { ok: metrics.dbHealth, latency: metrics.dbLatency };

  const memPct = metrics.memory.percent;
  checks.memory = {
    ok: memPct < 90,
    detail: `${memPct}% used (${Math.round(metrics.memory.used / 1024 / 1024)}MB / ${Math.round(metrics.memory.total / 1024 / 1024)}MB)`,
  };

  checks.error_rate = {
    ok: metrics.errorRate < 0.1,
    detail: `${(metrics.errorRate * 100).toFixed(1)}% in last 60s`,
  };

  checks.db_latency = {
    ok: metrics.dbLatency < 800,
    detail: `${metrics.dbLatency}ms`,
  };

  checks.webhook = {
    ok: metrics.webhookFailures < 5,
    detail: `${metrics.webhookFailures} failures`,
  };

  checks.uptime = {
    ok: true,
    detail: `${Math.round(metrics.uptime / 60)}m`,
  };

  const passed = Object.values(checks).filter(c => c.ok).length;
  const total  = Object.keys(checks).length;
  const score  = Math.round((passed / total) * 100);

  const status: HealthResult["status"] =
    score >= 85 ? "healthy" :
    score >= 60 ? "degraded" :
    "critical";

  return { status, score, checks, metrics };
}
