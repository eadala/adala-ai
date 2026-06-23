/**
 * System state — in-memory, single-process.
 * Persisted only through structured logs (→ Loki).
 */

export type ActionType =
  | "heal_triggered"
  | "heal_skipped_cooldown"
  | "heal_skipped_firing"
  | "risk_alert_sent"
  | "no_action"
  | "freeze_requested"
  | "unfreeze_requested";

export interface ActionRecord {
  ts:        string;
  alert:     string;
  severity:  string;
  action:    ActionType;
  riskScore: number;
  reason:    string;
}

export interface SystemState {
  healing:         boolean;
  healingUntil:    number;        // epoch ms — cooldown
  frozen:          boolean;
  lastRiskScore:   number;
  lastRiskStatus:  "STABLE" | "WARNING" | "CRITICAL";
  healCount:       number;
  actionLog:       ActionRecord[];  // last 50
}

const HEAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export const state: SystemState = {
  healing:        false,
  healingUntil:   0,
  frozen:         false,
  lastRiskScore:  0,
  lastRiskStatus: "STABLE",
  healCount:      0,
  actionLog:      [],
};

export function canHeal(): boolean {
  return !state.healing && Date.now() > state.healingUntil;
}

export function startHeal(): void {
  state.healing      = true;
  state.healCount   += 1;
  state.healingUntil = Date.now() + HEAL_COOLDOWN_MS;
  setTimeout(() => { state.healing = false; }, 60_000);
}

export function recordAction(record: Omit<ActionRecord, "ts">): void {
  state.actionLog.unshift({ ts: new Date().toISOString(), ...record });
  if (state.actionLog.length > 50) state.actionLog.length = 50;
}
