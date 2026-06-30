/**
 * Analytics Listener — tracks all events for insights
 */
import { eventBus, StoredEvent, EventType } from "../eventBus";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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

async function ensureEventCountsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_daily_counts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type  TEXT NOT NULL,
      office_id   TEXT NOT NULL DEFAULT 'default',
      event_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      count       INTEGER NOT NULL DEFAULT 1,
      UNIQUE(event_type, office_id, event_date)
    )
  `).catch(() => {});
}
ensureEventCountsTable();

export function registerAnalyticsListeners() {
  /* Track every single event with wildcard */
  eventBus.on("*", async (event: StoredEvent) => {
    const officeId = event.officeId ?? "default";

    /* Upsert daily count */
    await db.execute(sql`
      INSERT INTO event_daily_counts (event_type, office_id, event_date, count)
      VALUES (${event.type}, ${officeId}, CURRENT_DATE, 1)
      ON CONFLICT (event_type, office_id, event_date)
      DO UPDATE SET count = event_daily_counts.count + 1
    `).catch(() => {});
  });

  /* Revenue analytics on payment success */
  eventBus.on("PAYMENT_SUCCESS", async (event: StoredEvent) => {
    const { amount, gateway } = event.data;
    if (!amount) return;
    /* Could extend: push to revenue_time_series table */
  });
}

export { EVENT_LABELS };
