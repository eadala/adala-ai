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

/* ── CASE_CLOSED: تنظيف وإشعار عند إغلاق القضية ── */
CaseEvents.on("CASE_UPDATED", async ({ before, after }: any) => {
  if (!before || before.status === after.status) return;
  if (after.status !== "closed") return;

  /* إنشاء إشعار نهاية القضية في سجل الأنشطة */
  try {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");

    /* 1. إضافة إدخال في timeline للإغلاق */
    await db.execute(sql`
      INSERT INTO case_timeline (case_id, type, title, description, created_at)
      VALUES (
        ${after.id},
        'status_change',
        'تم إغلاق القضية',
        ${"تم تغيير الحالة من " + (before.status ?? "مفتوحة") + " إلى مغلقة"},
        NOW()
      )
    `).catch(() => {});

    /* 2. نقل كل جلسات القضية القادمة إلى "ملغية" */
    await db.execute(sql`
      UPDATE case_hearings
      SET status = 'cancelled', updated_at = NOW()
      WHERE case_id = ${after.id}
        AND hearing_date > NOW()
        AND status NOT IN ('completed','cancelled')
    `).catch(() => {});

    /* 3. إلغاء الأحداث المرتبطة بالقضية في التقويم */
    await db.execute(sql`
      UPDATE events
      SET status = 'cancelled', updated_at = NOW()
      WHERE case_id = ${after.id}
        AND start_at > NOW()
        AND status != 'cancelled'
    `).catch(() => {});

  } catch { /* non-blocking */ }
});
