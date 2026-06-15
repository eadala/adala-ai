import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { detectAnomalies, Anomaly } from "../observability/anomaly.detector";
import { systemHealthCheck } from "../observability/healthcheck";
import { FIX_REGISTRY, canAutoFix } from "./fix.registry";
import { REPAIR_WORKERS } from "./repair.workers";
import { sendAlert } from "../monitoring/alerts";

export interface HealResult {
  anomaly: Anomaly;
  fixName: string;
  success: boolean;
  detail: string;
  durationMs: number;
}

async function logHealingEvent(
  eventType: string,
  severity: string,
  source: string,
  message: string,
  anomalies: string[],
  fixApplied: string | null,
  fixSuccess: boolean | null,
  durationMs: number,
  metadata: object = {}
) {
  try {
    await db.execute(sql`
      INSERT INTO healing_events
        (event_type, severity, source, message, anomalies, fix_applied, fix_success, duration_ms, metadata)
      VALUES
        (${eventType}, ${severity}, ${source}, ${message},
         ${JSON.stringify(anomalies)}::text[],
         ${fixApplied}, ${fixSuccess}, ${durationMs}, ${JSON.stringify(metadata)}::jsonb)
    `);
  } catch { /* non-blocking */ }
}

async function logMetricsSnapshot(health: Awaited<ReturnType<typeof systemHealthCheck>>) {
  try {
    await db.execute(sql`
      INSERT INTO system_metrics_log
        (health_score, error_rate, db_latency, memory_used, memory_total, active_fixes, anomalies, snapshot)
      VALUES
        (${health.score}, ${health.metrics.errorRate}, ${health.metrics.dbLatency},
         ${health.metrics.memory.used}, ${health.metrics.memory.total},
         0, ${JSON.stringify([])}::text[], ${JSON.stringify(health.checks)}::jsonb)
    `);
  } catch { /* non-blocking */ }
}

export async function runAutoHealer(): Promise<HealResult[]> {
  const health = await systemHealthCheck();
  await logMetricsSnapshot(health);

  const anomalies = detectAnomalies(health.metrics);
  if (anomalies.length === 0) return [];

  const results: HealResult[] = [];

  for (const anomaly of anomalies) {
    if (!canAutoFix(anomaly.code)) {
      await sendAlert(anomaly.severity, `[${anomaly.code}] ${anomaly.message} — يتطلب تدخل يدوي`);
      await logHealingEvent("ANOMALY_DETECTED", anomaly.severity, "auto_healer",
        anomaly.message, [anomaly.code], null, null, 0, { anomaly });
      continue;
    }

    const fix = FIX_REGISTRY[anomaly.code];
    const worker = REPAIR_WORKERS[fix.name];
    if (!worker) continue;

    const t0 = Date.now();
    let success = false;
    let detail = "";

    try {
      detail = await worker();
      success = true;
      await sendAlert("low", `✅ [AUTO-HEAL] ${anomaly.code} → ${fix.name}: ${detail}`);
    } catch (err: any) {
      detail = err.message;
      await sendAlert(anomaly.severity, `❌ [HEAL FAILED] ${anomaly.code} → ${fix.name}: ${detail}`);
    }

    const durationMs = Date.now() - t0;
    await logHealingEvent(
      success ? "AUTO_HEAL_SUCCESS" : "AUTO_HEAL_FAILED",
      anomaly.severity, "auto_healer", anomaly.message,
      [anomaly.code], fix.name, success, durationMs, { anomaly, detail }
    );

    results.push({ anomaly, fixName: fix.name, success, detail, durationMs });
  }

  return results;
}
