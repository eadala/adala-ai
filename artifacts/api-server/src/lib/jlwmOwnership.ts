/**
 * Stage 18 — JLWM EventBus ownership (canonical Office UUID only).
 * Pure helpers — no DB import (safe for unit tests without DATABASE_URL).
 * Uses existing classifyTenantId + toUuid (no parallel resolver).
 */
import { classifyTenantId } from "./tenantResolution";
import { toUuid } from "./taskTenantVisibility";

/** Canonical Office UUID only — rejects default / platform / trial_* / NULL / text. */
export function resolveJlwmOfficeId(raw: unknown): string | null {
  const kind = classifyTenantId(
    raw == null || raw === "" ? null : String(raw),
  );
  if (kind !== "uuid") return null;
  return toUuid(raw);
}

export type JlwmSkipReason =
  | "MISSING_CANONICAL_OFFICE_UUID"
  | "NON_UUID_OFFICE_ID";

export function logJlwmSkip(fields: {
  trigger: string;
  eventType?: string | null;
  eventId?: string | null;
  officeIdRaw?: unknown;
  reason: JlwmSkipReason;
}): void {
  console.warn("[JLWM] skip_rebuild", {
    trigger: fields.trigger,
    eventType: fields.eventType ?? null,
    eventId: fields.eventId ?? null,
    officeIdRaw:
      fields.officeIdRaw === undefined ? null : String(fields.officeIdRaw ?? "null"),
    reason: fields.reason,
  });
}

export type JlwmRebuildFn = (
  officeId: string,
  trigger: string,
) => Promise<unknown>;

/**
 * Resolve ownership and run a JLWM rebuild side-effect.
 * Returns "skipped" without throwing when officeId is not a canonical UUID.
 */
export async function runOwnedJlwmRebuild(input: {
  officeIdRaw: unknown;
  trigger: string;
  eventType?: string | null;
  eventId?: string | null;
  rebuildFn: JlwmRebuildFn;
}): Promise<"ok" | "skipped"> {
  const officeId = resolveJlwmOfficeId(input.officeIdRaw);
  if (!officeId) {
    const raw = input.officeIdRaw;
    logJlwmSkip({
      trigger: input.trigger,
      eventType: input.eventType ?? null,
      eventId: input.eventId ?? null,
      officeIdRaw: raw,
      reason:
        raw == null || raw === ""
          ? "MISSING_CANONICAL_OFFICE_UUID"
          : "NON_UUID_OFFICE_ID",
    });
    return "skipped";
  }

  await input.rebuildFn(officeId, input.trigger);
  return "ok";
}
