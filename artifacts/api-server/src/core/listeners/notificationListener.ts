/**
 * Notification Listener — reacts to events and fires notifications
 * Respects per-office settings stored in office_notification_settings
 */
import { eventBus, StoredEvent } from "../eventBus";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sendPushToOffice } from "../../lib/webPush";

/* ── Per-office settings cache (5 min TTL) ──────────────────────── */
type Channel = "push_enabled" | "in_app_enabled" | "email_enabled";
interface SettingRow { event_type: string; push_enabled: boolean; in_app_enabled: boolean; email_enabled: boolean; }

const cache = new Map<string, { rows: SettingRow[]; ts: number }>();
const TTL = 5 * 60 * 1000;

async function getSettings(officeId: string): Promise<SettingRow[]> {
  const hit = cache.get(officeId);
  if (hit && Date.now() - hit.ts < TTL) return hit.rows;
  try {
    const res = await db.execute(sql`
      SELECT event_type, push_enabled, in_app_enabled, email_enabled
      FROM office_notification_settings
      WHERE office_id = ${officeId}
    `);
    const rows = (res.rows ?? []) as SettingRow[];
    cache.set(officeId, { rows, ts: Date.now() });
    return rows;
  } catch {
    return [];
  }
}

export function invalidateSettingsCache(officeId: string) {
  cache.delete(officeId);
}

async function isEnabled(officeId: string, eventType: string, channel: Channel): Promise<boolean> {
  const rows = await getSettings(officeId);
  const row = rows.find(r => r.event_type === eventType);
  if (!row) return true; // default: enabled
  return row[channel] === true;
}

/* ── Helpers ────────────────────────────────────────────────────── */
async function createInAppNotification(officeId: string, eventType: string, title: string, body: string, link?: string) {
  if (!(await isEnabled(officeId, eventType, "in_app_enabled"))) return;
  try {
    await db.execute(sql`
      INSERT INTO notifications (office_id, title, body, link, is_read, created_at)
      VALUES (${officeId}, ${title}, ${body}, ${link ?? null}, false, NOW())
    `).catch(() => {});
  } catch {}
}

async function pushOffice(officeId: string, eventType: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!(await isEnabled(officeId, eventType, "push_enabled"))) return;
  sendPushToOffice(officeId, payload).catch(() => {});
}

/* ── Listeners ──────────────────────────────────────────────────── */
export function registerNotificationListeners() {

  eventBus.on("CASE_CREATED", async (event: StoredEvent) => {
    const { title, clientName } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "CASE_CREATED", "⚖️ قضية جديدة",
      `تم فتح قضية: "${title}" للعميل ${clientName ?? "غير محدد"}`, "/cases");
    await pushOffice(officeId, "CASE_CREATED", {
      title: "⚖️ قضية جديدة", body: `"${title}" — ${clientName ?? ""}`,
      url: "/cases", tag: "case_created",
    });
  });

  eventBus.on("CASE_CLOSED", async (event: StoredEvent) => {
    const { title, clientName } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "CASE_CLOSED", "✅ قضية مُغلقة",
      `تم إغلاق القضية: "${title}" — ${clientName ?? ""}`, "/cases");
    await pushOffice(officeId, "CASE_CLOSED", {
      title: "✅ قضية مُغلقة", body: `"${title}"`,
      url: "/cases", tag: "case_closed",
    });
  });

  eventBus.on("CASE_UPDATED", async (event: StoredEvent) => {
    const { title } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "CASE_UPDATED", "🔄 تحديث قضية",
      `تم تحديث القضية: "${title ?? ""}"`, "/cases");
    await pushOffice(officeId, "CASE_UPDATED", {
      title: "🔄 تحديث قضية", body: title ?? "",
      url: "/cases", tag: "case_updated",
    });
  });

  eventBus.on("CLIENT_ADDED", async (event: StoredEvent) => {
    const { fullName, email } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "CLIENT_ADDED", "👤 عميل جديد",
      `تم تسجيل العميل: ${fullName}${email ? ` (${email})` : ""}`, "/clients");
    await pushOffice(officeId, "CLIENT_ADDED", {
      title: "👤 عميل جديد", body: fullName,
      url: "/clients", tag: "client_added",
    });
  });

  eventBus.on("INVOICE_CREATED", async (event: StoredEvent) => {
    const { invoiceNumber, total } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "INVOICE_CREATED", "🧾 فاتورة جديدة",
      `تم إنشاء الفاتورة ${invoiceNumber} بمبلغ ${Number(total).toLocaleString("ar-SA")} ر.س`, "/invoices");
    await pushOffice(officeId, "INVOICE_CREATED", {
      title: "🧾 فاتورة جديدة", body: `${invoiceNumber} — ${Number(total).toLocaleString("ar-SA")} ر.س`,
      url: "/invoices", tag: "invoice_created",
    });
  });

  eventBus.on("INVOICE_PAID", async (event: StoredEvent) => {
    const { invoiceNumber, total } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "INVOICE_PAID", "💰 دفعة مستلمة",
      `تم دفع الفاتورة ${invoiceNumber} — ${Number(total).toLocaleString("ar-SA")} ر.س`, "/payment-center");
    await pushOffice(officeId, "INVOICE_PAID", {
      title: "💰 دفعة مستلمة", body: `${invoiceNumber} — ${Number(total).toLocaleString("ar-SA")} ر.س`,
      url: "/payment-center", tag: "invoice_paid",
    });
  });

  eventBus.on("INVOICE_OVERDUE", async (event: StoredEvent) => {
    const { invoiceNumber, total, clientName } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "INVOICE_OVERDUE", "⚠️ فاتورة متأخرة",
      `الفاتورة ${invoiceNumber} من ${clientName ?? "عميل"} — ${Number(total).toLocaleString("ar-SA")} ر.س`, "/invoices");
    await pushOffice(officeId, "INVOICE_OVERDUE", {
      title: "⚠️ فاتورة متأخرة", body: `${invoiceNumber} — ${clientName ?? ""}`,
      url: "/invoices", tag: "invoice_overdue",
    });
  });

  eventBus.on("PAYMENT_SUCCESS", async (event: StoredEvent) => {
    const { amount, clientName, gateway } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "PAYMENT_SUCCESS", "✅ دفعة ناجحة",
      `استُلمت ${Number(amount).toLocaleString("ar-SA")} ر.س من ${clientName ?? "عميل"} عبر ${gateway ?? ""}`, "/payment-center");
    await pushOffice(officeId, "PAYMENT_SUCCESS", {
      title: "✅ دفعة ناجحة", body: `${Number(amount).toLocaleString("ar-SA")} ر.س — ${clientName ?? ""}`,
      url: "/payment-center", tag: "payment_success",
    });
  });

  eventBus.on("PAYMENT_FAILED", async (event: StoredEvent) => {
    const { amount, clientName } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "PAYMENT_FAILED", "❌ دفعة فاشلة",
      `فشلت دفعة ${Number(amount ?? 0).toLocaleString("ar-SA")} ر.س من ${clientName ?? "عميل"}`, "/payment-center");
    await pushOffice(officeId, "PAYMENT_FAILED", {
      title: "❌ دفعة فاشلة", body: clientName ?? "",
      url: "/payment-center", tag: "payment_failed",
    });
  });

  eventBus.on("DOCUMENT_GENERATED", async (event: StoredEvent) => {
    const { docType, title } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "DOCUMENT_GENERATED", "📄 وثيقة جاهزة",
      `تم إنشاء وثيقة: ${title ?? docType}`, "/legal-ai");
    await pushOffice(officeId, "DOCUMENT_GENERATED", {
      title: "📄 وثيقة جاهزة", body: title ?? docType ?? "",
      url: "/legal-ai", tag: "document_generated",
    });
  });

  eventBus.on("SESSION_REMINDER", async (event: StoredEvent) => {
    const { caseTitle, sessionDate } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "SESSION_REMINDER", "📅 تذكير بجلسة",
      `جلسة القضية "${caseTitle ?? ""}" — ${sessionDate ?? ""}`, "/cases");
    await pushOffice(officeId, "SESSION_REMINDER", {
      title: "📅 تذكير بجلسة", body: `"${caseTitle ?? ""}" — ${sessionDate ?? ""}`,
      url: "/cases", tag: "session_reminder",
    });
  });

  eventBus.on("TASK_DUE", async (event: StoredEvent) => {
    const { taskTitle } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(officeId, "TASK_DUE", "⏰ مهمة مستحقة",
      `المهمة "${taskTitle ?? ""}" تستحق الإنجاز اليوم`, "/cases");
    await pushOffice(officeId, "TASK_DUE", {
      title: "⏰ مهمة مستحقة", body: taskTitle ?? "",
      url: "/cases", tag: "task_due",
    });
  });
}
