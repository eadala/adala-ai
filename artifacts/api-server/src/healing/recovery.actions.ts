/**
 * Recovery Actions — إجراءات الاسترداد الآمنة
 * ─────────────────────────────────────────────
 * ⚠️ حدود صارمة:
 *   ✅ عزل + تقليل الحمل + إعادة تشغيل أجزاء آمنة + تسجيل
 *   ❌ لا تعديل business logic
 *   ❌ لا تعديل Financial rules
 *   ❌ لا تعديل DB schema
 *   ❌ لا تعديل Stripe configuration
 */

import { setSystemMode, setAiLock, isInSafeMode, getSystemState } from "../hardening/production.lock";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type RecoveryAction =
  | "ACTIVATE_SAFE_MODE"
  | "RESTORE_STABLE_MODE"
  | "LOCK_AI_EXECUTION"
  | "UNLOCK_AI_EXECUTION"
  | "FLUSH_SLOW_QUERIES"
  | "LOG_STRIPE_RETRY_NEEDED"
  | "ENFORCE_ISOLATION_ALERT"
  | "NOOP";

export interface RecoveryResult {
  action:  RecoveryAction;
  success: boolean;
  detail:  string;
}

/* ─── In-memory throttle flag (non-persistent) ─── */
let _queryThrottleActive = false;
export function isQueryThrottleActive(): boolean { return _queryThrottleActive; }

/* ──────────────────────────────────────────────── */
/*  Individual recovery functions                   */
/* ──────────────────────────────────────────────── */

/** تفعيل الوضع الآمن إذا لم يكن مفعلاً */
export async function activateSafeMode(reason: string): Promise<RecoveryResult> {
  if (isInSafeMode()) return { action: "ACTIVATE_SAFE_MODE", success: true, detail: "الوضع الآمن مفعّل مسبقاً" };
  await setSystemMode("safe_mode", reason, "self-healer");
  return { action: "ACTIVATE_SAFE_MODE", success: true, detail: `تم تفعيل الوضع الآمن: ${reason}` };
}

/** استرداد الوضع الطبيعي إذا انتهت المشكلة */
export async function restoreStableMode(): Promise<RecoveryResult> {
  if (!isInSafeMode()) return { action: "RESTORE_STABLE_MODE", success: true, detail: "النظام مستقر بالفعل" };
  await setSystemMode("stable", "تم استرداد الاستقرار تلقائياً", "self-healer");
  return { action: "RESTORE_STABLE_MODE", success: true, detail: "تم الاسترداد إلى الوضع المستقر" };
}

/** قفل تنفيذ AI (التوليد يبقى) */
export function lockAiExecution(): RecoveryResult {
  setAiLock(true);
  return { action: "LOCK_AI_EXECUTION", success: true, detail: "AI مقفل — التوليد فقط، لا تنفيذ" };
}

/** فتح قفل AI */
export function unlockAiExecution(): RecoveryResult {
  setAiLock(false);
  return { action: "UNLOCK_AI_EXECUTION", success: true, detail: "AI فُتح — يعمل بشكل طبيعي" };
}

/** تقليل حمل الـ queries الثقيلة */
export function reduceQueryLoad(): RecoveryResult {
  _queryThrottleActive = true;
  /* Auto-restore after 15 min */
  setTimeout(() => { _queryThrottleActive = false; }, 15 * 60 * 1000);
  return { action: "FLUSH_SLOW_QUERIES", success: true, detail: "تم تفعيل تقليل الحمل (15 دقيقة)" };
}

/** تسجيل حاجة إعادة محاولة Stripe (لا نلمس Stripe مباشرة) */
export async function logStripeRetryNeeded(): Promise<RecoveryResult> {
  try {
    await db.execute(sql`
      INSERT INTO system_events (event_type, severity, payload, created_at)
      VALUES ('stripe_retry_needed', 'warning', '{"action":"manual_review_required","source":"self-healer"}', NOW())
    `);
  } catch { /* non-fatal */ }
  return { action: "LOG_STRIPE_RETRY_NEEDED", success: true, detail: "تم تسجيل حاجة مراجعة Stripe يدوياً" };
}

/** تفعيل تنبيه عزل المستأجرين */
export async function enforceIsolationAlert(): Promise<RecoveryResult> {
  try {
    await db.execute(sql`
      INSERT INTO system_events (event_type, severity, payload, created_at)
      VALUES ('isolation_breach_detected', 'critical', '{"action":"isolation_enforced","source":"self-healer"}', NOW())
    `);
  } catch { /* non-fatal */ }
  /* أيضاً يُفعّل الوضع الآمن */
  await activateSafeMode("خطر تسرب بيانات بين المستأجرين");
  return { action: "ENFORCE_ISOLATION_ALERT", success: true, detail: "تم تفعيل تنبيه عزل المستأجرين + الوضع الآمن" };
}
