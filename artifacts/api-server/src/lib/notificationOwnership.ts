/**
 * Stage 16.4 — notification delivery ownership (canonical Office UUID only).
 * Pure helpers — no DB import (safe for unit tests without DATABASE_URL).
 */
import { resolveAutopilotOfficeId } from "../agents/autopilotTaskCreation";
import type { StoredEvent } from "../core/eventBus";

/** Canonical Office UUID only — rejects default / platform / trial_* / NULL / text. */
export function resolveNotificationOfficeId(raw: unknown): string | null {
  return resolveAutopilotOfficeId(raw);
}

export type NotificationSkipReason =
  | "MISSING_CANONICAL_OFFICE_UUID"
  | "NON_UUID_OFFICE_ID";

export function logNotificationSkip(fields: {
  eventType: string;
  eventId?: string | null;
  caseId?: string | null;
  officeIdRaw?: unknown;
  reason: NotificationSkipReason;
}): void {
  console.warn("[NotificationListener] skip", {
    eventType: fields.eventType,
    eventId: fields.eventId ?? null,
    caseId: fields.caseId ?? null,
    officeIdRaw:
      fields.officeIdRaw === undefined ? null : String(fields.officeIdRaw ?? "null"),
    reason: fields.reason,
  });
}

export type NotificationInsertFn = (
  officeId: string,
  eventType: string,
  title: string,
  body: string,
  link?: string,
) => Promise<void>;

export type NotificationPushFn = (
  officeId: string,
  eventType: string,
  payload: { title: string; body: string; url?: string; tag?: string },
) => Promise<void>;

/**
 * Resolve ownership and deliver in-app + push via injected functions.
 * Returns "skipped" without throwing when officeId is not a canonical UUID.
 */
export async function deliverOwnedNotification(input: {
  event: StoredEvent;
  eventType: string;
  title: string;
  body: string;
  link?: string;
  push?: { title: string; body: string; url?: string; tag?: string };
  insertFn: NotificationInsertFn;
  pushFn?: NotificationPushFn;
}): Promise<"delivered" | "skipped"> {
  const officeId = resolveNotificationOfficeId(input.event.officeId);
  if (!officeId) {
    const raw = input.event.officeId;
    logNotificationSkip({
      eventType: input.eventType,
      eventId: input.event.id ?? null,
      caseId:
        input.event.data?.caseId != null ? String(input.event.data.caseId) : null,
      officeIdRaw: raw,
      reason:
        raw == null || raw === ""
          ? "MISSING_CANONICAL_OFFICE_UUID"
          : "NON_UUID_OFFICE_ID",
    });
    return "skipped";
  }

  await input.insertFn(
    officeId,
    input.eventType,
    input.title,
    input.body,
    input.link,
  );
  if (input.push && input.pushFn) {
    await input.pushFn(officeId, input.eventType, input.push);
  }
  return "delivered";
}
