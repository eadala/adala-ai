/**
 * Stage 16.5 — analytics delivery ownership (canonical Office UUID only).
 * Pure helpers — no DB import (safe for unit tests without DATABASE_URL).
 * Uses neutral tenant helpers (not Autopilot-named APIs).
 */
import { classifyTenantId } from "./tenantResolution";
import { toUuid } from "./taskTenantVisibility";
import type { StoredEvent } from "../core/eventBus";

/** Canonical Office UUID only — rejects default / platform / trial_* / NULL / text. */
export function resolveAnalyticsOfficeId(raw: unknown): string | null {
  const kind = classifyTenantId(
    raw == null || raw === "" ? null : String(raw),
  );
  if (kind !== "uuid") return null;
  return toUuid(raw);
}

export type AnalyticsSkipReason =
  | "MISSING_CANONICAL_OFFICE_UUID"
  | "NON_UUID_OFFICE_ID";

export function logAnalyticsSkip(fields: {
  eventType: string;
  eventId?: string | null;
  officeIdRaw?: unknown;
  reason: AnalyticsSkipReason;
}): void {
  console.warn("[AnalyticsListener] skip", {
    eventType: fields.eventType,
    eventId: fields.eventId ?? null,
    officeIdRaw:
      fields.officeIdRaw === undefined ? null : String(fields.officeIdRaw ?? "null"),
    reason: fields.reason,
  });
}

export type AnalyticsUpsertFn = (
  officeId: string,
  eventType: string,
) => Promise<void>;

/**
 * Resolve ownership and upsert daily counts via injected function.
 * Returns "skipped" without throwing when officeId is not a canonical UUID.
 */
export async function trackOwnedAnalyticsEvent(input: {
  event: StoredEvent;
  upsertFn: AnalyticsUpsertFn;
}): Promise<"tracked" | "skipped"> {
  const officeId = resolveAnalyticsOfficeId(input.event.officeId);
  if (!officeId) {
    const raw = input.event.officeId;
    logAnalyticsSkip({
      eventType: input.event.type,
      eventId: input.event.id ?? null,
      officeIdRaw: raw,
      reason:
        raw == null || raw === ""
          ? "MISSING_CANONICAL_OFFICE_UUID"
          : "NON_UUID_OFFICE_ID",
    });
    return "skipped";
  }

  await input.upsertFn(officeId, input.event.type);
  return "tracked";
}
