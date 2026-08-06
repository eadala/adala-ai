/**
 * Stage 17 — finance EventBus ownership (canonical Office UUID only).
 * Pure helpers — no DB import (safe for unit tests without DATABASE_URL).
 * Uses neutral tenant helpers (not Autopilot-named APIs).
 */
import { classifyTenantId } from "./tenantResolution";
import { toUuid } from "./taskTenantVisibility";
import type { StoredEvent } from "../core/eventBus";

/** Canonical Office UUID only — rejects default / platform / trial_* / NULL / text. */
export function resolveFinanceOfficeId(raw: unknown): string | null {
  const kind = classifyTenantId(
    raw == null || raw === "" ? null : String(raw),
  );
  if (kind !== "uuid") return null;
  return toUuid(raw);
}

/**
 * Prefer top-level event.officeId (EventBus contract). Never invent from data.
 * data.officeId is ignored — producers must set StoredEvent.officeId.
 */
export function resolveFinanceEventOfficeId(event: StoredEvent): string | null {
  return resolveFinanceOfficeId(event.officeId);
}

export type FinanceSkipReason =
  | "MISSING_CANONICAL_OFFICE_UUID"
  | "NON_UUID_OFFICE_ID";

export function logFinanceSkip(fields: {
  eventType: string;
  eventId?: string | null;
  officeIdRaw?: unknown;
  reason: FinanceSkipReason;
}): void {
  console.warn("[FinanceListener] skip", {
    eventType: fields.eventType,
    eventId: fields.eventId ?? null,
    officeIdRaw:
      fields.officeIdRaw === undefined ? null : String(fields.officeIdRaw ?? "null"),
    reason: fields.reason,
  });
}

export type FinanceSideEffectFn = (officeId: string) => Promise<void>;

/**
 * Resolve ownership and run a finance side-effect.
 * Returns "skipped" without throwing when officeId is not a canonical UUID.
 */
export async function runOwnedFinanceEffect(input: {
  event: StoredEvent;
  eventType: string;
  effectFn: FinanceSideEffectFn;
}): Promise<"ok" | "skipped"> {
  const officeId = resolveFinanceEventOfficeId(input.event);
  if (!officeId) {
    const raw = input.event.officeId;
    logFinanceSkip({
      eventType: input.eventType,
      eventId: input.event.id ?? null,
      officeIdRaw: raw,
      reason:
        raw == null || raw === ""
          ? "MISSING_CANONICAL_OFFICE_UUID"
          : "NON_UUID_OFFICE_ID",
    });
    return "skipped";
  }

  await input.effectFn(officeId);
  return "ok";
}
