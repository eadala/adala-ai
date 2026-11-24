/**
 * Case Events — نظام الأحداث للقضايا
 * ─────────────────────────────────────
 * EventBus داخلي للقضايا يُحوِّل أحداثه تلقائياً للـ EDA العام
 *
 * Stage 15.2e — CASE_CREATED/UPDATED must carry canonical officeId (never invent default).
 */

import EventEmitter from "events";
import { eventBus } from "../core/eventBus";
import { isUuid } from "../lib/officePageResolverLogic";

class CaseEventBus extends EventEmitter {}
export const CaseEvents = new CaseEventBus();

type CaseEventPayload = {
  id?: unknown;
  officeId?: unknown;
  office_id?: unknown;
  createdBy?: unknown;
  title?: unknown;
  clientName?: unknown;
  caseType?: unknown;
  status?: unknown;
  assignedTo?: unknown;
};

function canonicalOfficeId(data: CaseEventPayload | null | undefined): string | undefined {
  const raw = data?.officeId ?? data?.office_id;
  if (raw == null) return undefined;
  const id = String(raw);
  return isUuid(id) ? id : undefined;
}

/* ── Bridge to global EDA ── */
CaseEvents.on("CASE_CREATED", (data: CaseEventPayload) => {
  const officeId = canonicalOfficeId(data);
  eventBus.emit({
    type:     "CASE_CREATED",
    officeId,
    actorId:  data.createdBy != null ? String(data.createdBy) : undefined,
    data: {
      caseId: data.id,
      title: data.title,
      clientName: data.clientName,
      caseType: data.caseType,
      status: data.status,
      officeId,
    },
  }).catch((e: unknown) => {
    console.error("[CaseEvents] CASE_CREATED emit failed:", e instanceof Error ? e.message : e);
  });
});

CaseEvents.on("CASE_UPDATED", ({ after }: { after: CaseEventPayload }) => {
  const evType = after.status === "closed" ? "CASE_CLOSED" : "CASE_UPDATED";
  const officeId = canonicalOfficeId(after);
  eventBus.emit({
    type: evType,
    officeId,
    data: {
      caseId: after.id,
      title: after.title,
      status: after.status,
      assignedTo: after.assignedTo,
      officeId,
    },
  }).catch((e: unknown) => {
    console.error(`[CaseEvents] ${evType} emit failed:`, e instanceof Error ? e.message : e);
  });
});

CaseEvents.on("CASE_DELETED", (_data: CaseEventPayload) => {
  /* CASE_DELETED not in global EventType — handled locally only */
});

/* ── CASE_CLOSED: تنظيف وإشعار عند إغلاق القضية ── */
CaseEvents.on("CASE_UPDATED", async ({
  before,
  after,
}: {
  before?: CaseEventPayload | null;
  after: CaseEventPayload;
}) => {
  if (!before || before.status === after.status) return;
  if (after.status !== "closed") return;

  /* إنشاء إشعار نهاية القضية في سجل الأنشطة */
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");

    /* 1. إضافة إدخال في timeline للإغلاق */
    try {
      await db.execute(sql`
        INSERT INTO case_timeline (case_id, type, title, description, created_at)
        VALUES (
          ${after.id},
          'status_change',
          'تم إغلاق القضية',
          ${"تم تغيير الحالة من " + (before.status ?? "مفتوحة") + " إلى مغلقة"},
          NOW()
        )
      `);
    } catch (e: unknown) {
      console.error("[CaseEvents] timeline insert failed:", e instanceof Error ? e.message : e);
    }

    /* 2. نقل كل جلسات القضية القادمة إلى "ملغية" */
    try {
      await db.execute(sql`
        UPDATE case_hearings
        SET status = 'cancelled', updated_at = NOW()
        WHERE case_id = ${after.id}
          AND hearing_date > NOW()
          AND status NOT IN ('completed','cancelled')
      `);
    } catch (e: unknown) {
      console.error("[CaseEvents] hearings cancel failed:", e instanceof Error ? e.message : e);
    }

    /* 3. إلغاء الأحداث المرتبطة بالقضية في التقويم */
    try {
      await db.execute(sql`
        UPDATE events
        SET status = 'cancelled', updated_at = NOW()
        WHERE case_id = ${after.id}
          AND start_at > NOW()
          AND status != 'cancelled'
      `);
    } catch (e: unknown) {
      console.error("[CaseEvents] calendar cancel failed:", e instanceof Error ? e.message : e);
    }

  } catch (e: unknown) {
    console.error("[CaseEvents] CASE_CLOSED side-effects failed:", e instanceof Error ? e.message : e);
  }
});
