/**
 * Case Events — نظام الأحداث للقضايا
 * ─────────────────────────────────────
 * EventBus داخلي للقضايا يُحوِّل أحداثه تلقائياً للـ EDA العام
 */

import EventEmitter from "events";
import { eventBus } from "../core/eventBus";

class CaseEventBus extends EventEmitter {}
export const CaseEvents = new CaseEventBus();

/* ── Bridge to global EDA ── */
CaseEvents.on("CASE_CREATED", (data: any) => {
  eventBus.emit({
    type:    "CASE_CREATED",
    actorId: data.createdBy,
    data:    { caseId: data.id, title: data.title, clientName: data.clientName, caseType: data.caseType, status: data.status },
  }).catch(() => {});
});

CaseEvents.on("CASE_UPDATED", ({ after }: any) => {
  const evType = after.status === "closed" ? "CASE_CLOSED" : "CASE_UPDATED";
  eventBus.emit({
    type: evType,
    data: { caseId: after.id, title: after.title, status: after.status, assignedTo: after.assignedTo },
  }).catch(() => {});
});

CaseEvents.on("CASE_DELETED", (_data: any) => {
  /* CASE_DELETED not in global EventType — handled locally only */
});
