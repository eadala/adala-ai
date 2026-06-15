/**
 * Production Lock — نواة نظام قفل الإنتاج
 * ─────────────────────────────────────────
 * يدير:
 *  • PRODUCTION_MODE   — وضع الإنتاج (يمنع تغييرات معمارية)
 *  • SAFE_MODE         — الوضع الآمن (يوقف العمليات الحساسة)
 *  • IMMUTABLE_MODULES — قائمة الوحدات المحمية من التعديل
 *  • AI_LOCK           — يمنع تنفيذ الذكاء الاصطناعي للعمليات
 *  • changeGate()      — بوابة التغيير (تسجيل + تقييم المخاطر)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ─── System State (in-memory + DB) ─── */
export type SystemMode = "stable" | "degraded" | "safe_mode";

interface HardeningState {
  mode:       SystemMode;
  reason:     string;
  activatedAt: string;
  activatedBy: string;
  aiLock:      boolean;       // AI تنفيذي مقفل؟
  productionMode: boolean;    // وضع الإنتاج (يمنع changes غير معتمدة)
}

let _state: HardeningState = {
  mode:          "stable",
  reason:        "System initialized",
  activatedAt:   new Date().toISOString(),
  activatedBy:   "system",
  aiLock:        false,
  productionMode: true,       // مُفعَّل دائماً في الإنتاج
};

export function getSystemState(): HardeningState { return { ..._state }; }

/* ─── Load from DB on boot ─── */
export async function loadHardeningState(): Promise<void> {
  try {
    const rows = await db.execute(sql`
      SELECT mode, reason, activated_by, activated_at
      FROM hardening_state WHERE is_active = true ORDER BY activated_at DESC LIMIT 1
    `);
    const row = ((rows.rows ?? rows) as any[])[0];
    if (row) {
      _state.mode        = row.mode        as SystemMode;
      _state.reason      = row.reason      ?? "";
      _state.activatedBy = row.activated_by ?? "system";
      _state.activatedAt = row.activated_at ?? new Date().toISOString();
    }
  } catch { /* non-fatal */ }
}

/* ─── Set System Mode ─── */
export async function setSystemMode(
  mode: SystemMode,
  reason: string,
  activatedBy: string
): Promise<void> {
  /* deactivate current */
  await db.execute(sql`
    UPDATE hardening_state SET is_active = false, deactivated_at = NOW()
    WHERE is_active = true
  `);
  /* insert new */
  await db.execute(sql`
    INSERT INTO hardening_state (mode, reason, activated_by)
    VALUES (${mode}, ${reason}, ${activatedBy})
  `);
  _state.mode        = mode;
  _state.reason      = reason;
  _state.activatedBy = activatedBy;
  _state.activatedAt = new Date().toISOString();
  console.log(`[ProductionLock] 🔒 Mode → ${mode.toUpperCase()} | reason: ${reason}`);
}

/* ─── AI Lock ─── */
export function setAiLock(locked: boolean): void {
  _state.aiLock = locked;
  console.log(`[ProductionLock] 🤖 AI lock → ${locked ? "ON" : "OFF"}`);
}
export function isAiLocked(): boolean { return _state.aiLock; }

/* ─── Safe Mode helpers ─── */
export function isInSafeMode(): boolean { return _state.mode === "safe_mode"; }
export function isProductionMode(): boolean { return _state.productionMode; }

/* ─── Immutable Modules ─── */
export const IMMUTABLE_MODULES = [
  { id: "stripe.webhook",    label: "Stripe Webhook Handler",  file: "src/routes/stripe.ts",              risk: "critical" },
  { id: "ledger.engine",     label: "Ledger Engine",           file: "src/engine/financial.engine.ts",    risk: "critical" },
  { id: "tenant.scope",      label: "Tenant Isolation Layer",  file: "src/isolation/tenant.scope.ts",     risk: "critical" },
  { id: "billing.core",      label: "Billing Service",         file: "src/routes/subscription.ts",        risk: "critical" },
  { id: "case.core",         label: "Case Service Core",       file: "src/routes/cases.ts",               risk: "high"     },
  { id: "auth.middleware",   label: "Auth Middleware",         file: "src/middlewares/requireAuth.ts",    risk: "high"     },
  { id: "production.lock",   label: "Production Lock",         file: "src/hardening/production.lock.ts", risk: "high"     },
  { id: "financial.guard",   label: "Financial Guard",         file: "src/hardening/financial.guard.ts", risk: "high"     },
] as const;

/* ─── Change Gate ─── */
export interface ChangeRequest {
  type:       "config" | "route" | "finance" | "stripe" | "ai" | "schema" | "module";
  affects:    string[];
  description: string;
  requestedBy: string;
}

const SENSITIVE_AFFECTS = ["finance", "stripe", "ledger", "billing", "tenant", "auth"];

export async function changeGate(change: ChangeRequest): Promise<{ allowed: boolean; requiresApproval: boolean; riskLevel: string }> {
  const isSensitive = change.affects.some(a => SENSITIVE_AFFECTS.includes(a));
  const isImmutable = IMMUTABLE_MODULES.some(m => change.affects.includes(m.id));

  const riskLevel: string = isImmutable ? "critical" : isSensitive ? "high" : "low";
  const requiresApproval  = isSensitive || isImmutable;

  /* Safe Mode: block all non-read changes */
  if (_state.mode === "safe_mode" && change.type !== "config") {
    await logChange({ ...change, riskLevel, requiresApproval, approved: false });
    return { allowed: false, requiresApproval: true, riskLevel };
  }

  await logChange({ ...change, riskLevel, requiresApproval, approved: !requiresApproval });
  return { allowed: !requiresApproval, requiresApproval, riskLevel };
}

async function logChange(c: ChangeRequest & { riskLevel: string; requiresApproval: boolean; approved?: boolean }): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO change_log (change_type, affects, description, risk_level, requires_approval, approved, created_by)
      VALUES (
        ${c.type},
        ${sql.raw(`ARRAY[${c.affects.map(a => `'${a.replace(/'/g, "''")}'`).join(",")}]::text[]`)},
        ${c.description},
        ${c.riskLevel},
        ${c.requiresApproval},
        ${c.approved ?? null},
        ${c.requestedBy}
      )
    `);
  } catch { /* non-fatal */ }
}
