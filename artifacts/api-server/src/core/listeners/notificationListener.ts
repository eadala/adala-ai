/**
 * Notification Listener — reacts to events and fires notifications
 */
import { eventBus, StoredEvent } from "../eventBus";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function createInAppNotification(officeId: string, title: string, body: string, link?: string) {
  try {
    await db.execute(sql`
      INSERT INTO notifications (office_id, title, body, link, is_read, created_at)
      VALUES (${officeId}, ${title}, ${body}, ${link ?? null}, false, NOW())
    `).catch(() => {});
  } catch {}
}

export function registerNotificationListeners() {
  /* CASE_CREATED → notify assigned lawyer */
  eventBus.on("CASE_CREATED", async (event: StoredEvent) => {
    const { title, clientName, assignedTo, caseType } = event.data;
    const officeId = event.officeId ?? "default";
    console.log(`[Notify] CASE_CREATED: "${title}" — ${clientName ?? "?"}`);

    await createInAppNotification(
      officeId,
      "⚖️ قضية جديدة",
      `تم فتح قضية: "${title}" للعميل ${clientName ?? "غير محدد"}`,
      `/cases`
    );
  });

  /* CASE_CLOSED → office notification */
  eventBus.on("CASE_CLOSED", async (event: StoredEvent) => {
    const { title, clientName } = event.data;
    const officeId = event.officeId ?? "default";
    console.log(`[Notify] CASE_CLOSED: "${title}"`);

    await createInAppNotification(
      officeId,
      "✅ قضية مُغلقة",
      `تم إغلاق القضية: "${title}" — ${clientName ?? ""}`,
      `/cases`
    );
  });

  /* CLIENT_ADDED → welcome */
  eventBus.on("CLIENT_ADDED", async (event: StoredEvent) => {
    const { fullName, email } = event.data;
    const officeId = event.officeId ?? "default";
    console.log(`[Notify] CLIENT_ADDED: ${fullName}`);

    await createInAppNotification(
      officeId,
      "👤 عميل جديد",
      `تم تسجيل العميل: ${fullName}${email ? ` (${email})` : ""}`,
      `/clients`
    );
  });

  /* INVOICE_CREATED → remind to send */
  eventBus.on("INVOICE_CREATED", async (event: StoredEvent) => {
    const { invoiceNumber, total, clientId } = event.data;
    const officeId = event.officeId ?? "default";
    console.log(`[Notify] INVOICE_CREATED: ${invoiceNumber} — ${total} SAR`);

    await createInAppNotification(
      officeId,
      "🧾 فاتورة جديدة",
      `تم إنشاء الفاتورة ${invoiceNumber} بمبلغ ${Number(total).toLocaleString("ar-SA")} ر.س`,
      `/invoices`
    );
  });

  /* INVOICE_PAID → celebrate */
  eventBus.on("INVOICE_PAID", async (event: StoredEvent) => {
    const { invoiceNumber, total } = event.data;
    const officeId = event.officeId ?? "default";
    console.log(`[Notify] INVOICE_PAID: ${invoiceNumber}`);

    await createInAppNotification(
      officeId,
      "💰 دفعة مستلمة",
      `تم دفع الفاتورة ${invoiceNumber} — ${Number(total).toLocaleString("ar-SA")} ر.س`,
      `/payment-center`
    );
  });

  /* PAYMENT_SUCCESS */
  eventBus.on("PAYMENT_SUCCESS", async (event: StoredEvent) => {
    const { amount, clientName, gateway } = event.data;
    const officeId = event.officeId ?? "default";
    console.log(`[Notify] PAYMENT_SUCCESS: ${amount} SAR via ${gateway ?? "?"}`);

    await createInAppNotification(
      officeId,
      "✅ دفعة ناجحة",
      `استُلمت ${Number(amount).toLocaleString("ar-SA")} ر.س من ${clientName ?? "عميل"} عبر ${gateway ?? ""}`,
      `/payment-center`
    );
  });

  /* DOCUMENT_GENERATED */
  eventBus.on("DOCUMENT_GENERATED", async (event: StoredEvent) => {
    const { docType, title } = event.data;
    const officeId = event.officeId ?? "default";
    await createInAppNotification(
      officeId,
      "📄 وثيقة جاهزة",
      `تم إنشاء وثيقة: ${title ?? docType}`,
      `/legal-ai`
    );
  });
}
