/**
 * Analytics Listener — tracks all events for insights
 *
 * Stage 16.5 — never invent "default" / platform / trial_* ownership.
 * Upsert event_daily_counts only when event.officeId is a canonical Office UUID.
 * Schema authority: artifacts/api-server/migrations/027_event_daily_counts_schema_authority.sql
 *
 * Ops order: preflight 027 → clean duplicates if any → apply 027 → verify UNIQUE → deploy.
 */
import { eventBus, StoredEvent, EventType } from "../eventBus";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { trackOwnedAnalyticsEvent } from "../../lib/analyticsOwnership";

export {
  resolveAnalyticsOfficeId,
  logAnalyticsSkip,
  logAnalyticsUpsertFailure,
  trackOwnedAnalyticsEvent,
} from "../../lib/analyticsOwnership";

const EVENT_LABELS: Record<EventType, string> = {
  CASE_CREATED:        "قضية جديدة",
  CASE_UPDATED:        "تحديث قضية",
  CASE_CLOSED:         "قضية مُغلقة",
  CLIENT_ADDED:        "عميل جديد",
  INVOICE_CREATED:     "فاتورة منشأة",
  INVOICE_PAID:        "فاتورة مدفوعة",
  INVOICE_OVERDUE:     "فاتورة متأخرة",
  PAYMENT_SUCCESS:     "دفعة ناجحة",
  PAYMENT_FAILED:      "دفعة فاشلة",
  PAYMENT_SETTLED:     "تسوية دفعة",
  CONTRACT_SIGNED:     "عقد موقّع",
  REMINDER_DUE:        "تذكير مستحق",
  PORTAL_UPDATED:      "تحديث بوابة",
  AI_QUERY:            "استعلام AI",
  SUBSCRIPTION_RENEWED:"اشتراك متجدد",
  SUBSCRIPTION_EXPIRED:"اشتراك منتهٍ",
  USER_LOGIN:          "تسجيل دخول",
  DOCUMENT_GENERATED:        "وثيقة منشأة",
  SESSION_REMINDER:          "تذكير بجلسة",
  TASK_DUE:                  "مهمة مستحقة",
  BK_CASE_CREATED:           "إفلاس — ملف جديد",
  BK_CASE_CLOSED:            "إفلاس — ملف مُغلق",
  BK_DISTRIBUTION_EXECUTED:  "إفلاس — توزيع منفّذ",
  BK_CLAIM_APPROVED:         "إفلاس — مطالبة معتمدة",
  BK_ALERT_TRIGGERED:        "إفلاس — تنبيه حرج",
  NEW_MESSAGE:               "رسالة داخلية جديدة",
};

async function upsertDailyCount(officeId: string, eventType: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO event_daily_counts (event_type, office_id, event_date, count)
    VALUES (${eventType}, ${officeId}, CURRENT_DATE, 1)
    ON CONFLICT (event_type, office_id, event_date)
    DO UPDATE SET count = event_daily_counts.count + 1
  `);
}

export function registerAnalyticsListeners() {
  /* Track every single event with wildcard — UUID office only */
  eventBus.on("*", async (event: StoredEvent) => {
    /* trackOwnedAnalyticsEvent logs upsert failures; never throws into fan-out */
    await trackOwnedAnalyticsEvent({
      event,
      upsertFn: upsertDailyCount,
    });
  });

  /* Revenue analytics on payment success */
  eventBus.on("PAYMENT_SUCCESS", async (event: StoredEvent) => {
    const { amount } = event.data ?? {};
    if (!amount) return;
    /* Could extend: push to revenue_time_series table */
  });
}

export { EVENT_LABELS };
