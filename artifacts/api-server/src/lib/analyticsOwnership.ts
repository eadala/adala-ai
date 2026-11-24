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

function extractDbError(err: unknown): { code: string | null; message: string } {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown; cause?: unknown };
    const code =
      typeof e.code === "string"
        ? e.code
        : e.cause && typeof e.cause === "object" && typeof (e.cause as { code?: unknown }).code === "string"
          ? String((e.cause as { code: string }).code)
          : null;
    const message =
      typeof e.message === "string"
        ? e.message
        : err instanceof Error
          ? err.message
          : String(err);
    return { code, message };
  }
  return { code: null, message: String(err) };
}

/** Structured upsert failure — no secrets; safe for ops logs. */
export function logAnalyticsUpsertFailure(fields: {
  eventType: string;
  officeId: string;
  eventId?: string | null;
  error: unknown;
}): void {
  const { code, message } = extractDbError(fields.error);
  console.error("[AnalyticsListener] upsert_failed", {
    eventType: fields.eventType,
    officeId: fields.officeId,
    eventId: fields.eventId ?? null,
    code,
    message,
  });
}

export type AnalyticsUpsertFn = (
  officeId: string,
  eventType: string,
) => Promise<void>;

/**
 * Resolve ownership and upsert daily counts via injected function.
 * Returns "skipped" without throwing when officeId is not a canonical UUID.
 * Upsert failures are logged structured and swallowed so EventBus fan-out continues.
 */
export async function trackOwnedAnalyticsEvent(input: {
  event: StoredEvent;
  upsertFn: AnalyticsUpsertFn;
}): Promise<"tracked" | "skipped" | "failed"> {
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

  try {
    await input.upsertFn(officeId, input.event.type);
    return "tracked";
  } catch (error) {
    logAnalyticsUpsertFailure({
      eventType: input.event.type,
      officeId,
      eventId: input.event.id ?? null,
      error,
    });
    return "failed";
  }
}
