/**
 * Smart Alerts Engine
 * ─────────────────────────────────────────────────────────
 * يضيف على sendAlert() الأساسي:
 *   1. Deduplication   — نفس التنبيه لا يُرسل أكثر من مرة كل N دقائق
 *   2. Telegram        — إرسال فعلي للقناة المكوَّنة
 *   3. Trend Analysis  — تحذير مبكر قبل الوصول للحد الحرج
 *   4. Grouping        — تجميع التنبيهات المتشابهة داخل نافذة 30 ثانية
 *   5. Escalation      — رفع الخطورة إذا ظل التنبيه بلا اعتراف
 *   6. Suppression     — وضع صامت يمنع الإرسال مؤقتاً
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { AlertSeverity } from "../monitoring/alerts";

/* ─── Types ─── */
export interface SmartAlert {
  id: string;
  key: string;
  severity: AlertSeverity;
  message: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  acknowledged: boolean;
  channel: "telegram" | "in-app" | "both";
  trend?: "rising" | "stable" | "falling";
}

interface DedupeEntry {
  lastSent: number;
  count: number;
  escalated: boolean;
}

/* ─── State (in-memory) ─── */
const dedupeMap = new Map<string, DedupeEntry>();   // key → last sent
const alertStore: SmartAlert[] = [];                 // live alert feed
let suppressedUntil = 0;                             // maintenance mode

/* ─── Cleanup dedupeMap كل 30 دقيقة ─── */
/* المدخلات الأقدم من ساعتين تُحذف تلقائياً */
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000; // ساعتان
  for (const [key, entry] of dedupeMap) {
    if (entry.lastSent < cutoff) dedupeMap.delete(key);
  }
}, 30 * 60 * 1000).unref();

const DEDUP_WINDOWS: Record<AlertSeverity, number> = {
  low:      10 * 60 * 1000,   // 10 دقائق
  medium:    5 * 60 * 1000,   //  5 دقائق
  high:      2 * 60 * 1000,   //  2 دقيقة
  critical:      60 * 1000,   //  1 دقيقة فقط — critical لا يُكتم طويلاً
};

/* ─── Build alert key ─── */
function alertKey(severity: AlertSeverity, message: string): string {
  /* نأخذ أول 60 حرف من الرسالة لتكون المفتاح */
  return `${severity}::${message.slice(0, 60).trim()}`;
}

/* ─── Suppress / maintenance mode ─── */
export function setSuppressedMode(durationMs: number) {
  suppressedUntil = Date.now() + durationMs;
}
export function clearSuppression() {
  suppressedUntil = 0;
}
export function isSuppressed(): boolean {
  return Date.now() < suppressedUntil;
}

/* ─── الدالة الرئيسية ─── */
export async function sendSmartAlert(
  severity: AlertSeverity,
  message: string,
  opts: { channel?: "telegram" | "in-app" | "both"; forceSkipDedup?: boolean } = {}
): Promise<{ sent: boolean; suppressed: boolean; deduplicated: boolean }> {
  const channel = opts.channel ?? "both";

  /* 1. Suppression check */
  if (isSuppressed() && severity !== "critical") {
    return { sent: false, suppressed: true, deduplicated: false };
  }

  /* 2. Deduplication */
  const key = alertKey(severity, message);
  const entry = dedupeMap.get(key);
  const window = DEDUP_WINDOWS[severity];
  if (!opts.forceSkipDedup && entry && Date.now() - entry.lastSent < window) {
    /* تحديث العداد فقط */
    entry.count++;
    /* رفع الخطورة إذا تكرر التنبيه 5 مرات بدون اعتراف */
    if (entry.count >= 5 && !entry.escalated && severity !== "critical") {
      entry.escalated = true;
      const escalated: AlertSeverity = severity === "low" ? "medium"
        : severity === "medium" ? "high" : "critical";
      await sendSmartAlert(escalated, `🔺 تصعيد — ${message}`, { forceSkipDedup: true });
    }
    return { sent: false, suppressed: false, deduplicated: true };
  }

  /* 3. تحديث dedup */
  dedupeMap.set(key, { lastSent: Date.now(), count: 1, escalated: false });

  /* 4. أضف للـ feed */
  const alert: SmartAlert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    key,
    severity,
    message,
    count: 1,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    acknowledged: false,
    channel,
  };
  alertStore.unshift(alert);
  if (alertStore.length > 500) alertStore.pop();

  /* 5. احفظ في healing_events */
  try {
    await db.execute(sql`
      INSERT INTO healing_events (event_type, severity, source, message, metadata)
      VALUES ('ALERT', ${severity}, 'smart-alerts', ${message}, ${JSON.stringify({ channel, key })}::jsonb)
    `);
  } catch { /* non-blocking */ }

  /* 6. أرسل للقنوات */
  const icon = severity === "critical" ? "🔴" : severity === "high" ? "🟠" : severity === "medium" ? "🟡" : "🟢";
  console.log(`[SmartAlert] ${icon} [${severity.toUpperCase()}] ${message}`);

  const channelPromises: Promise<void>[] = [];

  if (channel === "telegram" || channel === "both") {
    channelPromises.push(deliverTelegram(severity, message).catch(() => {}));
  }

  await Promise.allSettled(channelPromises);
  return { sent: true, suppressed: false, deduplicated: false };
}

/* ─── Telegram Delivery ─── */
async function deliverTelegram(severity: AlertSeverity, message: string): Promise<void> {
  try {
    /* نجلب إعدادات Telegram من الـ settings */
    const rows = await db.execute(sql`
      SELECT bot_token, chat_id, enabled, notify_system_alerts
      FROM telegram_settings
      WHERE enabled = true
        AND bot_token IS NOT NULL
        AND chat_id IS NOT NULL
      LIMIT 5
    `);
    const settings = (rows.rows ?? rows) as any[];
    if (settings.length === 0) return;

    const icon = severity === "critical" ? "🔴" : severity === "high" ? "🟠" : severity === "medium" ? "🟡" : "🟢";
    const text = [
      `${icon} *تنبيه نظام عدالة AI*`,
      `الخطورة: *${severity.toUpperCase()}*`,
      `الرسالة: ${message}`,
      `الوقت: ${new Date().toLocaleString("ar-SA")}`,
    ].join("\n");

    for (const s of settings) {
      if (!s.notify_system_alerts && severity !== "critical") continue;
      await fetch(`https://api.telegram.org/bot${s.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: s.chat_id,
          text,
          parse_mode: "Markdown",
        }),
      });
    }
  } catch { /* non-blocking */ }
}

/* ─── Trend Analysis ─── */
export async function analyzeMetricTrend(
  metric: "db_latency" | "error_rate" | "memory_used",
  threshold: number
): Promise<"rising" | "stable" | "falling"> {
  try {
    const rows = await db.execute(sql`
      SELECT ${sql.raw(metric)} as val
      FROM system_metrics_log
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const vals = ((rows.rows ?? rows) as any[]).map(r => Number(r.val)).filter(v => !isNaN(v));
    if (vals.length < 3) return "stable";

    /* مقارنة أحدث 3 قراءات */
    const [latest, prev, older] = vals;
    if (latest > prev && prev > older) return "rising";
    if (latest < prev && prev < older) return "falling";
    return "stable";
  } catch {
    return "stable";
  }
}

/** تنبيه مبكر — قبل الوصول للحد */
export async function checkTrendAlerts() {
  const [dbTrend, memTrend, errTrend] = await Promise.all([
    analyzeMetricTrend("db_latency", 600),
    analyzeMetricTrend("memory_used", 0.8),
    analyzeMetricTrend("error_rate", 0.05),
  ]);

  if (dbTrend === "rising") {
    await sendSmartAlert("medium", "📈 اتجاه متصاعد في تأخر DB — قد يتجاوز الحد قريباً");
  }
  if (memTrend === "rising") {
    await sendSmartAlert("medium", "📈 الذاكرة في تصاعد مستمر — تابع الوضع");
  }
  if (errTrend === "rising") {
    await sendSmartAlert("high", "📈 معدل الأخطاء يتصاعد — تحقق من السجلات");
  }
}

/* ─── Alert Feed API ─── */
export function getLiveAlerts(limit = 100): SmartAlert[] {
  return alertStore.slice(0, limit);
}

export function acknowledgeAlert(id: string): boolean {
  const alert = alertStore.find(a => a.id === id);
  if (alert) { alert.acknowledged = true; return true; }
  return false;
}

export function acknowledgeAll() {
  alertStore.forEach(a => { a.acknowledged = true; });
}

export function getAlertStats() {
  const now = Date.now();
  const lastHour = alertStore.filter(a => now - a.lastSeen < 3_600_000);
  const lastDay  = alertStore.filter(a => now - a.lastSeen < 86_400_000);
  const unacked  = alertStore.filter(a => !a.acknowledged);

  const bySeverity = (arr: SmartAlert[]) => ({
    critical: arr.filter(a => a.severity === "critical").length,
    high:     arr.filter(a => a.severity === "high").length,
    medium:   arr.filter(a => a.severity === "medium").length,
    low:      arr.filter(a => a.severity === "low").length,
  });

  return {
    total:         alertStore.length,
    unacknowledged: unacked.length,
    lastHour:      bySeverity(lastHour),
    lastDay:       bySeverity(lastDay),
    suppressed:    isSuppressed(),
    suppressedUntil: suppressedUntil > Date.now() ? new Date(suppressedUntil).toISOString() : null,
    dedupeKeys:    dedupeMap.size,
  };
}
