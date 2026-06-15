/**
 * Prevention Log — يُسجّل الأحداث المحجوبة والمنع في healing_events
 * (لا جداول جديدة — يُعيد استخدام healing_events)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type PreventionAction = "BLOCKED" | "THROTTLED" | "CIRCUIT_OPEN" | "RULE_TRIGGERED" | "FALLBACK";

const buffer: Array<{
  action: PreventionAction;
  reason: string;
  path: string;
  ts: number;
}> = [];

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** تسجيل حدث منع (non-blocking) */
export function preventionLog(action: PreventionAction, reason: string, path = "") {
  buffer.push({ action, reason, path, ts: Date.now() });
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    for (const ev of batch) {
      try {
        await db.execute(sql`
          INSERT INTO healing_events
            (event_type, severity, source, message, metadata, resolved)
          VALUES (
            'PREVENTION',
            CASE ${ev.action}
              WHEN 'BLOCKED'       THEN 'high'
              WHEN 'CIRCUIT_OPEN'  THEN 'critical'
              WHEN 'THROTTLED'     THEN 'medium'
              ELSE 'low'
            END,
            'prevention-layer',
            ${`[${ev.action}] ${ev.reason} — ${ev.path}`},
            ${JSON.stringify({ action: ev.action, reason: ev.reason, path: ev.path })}::jsonb,
            true
          )
        `);
      } catch { /* non-blocking */ }
    }
  }, 3000); // batch كل 3 ثوانٍ
}

/** إحصائيات فورية من الذاكرة (لا تنتظر DB flush) */
export function getPreventionBuffer() {
  return [...buffer];
}

/** Counter في الذاكرة للـ dashboard */
const counters = {
  blocked: 0,
  throttled: 0,
  circuitOpen: 0,
  fallback: 0,
  ruleTriggered: 0,
};

export function incCounter(action: PreventionAction) {
  if (action === "BLOCKED")          counters.blocked++;
  else if (action === "THROTTLED")   counters.throttled++;
  else if (action === "CIRCUIT_OPEN") counters.circuitOpen++;
  else if (action === "FALLBACK")     counters.fallback++;
  else if (action === "RULE_TRIGGERED") counters.ruleTriggered++;
}

export function getCounters() {
  return { ...counters };
}
