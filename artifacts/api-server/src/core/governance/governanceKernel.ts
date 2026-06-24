/**
 * 🧠 Governance Kernel — نواة الحوكمة التشغيلية
 * ─────────────────────────────────────────────────
 * يمنع تضارب العمليات ويضمن تنفيذ كل إجراء محكوم بقواعد.
 *
 * طبقات:
 *  1. System State Lock     — يمنع تشغيل عمليات متعارضة معاً
 *  2. Action Queue          — كل العمليات تمر من هنا بالأولوية
 *  3. Conflict Arbitration  — isBlocked() يمنع التضارب
 *  4. Rules Engine          — قواعد مُسمّاة قابلة للتوسع
 *  5. Safe Execution        — كل تنفيذ تحت حماية مع retry
 *  6. Governance Guard      — الباب الأخير قبل التنفيذ
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ══════════════════════════════════════════════════════════════════
   1. System State (يمتد على production.lock دون تكرار)
   ══════════════════════════════════════════════════════════════════ */

export type GovState =
  | "NORMAL"       // وضع طبيعي — كل شيء مسموح
  | "STRICT"       // وضع صارم — يمنع fallback tenant
  | "RECOVERY"     // استعادة نشطة — يمنع scale-up + double-repair
  | "MAINTENANCE"  // صيانة — يمنع AI switch + scale-up
  | "LOCKED";      // قفل كامل — لا شيء ينفذ

let _govState: GovState = "NORMAL";
let _recoveryRunning = false;
const _runningRepairs = new Set<string>(); // user IDs under repair

export function getGovState(): GovState          { return _govState; }
export function setGovState(s: GovState): void   { _govState = s; logStateChange(s); }
export function isRecoveryRunning(): boolean      { return _recoveryRunning; }
export function setRecoveryRunning(v: boolean)    { _recoveryRunning = v; }
export function isRepairRunning(uid: string)      { return _runningRepairs.has(uid); }
export function markRepairStart(uid: string)      { _runningRepairs.add(uid); }
export function markRepairEnd(uid: string)        { _runningRepairs.delete(uid); }

function logStateChange(state: GovState) {
  console.log(`[GovernanceKernel] 🔒 State → ${state}`);
  db.execute(sql`
    INSERT INTO governance_action_log (action_type, source, status, details)
    VALUES ('STATE_CHANGE', 'kernel', 'success', ${JSON.stringify({ state })})
  `).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════
   2. Action Queue
   ══════════════════════════════════════════════════════════════════ */

export type ActionSource = "AOL" | "TOWER" | "ADMIN" | "CRON" | "SYSTEM";

export interface GovAction {
  id:       string;
  type:     string;
  priority: number;       // أعلى = أسبق
  source:   ActionSource;
  payload?: any;
  fn:       () => Promise<any>;
  enqueuedAt: number;
}

const actionQueue: GovAction[] = [];
let _processing = false;

export function enqueueAction(action: Omit<GovAction, "id" | "enqueuedAt">): string {
  const id = `gqa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  actionQueue.push({ ...action, id, enqueuedAt: Date.now() });
  actionQueue.sort((a, b) => b.priority - a.priority);

  db.execute(sql`
    INSERT INTO governance_action_log (action_type, source, status, details)
    VALUES (${action.type}, ${action.source}, 'queued', ${JSON.stringify({ priority: action.priority })})
  `).catch(() => {});

  /* kick off processing if idle */
  if (!_processing) processQueue().catch(() => {});
  return id;
}

export function getQueueSnapshot() {
  return actionQueue.map(a => ({
    id: a.id, type: a.type, priority: a.priority,
    source: a.source, enqueuedAt: a.enqueuedAt,
  }));
}

/* ══════════════════════════════════════════════════════════════════
   3. Conflict Arbitration Engine
   ══════════════════════════════════════════════════════════════════ */

export function isBlocked(action: GovAction): { blocked: boolean; reason?: string } {
  /* Hard lock — nothing passes */
  if (_govState === "LOCKED")
    return { blocked: true, reason: "SYSTEM_LOCKED" };

  /* Maintenance blocks AI + scaling */
  if (_govState === "MAINTENANCE" && ["SCALE_UP", "AI_SWITCH"].includes(action.type))
    return { blocked: true, reason: "MAINTENANCE_MODE" };

  /* Recovery blocks scaling + duplicate repair */
  if (_govState === "RECOVERY" && action.type === "SCALE_UP")
    return { blocked: true, reason: "RECOVERY_IN_PROGRESS" };

  if (action.type === "TENANT_REPAIR") {
    const uid = action.payload?.userId as string | undefined;
    if (_recoveryRunning)
      return { blocked: true, reason: "NO_DOUBLE_RECOVERY" };
    if (uid && _runningRepairs.has(uid))
      return { blocked: true, reason: "REPAIR_ALREADY_RUNNING" };
  }

  /* Strict mode: cache flush only allowed via ADMIN source */
  if (_govState === "STRICT" && action.type === "CACHE_FLUSH" && action.source !== "ADMIN")
    return { blocked: true, reason: "STRICT_MODE_CACHE_FLUSH" };

  return { blocked: false };
}

/* ══════════════════════════════════════════════════════════════════
   4. Governance Rules Engine
   ══════════════════════════════════════════════════════════════════ */

interface GovRule {
  name:      string;
  condition: () => boolean;
  block:     string[];   // action types blocked when condition true
  message:   string;
}

export const governanceRules: GovRule[] = [
  {
    name:      "NO_DOUBLE_RECOVERY",
    condition: () => isRecoveryRunning(),
    block:     ["TENANT_REPAIR", "CACHE_FLUSH"],
    message:   "استعادة الهوية جارية — لا يمكن تشغيل إصلاح مزدوج",
  },
  {
    name:      "NO_ADMIN_CONFLICT",
    condition: () => _govState === "MAINTENANCE",
    block:     ["SCALE_UP", "AI_SWITCH"],
    message:   "وضع الصيانة — عمليات التوسع وتبديل AI محظورة",
  },
  {
    name:      "LOCK_BLOCKS_ALL",
    condition: () => _govState === "LOCKED",
    block:     ["*"],  // wildcard
    message:   "النظام مقفل — لا يُنفَّذ أي إجراء",
  },
  {
    name:      "RECOVERY_BLOCKS_SCALE",
    condition: () => _govState === "RECOVERY",
    block:     ["SCALE_UP"],
    message:   "وضع الاستعادة — توسيع النظام غير متاح",
  },
];

export function evaluateRules(action: { type: string }): { allowed: boolean; reason?: string } {
  for (const rule of governanceRules) {
    if (!rule.condition()) continue;
    const wildcard = rule.block.includes("*");
    const matched  = wildcard || rule.block.includes(action.type);
    if (matched) return { allowed: false, reason: rule.name };
  }
  return { allowed: true };
}

/* ══════════════════════════════════════════════════════════════════
   5. Governance Guard (الباب الأخير قبل التنفيذ)
   ══════════════════════════════════════════════════════════════════ */

export function governanceGuard(action: { type: string; source?: ActionSource }): { allowed: boolean; reason: string } {
  const rules = evaluateRules(action);
  if (!rules.allowed) {
    db.execute(sql`
      INSERT INTO governance_action_log (action_type, source, status, details)
      VALUES (${action.type}, ${action.source ?? "unknown"}, 'blocked',
        ${JSON.stringify({ reason: rules.reason })})
    `).catch(() => {});
    return { allowed: false, reason: rules.reason ?? "GOVERNANCE_BLOCK" };
  }
  return { allowed: true, reason: "OK" };
}

/* ══════════════════════════════════════════════════════════════════
   6. Safe Execution Wrapper
   ══════════════════════════════════════════════════════════════════ */

async function executeSafely(action: GovAction): Promise<void> {
  /* Side-effect tracking */
  if (action.type === "TENANT_REPAIR" && action.payload?.userId)
    markRepairStart(action.payload.userId);
  if (action.type === "GLOBAL_RECOVERY")
    setRecoveryRunning(true);

  try {
    await db.execute(sql`
      INSERT INTO governance_action_log (action_type, source, status, details)
      VALUES (${action.type}, ${action.source}, 'running', ${JSON.stringify({ id: action.id })})
    `).catch(() => {});

    await action.fn();

    await db.execute(sql`
      INSERT INTO governance_action_log (action_type, source, status, details)
      VALUES (${action.type}, ${action.source}, 'success', ${JSON.stringify({ id: action.id })})
    `).catch(() => {});

  } catch (err: any) {
    console.error(`[GovernanceKernel] ❌ Action failed: ${action.type} — ${err.message}`);

    await db.execute(sql`
      INSERT INTO governance_action_log (action_type, source, status, details)
      VALUES (${action.type}, ${action.source}, 'failed',
        ${JSON.stringify({ id: action.id, error: String(err.message) })})
    `).catch(() => {});

    /* Auto-retry once at low priority */
    if (!action.type.startsWith("RETRY_")) {
      enqueueAction({
        type:     `RETRY_${action.type}`,
        priority: 1,
        source:   "SYSTEM",
        payload:  action.payload,
        fn:       action.fn,
      });
    }
  } finally {
    if (action.type === "TENANT_REPAIR" && action.payload?.userId)
      markRepairEnd(action.payload.userId);
    if (action.type === "GLOBAL_RECOVERY")
      setRecoveryRunning(false);
  }
}

/* ══════════════════════════════════════════════════════════════════
   Queue Processor
   ══════════════════════════════════════════════════════════════════ */

export async function processQueue(): Promise<void> {
  if (_processing) return;
  _processing = true;
  try {
    while (actionQueue.length > 0) {
      const action = actionQueue.shift()!;
      const check  = isBlocked(action);
      if (check.blocked) {
        console.log(`[GovernanceKernel] ⛔ Skipped: ${action.type} — ${check.reason}`);
        continue;
      }
      await executeSafely(action);
    }
  } finally {
    _processing = false;
  }
}

/* ══════════════════════════════════════════════════════════════════
   DB Bootstrap — governance_action_log table
   ══════════════════════════════════════════════════════════════════ */

export async function ensureGovernanceTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS governance_action_log (
      id          BIGSERIAL PRIMARY KEY,
      action_type TEXT        NOT NULL,
      source      TEXT        NOT NULL DEFAULT 'unknown',
      status      TEXT        NOT NULL DEFAULT 'queued',
      details     JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_gov_log_created
    ON governance_action_log(created_at DESC)
  `);
}
