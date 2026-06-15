/**
 * Anomaly Detector — محرك اكتشاف الأعطال
 * ─────────────────────────────────────────
 * يفحص 7 مؤشرات ويُعيد قائمة الأعطال المكتشفة.
 * لا يُصلح — يكتشف فقط.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getIsolationStats } from "../isolation/tenant.scope";
import { getSystemState } from "../hardening/production.lock";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface Anomaly {
  type:     string;
  severity: AnomalySeverity;
  message:  string;
  metric:   number;
  threshold: number;
  autoHealable: boolean;   // يمكن الإصلاح التلقائي؟
}

interface DetectionResult {
  anomalies:    Anomaly[];
  healthScore:  number;   // 0→100
  checkedAt:    string;
  dbLatencyMs:  number;
}

async function sqlNum(q: any, fallback = 0): Promise<number> {
  try {
    const r = await db.execute(q);
    const row = ((r.rows ?? r) as any[])[0];
    return Number(Object.values(row ?? {})[0] ?? fallback);
  } catch { return fallback; }
}

export async function detectAnomalies(): Promise<DetectionResult> {
  const anomalies: Anomaly[] = [];

  /* ── 1. DB Latency ── */
  const t0 = Date.now();
  try { await db.execute(sql`SELECT 1`); } catch { /* ignore */ }
  const dbLatencyMs = Date.now() - t0;

  if (dbLatencyMs > 1200) {
    anomalies.push({ type: "db_latency_critical", severity: "critical", message: `تأخر DB حرج: ${dbLatencyMs}ms`, metric: dbLatencyMs, threshold: 1200, autoHealable: true });
  } else if (dbLatencyMs > 600) {
    anomalies.push({ type: "db_latency_high", severity: "high", message: `تأخر DB عالٍ: ${dbLatencyMs}ms`, metric: dbLatencyMs, threshold: 600, autoHealable: true });
  }

  /* ── 2. API Error Rate (last 10 min) ── */
  const totalEvents = await sqlNum(sql`SELECT COUNT(*)::int FROM system_events WHERE created_at > NOW() - INTERVAL '10 minutes'`);
  const errorEvents = await sqlNum(sql`SELECT COUNT(*)::int FROM system_events WHERE created_at > NOW() - INTERVAL '10 minutes' AND severity IN ('error','critical')`);
  const errorRate   = totalEvents > 0 ? errorEvents / totalEvents : 0;

  if (errorRate > 0.15) {
    anomalies.push({ type: "error_rate_critical", severity: "critical", message: `معدل الأخطاء حرج: ${(errorRate * 100).toFixed(1)}%`, metric: errorRate, threshold: 0.15, autoHealable: true });
  } else if (errorRate > 0.05) {
    anomalies.push({ type: "error_rate_high", severity: "high", message: `معدل الأخطاء مرتفع: ${(errorRate * 100).toFixed(1)}%`, metric: errorRate, threshold: 0.05, autoHealable: true });
  }

  /* ── 3. Stripe Failures (last 1h) ── */
  const stripeErrors = await sqlNum(sql`
    SELECT COUNT(*)::int FROM payment_transactions
    WHERE created_at > NOW() - INTERVAL '1 hour' AND status IN ('failed','error')
  `);
  if (stripeErrors > 10) {
    anomalies.push({ type: "stripe_failure_spike", severity: "critical", message: `ارتفاع حاد في أخطاء Stripe: ${stripeErrors}`, metric: stripeErrors, threshold: 10, autoHealable: true });
  } else if (stripeErrors > 4) {
    anomalies.push({ type: "stripe_failures_high", severity: "high", message: `أخطاء Stripe متكررة: ${stripeErrors}`, metric: stripeErrors, threshold: 4, autoHealable: false });
  }

  /* ── 4. Tenant Leak Risk ── */
  const isolStats = getIsolationStats();
  if (isolStats.leakCount > 0) {
    const sev: AnomalySeverity = isolStats.criticalCount > 0 ? "critical" : "high";
    anomalies.push({ type: "tenant_leak_detected", severity: sev, message: `تسرب بيانات مكتشف: ${isolStats.leakCount} حادثة (${isolStats.criticalCount} حرجة)`, metric: isolStats.leakCount, threshold: 0, autoHealable: true });
  }

  /* ── 5. Orphan Ledger Entries ── */
  const orphanLedger = await sqlNum(sql`SELECT COUNT(*)::int FROM ledger_entries WHERE office_id IS NULL OR office_id = ''`);
  if (orphanLedger > 0) {
    anomalies.push({ type: "orphan_ledger_entries", severity: "high", message: `قيود Ledger بدون tenant: ${orphanLedger}`, metric: orphanLedger, threshold: 0, autoHealable: false });
  }

  /* ── 6. Memory Pressure ── */
  const mem      = process.memoryUsage();
  const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotal= Math.round(mem.heapTotal / 1024 / 1024);
  const heapPct  = heapTotal > 0 ? heapUsed / heapTotal : 0;
  if (heapPct > 0.92) {
    anomalies.push({ type: "memory_critical", severity: "critical", message: `الذاكرة حرجة: ${heapUsed}/${heapTotal} MB (${(heapPct*100).toFixed(0)}%)`, metric: heapPct, threshold: 0.92, autoHealable: true });
  } else if (heapPct > 0.80) {
    anomalies.push({ type: "memory_high", severity: "high", message: `الذاكرة مرتفعة: ${heapUsed}/${heapTotal} MB (${(heapPct*100).toFixed(0)}%)`, metric: heapPct, threshold: 0.80, autoHealable: false });
  }

  /* ── 7. System already in stress (safe_mode flag without healing) ── */
  const sysState = getSystemState();
  if (sysState.mode === "safe_mode") {
    anomalies.push({ type: "system_in_safe_mode", severity: "medium", message: "النظام في الوضع الآمن — جارٍ التحقق من الاسترداد", metric: 1, threshold: 0, autoHealable: true });
  }

  /* ── Score ── */
  const critCount = anomalies.filter(a => a.severity === "critical").length;
  const highCount = anomalies.filter(a => a.severity === "high").length;
  const medCount  = anomalies.filter(a => a.severity === "medium").length;
  const healthScore = Math.max(0, 100 - critCount * 25 - highCount * 10 - medCount * 5);

  return { anomalies, healthScore, checkedAt: new Date().toISOString(), dbLatencyMs };
}

export function classifyOverallSeverity(anomalies: Anomaly[]): AnomalySeverity {
  if (anomalies.some(a => a.severity === "critical")) return "critical";
  if (anomalies.some(a => a.severity === "high"))     return "high";
  if (anomalies.some(a => a.severity === "medium"))   return "medium";
  return "low";
}
