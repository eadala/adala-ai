/**
 * Self-Healing Controller — وحدة التحكم في الإصلاح الذاتي
 * ──────────────────────────────────────────────────────────
 * التدفق:
 *   detectAnomalies() → selfHeal() → executeRecovery() → verifyHeal() → logHealEvent()
 *
 * يعمل كل 5 دقائق من خلال monitoringCron.ts
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { detectAnomalies, classifyOverallSeverity, type Anomaly } from "./anomaly.detector";
import {
  activateSafeMode, restoreStableMode, lockAiExecution,
  reduceQueryLoad, logStripeRetryNeeded, enforceIsolationAlert,
  type RecoveryResult,
} from "./recovery.actions";
import { getSystemState } from "../hardening/production.lock";

/* ─── Safe State (Last Known Good) ─── */
interface SafeState {
  version:     string;
  healthScore: number;
  metrics:     Record<string, number>;
  timestamp:   string;
}
let _safeState: SafeState | null = null;

export function getLastSafeState(): SafeState | null { return _safeState; }

async function persistSafeState(s: SafeState) {
  _safeState = s;
  try {
    await db.execute(sql`
      INSERT INTO safe_state_snapshots (version, health_score, metrics, is_stable)
      VALUES (${s.version}, ${s.healthScore}, ${JSON.stringify(s.metrics)}, true)
    `);
  } catch { /* non-fatal */ }
}

/* ─── Heal Event Log ─── */
async function logHealEvent(params: {
  anomalyType: string; severity: string; action: string;
  result: string; detail: string; metrics: Record<string, any>;
  verified: boolean; durationMs: number;
}) {
  try {
    await db.execute(sql`
      INSERT INTO heal_events (anomaly_type, severity, action_taken, action_result, detail, metrics, verified, duration_ms)
      VALUES (
        ${params.anomalyType}, ${params.severity}, ${params.action},
        ${params.result}, ${params.detail},
        ${JSON.stringify(params.metrics)},
        ${params.verified}, ${params.durationMs}
      )
    `);
  } catch { /* non-fatal */ }
}

/* ─── Main: Run One Healing Cycle ─── */
export async function runSelfHealingCycle(): Promise<{
  anomalies: Anomaly[];
  actions:   RecoveryResult[];
  healthScore: number;
  mode:      string;
}> {
  const t0 = Date.now();
  const detection = await detectAnomalies();
  const { anomalies, healthScore, dbLatencyMs } = detection;

  /* If clean → persist safe state + auto-restore if in safe_mode */
  if (anomalies.length === 0) {
    const state = getSystemState();
    await persistSafeState({
      version:     process.env.npm_package_version ?? "1.0.0",
      healthScore: 100,
      metrics:     { dbLatencyMs, errorRate: 0 },
      timestamp:   new Date().toISOString(),
    });
    /* Auto-restore safe mode if it was set by self-healer and is now clean */
    if (state.mode === "safe_mode" && state.activatedBy === "self-healer") {
      await restoreStableMode();
    }
    return { anomalies: [], actions: [], healthScore: 100, mode: getSystemState().mode };
  }

  /* ─── Select & Execute Recovery Actions ─── */
  const actions: RecoveryResult[] = [];
  const healed  = new Set<string>();

  for (const anomaly of anomalies) {
    if (!anomaly.autoHealable) continue;
    const key = anomaly.type;
    if (healed.has(key)) continue;
    healed.add(key);

    let result: RecoveryResult;

    switch (anomaly.type) {
      case "tenant_leak_detected":
        result = await enforceIsolationAlert();
        break;

      case "error_rate_critical":
      case "memory_critical":
        result = await activateSafeMode(`شُغِّل تلقائياً: ${anomaly.message}`);
        break;

      case "db_latency_critical":
        result = reduceQueryLoad();
        break;

      case "db_latency_high":
      case "error_rate_high":
        result = reduceQueryLoad();
        break;

      case "stripe_failure_spike":
        result = await logStripeRetryNeeded();
        break;

      case "system_in_safe_mode": {
        /* Re-run detection to see if we can restore */
        const recheck = await detectAnomalies();
        if (recheck.anomalies.filter(a => a.type !== "system_in_safe_mode").length === 0) {
          result = await restoreStableMode();
        } else {
          result = { action: "NOOP", success: true, detail: "النظام يبقى في الوضع الآمن — المشاكل لم تُحل بعد" };
        }
        break;
      }

      default:
        result = { action: "NOOP", success: true, detail: "لا إجراء تلقائي متاح" };
    }

    actions.push(result);

    /* Log each action */
    await logHealEvent({
      anomalyType: anomaly.type,
      severity:    anomaly.severity,
      action:      result.action,
      result:      result.success ? "success" : "failed",
      detail:      result.detail,
      metrics:     { metric: anomaly.metric, threshold: anomaly.threshold, dbLatencyMs },
      verified:    result.success,
      durationMs:  Date.now() - t0,
    });
  }

  /* Log non-healable anomalies too (for audit) */
  for (const anomaly of anomalies.filter(a => !a.autoHealable)) {
    await logHealEvent({
      anomalyType: anomaly.type,
      severity:    anomaly.severity,
      action:      "NOOP",
      result:      "skipped",
      detail:      `يحتاج تدخلاً يدوياً: ${anomaly.message}`,
      metrics:     { metric: anomaly.metric, threshold: anomaly.threshold },
      verified:    false,
      durationMs:  Date.now() - t0,
    });
  }

  return {
    anomalies,
    actions,
    healthScore,
    mode: getSystemState().mode,
  };
}

/* ─── Get Healing Stats ─── */
export async function getHealingStats(): Promise<{
  last24h:    { total: number; success: number; skipped: number; failed: number };
  bySeverity: Record<string, number>;
  recentEvents: any[];
}> {
  try {
    const [stats, byS, recent] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE action_result = 'success')::int AS success,
          COUNT(*) FILTER (WHERE action_result = 'skipped')::int AS skipped,
          COUNT(*) FILTER (WHERE action_result = 'failed')::int AS failed
        FROM heal_events WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      db.execute(sql`
        SELECT severity, COUNT(*)::int AS n
        FROM heal_events WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY severity
      `),
      db.execute(sql`
        SELECT id, anomaly_type, severity, action_taken, action_result, detail, verified, duration_ms, created_at
        FROM heal_events ORDER BY created_at DESC LIMIT 30
      `),
    ]);

    const s    = ((stats.rows ?? stats) as any[])[0] ?? {};
    const bySev: Record<string, number> = {};
    for (const row of ((byS.rows ?? byS) as any[])) bySev[row.severity] = Number(row.n);

    return {
      last24h:      { total: Number(s.total ?? 0), success: Number(s.success ?? 0), skipped: Number(s.skipped ?? 0), failed: Number(s.failed ?? 0) },
      bySeverity:   bySev,
      recentEvents: (recent.rows ?? recent) as any[],
    };
  } catch {
    return { last24h: { total: 0, success: 0, skipped: 0, failed: 0 }, bySeverity: {}, recentEvents: [] };
  }
}
