import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import cron from "node-cron";
import { logger } from "../lib/logger";

async function sqlOne(q: any) {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

async function sqlAll(q: any) {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

async function ensureSchema() {
  try {
    await db.execute(sql`
      ALTER TABLE email_notification_logs
        ADD COLUMN IF NOT EXISTS recipient_ref TEXT DEFAULT ''
    `);
  } catch {}
}

async function getSettings() {
  try {
    return await sqlOne(sql`
      SELECT * FROM email_notification_settings WHERE office_id = 'default' LIMIT 1
    `);
  } catch { return null; }
}

function makeTransporter(settings: any) {
  if (!settings?.smtp_host || !settings?.smtp_user || !settings?.smtp_pass) return null;
  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: parseInt(String(settings.smtp_port ?? 587)),
    secure: parseInt(String(settings.smtp_port ?? 587)) === 465,
    auth: { user: settings.smtp_user, pass: settings.smtp_pass },
  });
}

async function alreadySent(type: string, refId: string): Promise<boolean> {
  const row = await sqlOne(sql`
    SELECT id FROM email_notification_logs
    WHERE office_id = 'default'
      AND type       = ${type}
      AND recipient_ref = ${refId}
      AND sent_at    > NOW() - INTERVAL '23 hours'
    LIMIT 1
  `);
  return !!row;
}

async function logSend(
  type: string, recipient: string, subject: string,
  status: string, error: string | null, refId: string,
) {
  try {
    await db.execute(sql`
      INSERT INTO email_notification_logs
        (office_id, type, recipient, subject, status, error, recipient_ref)
      VALUES ('default', ${type}, ${recipient}, ${subject}, ${status}, ${error ?? null}, ${refId})
    `);
  } catch {}
}

function html(title: string, accent: string, rows: [string, string][], note?: string) {
  const rowsHtml = rows.map(([lbl, val]) => `
    <tr>
      <td style="padding:9px 12px;background:#f3f4f6;font-weight:700;width:38%;color:#374151;border-radius:5px">${lbl}</td>
      <td style="padding:9px 12px;color:#111">${val}</td>
    </tr>`).join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head><body style="margin:0;padding:20px;background:#f9fafb;font-family:'Cairo',Arial,sans-serif">
    <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 2px 16px rgba(0,0,0,.06)">
      <div style="background:linear-gradient(135deg,#0f1c35,#1A2744);padding:22px 28px;border-right:5px solid ${accent}">
        <div style="color:${accent};font-size:20px;font-weight:900;margin-bottom:4px">🔔 عدالة AI</div>
        <div style="color:rgba(255,255,255,.65);font-size:13px">${title}</div>
      </div>
      <div style="padding:22px 28px">
        <table style="width:100%;border-collapse:separate;border-spacing:0 5px">${rowsHtml}</table>
        ${note ? `<div style="margin-top:16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e">⚠️ ${note}</div>` : ""}
      </div>
      <div style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px">
        منصة عدالة AI · نظام التشغيل القانوني الذكي · إشعار تلقائي
      </div>
    </div></body></html>`;
}

async function invoiceReminders(settings: any, tr: any) {
  const triggers = settings.triggers ?? {};
  if (triggers.invoice_due === false) return 0;

  const rows = await sqlAll(sql`
    SELECT i.id, i.invoice_number, i.total, i.due_date,
           c.email AS client_email, c.full_name AS client_name
    FROM client_invoices i
    LEFT JOIN clients c ON c.id::text = i.client_id
    WHERE i.status NOT IN ('paid','cancelled')
      AND i.due_date IS NOT NULL
      AND i.due_date::date BETWEEN CURRENT_DATE + INTERVAL '1 day'
                                AND CURRENT_DATE + INTERVAL '3 days'
  `);

  let sent = 0;
  for (const inv of rows) {
    const email = inv.client_email;
    if (!email) continue;
    const refId = `invoice_${inv.id}_due3d`;
    if (await alreadySent("invoice_due", refId)) continue;

    const daysLeft = Math.round(
      (new Date(inv.due_date).getTime() - Date.now()) / 86_400_000,
    );
    const amount = (parseInt(String(inv.total ?? 0)) / 100).toLocaleString("ar-SA");
    const subject = `تذكير: فاتورة مستحقة خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`;

    const body = html(
      `فاتورة رقم ${inv.invoice_number ?? inv.id} مستحقة قريباً`,
      "#C9A84C",
      [
        ["العميل",          inv.client_name ?? "—"],
        ["رقم الفاتورة",    inv.invoice_number ?? String(inv.id)],
        ["المبلغ",           `${amount} ر.س`],
        ["تاريخ الاستحقاق", new Date(inv.due_date).toLocaleDateString("ar-SA")],
        ["الأيام المتبقية", `${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`],
      ],
      "يُرجى تسوية الفاتورة قبل تاريخ الاستحقاق لتجنب أي تأخير.",
    );

    try {
      await tr.sendMail({
        from: `"${settings.from_name ?? "عدالة AI"}" <${settings.from_email ?? settings.smtp_user}>`,
        to: email, subject, html: body,
      });
      await logSend("invoice_due", email, subject, "sent", null, refId);
      sent++;
    } catch (e: any) {
      await logSend("invoice_due", email, subject, "failed", e.message, refId);
    }
  }
  return sent;
}

async function sessionReminders(settings: any, tr: any) {
  const triggers = settings.triggers ?? {};
  if (triggers.case_session === false) return 0;

  const rows = await sqlAll(sql`
    SELECT e.id, e.title, e.event_type, e.start_at, e.location, e.description,
           er.email AS reminder_email
    FROM events e
    LEFT JOIN event_reminders er ON er.event_id = e.id
    WHERE e.start_at::date = CURRENT_DATE + INTERVAL '1 day'
      AND e.status != 'cancelled'
  `);

  const typeLabels: Record<string, string> = {
    court_session: "جلسة محكمة", deadline: "موعد نهائي",
    client_meeting: "اجتماع عميل", team_meeting: "اجتماع فريق",
    task: "مهمة", other: "حدث",
  };

  const officeEmail = settings.from_email ?? settings.smtp_user;
  let sent = 0;

  const seen = new Set<string>();
  for (const ev of rows) {
    const email = ev.reminder_email || officeEmail;
    if (!email) continue;
    const dedup = `${ev.id}::${email}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const refId = `event_${ev.id}_${email}_tomorrow`;
    if (await alreadySent("session_tomorrow", refId)) continue;

    const typeLabel = typeLabels[ev.event_type] ?? "حدث";
    const startTime = new Date(ev.start_at).toLocaleTimeString("ar-SA", {
      hour: "2-digit", minute: "2-digit",
    });
    const subject = `تذكير: ${typeLabel} غداً — ${ev.title}`;

    const detailRows: [string, string][] = [
      ["الموعد", ev.title],
      ["النوع",  typeLabel],
      ["الوقت",  startTime],
    ];
    if (ev.location)    detailRows.push(["المكان",   ev.location]);
    if (ev.description) detailRows.push(["ملاحظات",  ev.description]);

    const body = html(`${typeLabel} مقرر غداً`, "#6366F1", detailRows);

    try {
      await tr.sendMail({
        from: `"${settings.from_name ?? "عدالة AI"}" <${settings.from_email ?? settings.smtp_user}>`,
        to: email, subject, html: body,
      });
      await logSend("session_tomorrow", email, subject, "sent", null, refId);
      sent++;
    } catch (e: any) {
      await logSend("session_tomorrow", email, subject, "failed", e.message, refId);
    }
  }
  return sent;
}

async function remindersDue(settings: any, tr: any) {
  const triggers = settings.triggers ?? {};
  if (triggers.reminder_due === false) return 0;

  const rows = await sqlAll(sql`
    SELECT r.id, r.title, r.body, r.due_time, r.priority, r.category,
           u.email AS user_email
    FROM reminders r
    LEFT JOIN users u ON u.clerk_id = r.created_by
    WHERE r.done = FALSE
      AND r.due_date::date = CURRENT_DATE
      AND r.office_id = 'default'
  `);

  const priorityLabels: Record<string, string> = {
    high: "🔴 عالية", medium: "🟡 متوسطة", low: "🟢 منخفضة",
  };
  const officeEmail = settings.from_email ?? settings.smtp_user;
  let sent = 0;

  for (const rem of rows) {
    const email = rem.user_email || officeEmail;
    if (!email) continue;
    const refId = `reminder_${rem.id}_today`;
    if (await alreadySent("reminder_due", refId)) continue;

    const subject = `تذكير اليوم: ${rem.title}`;
    const detailRows: [string, string][] = [
      ["العنوان",  rem.title],
      ["الأولوية", priorityLabels[rem.priority] ?? rem.priority],
      ["الفئة",    rem.category],
    ];
    if (rem.body)     detailRows.push(["التفاصيل", rem.body]);
    if (rem.due_time) detailRows.push(["الوقت",    rem.due_time]);

    const body = html("تذكير مستحق اليوم", "#10B981", detailRows);

    try {
      await tr.sendMail({
        from: `"${settings.from_name ?? "عدالة AI"}" <${settings.from_email ?? settings.smtp_user}>`,
        to: email, subject, html: body,
      });
      await logSend("reminder_due", email, subject, "sent", null, refId);
      sent++;
    } catch (e: any) {
      await logSend("reminder_due", email, subject, "failed", e.message, refId);
    }
  }
  return sent;
}

async function caseDeadlineReminders(settings: any, tr: any) {
  const triggers = settings.triggers ?? {};
  if (triggers.case_deadline === false) return 0;

  const rows = await sqlAll(sql`
    SELECT c.id, c.title, c.case_type, c.next_hearing_date AS next_hearing,
           cl.email AS client_email, cl.full_name AS client_name
    FROM cases c
    LEFT JOIN clients cl ON cl.id::text = c.client_id::text
    WHERE c.next_hearing_date IS NOT NULL
      AND c.next_hearing_date::date BETWEEN CURRENT_DATE + INTERVAL '1 day'
                                        AND CURRENT_DATE + INTERVAL '3 days'
      AND c.status != 'closed'
  `);

  const typeLabels: Record<string, string> = {
    criminal: "جنائية", civil: "مدنية", commercial: "تجارية",
    labor: "عمالية", real_estate: "عقارية", family: "أسرية", other: "أخرى",
  };

  const officeEmail = settings.from_email ?? settings.smtp_user;
  let sent = 0;

  for (const cas of rows) {
    const email = cas.client_email || officeEmail;
    if (!email) continue;
    const refId = `case_${cas.id}_hearing`;
    if (await alreadySent("case_deadline", refId)) continue;

    const daysLeft = Math.round(
      (new Date(cas.next_hearing).getTime() - Date.now()) / 86_400_000,
    );
    const subject = `تذكير: جلسة قضية "${cas.title}" خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`;
    const body = html(
      `جلسة مقبلة — ${cas.title}`,
      "#6366F1",
      [
        ["عنوان القضية",  cas.title],
        ["نوع القضية",   typeLabels[cas.case_type] ?? cas.case_type ?? "—"],
        ["تاريخ الجلسة",  new Date(cas.next_hearing).toLocaleDateString("ar-SA")],
        ["الأيام المتبقية", `${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`],
      ],
      "يُرجى التحضير الكافي قبل موعد الجلسة.",
    );

    try {
      await tr.sendMail({
        from: `"${settings.from_name ?? "عدالة AI"}" <${settings.from_email ?? settings.smtp_user}>`,
        to: email, subject, html: body,
      });
      await logSend("case_deadline", email, subject, "sent", null, refId);
      sent++;
    } catch (e: any) {
      await logSend("case_deadline", email, subject, "failed", e.message, refId);
    }
  }
  return sent;
}

export async function runEmailCron(): Promise<{ invoices: number; sessions: number; reminders: number; caseDeadlines: number }> {
  await ensureSchema();
  const settings = await getSettings();
  if (!settings?.enabled) return { invoices: 0, sessions: 0, reminders: 0, caseDeadlines: 0 };

  const tr = makeTransporter(settings);
  if (!tr) return { invoices: 0, sessions: 0, reminders: 0, caseDeadlines: 0 };

  const [invoices, sessions, reminders, caseDeadlines] = await Promise.all([
    invoiceReminders(settings, tr),
    sessionReminders(settings, tr),
    remindersDue(settings, tr),
    caseDeadlineReminders(settings, tr),
  ]);

  logger.info({ invoices, sessions, reminders, caseDeadlines }, "Email cron run complete");
  return { invoices, sessions, reminders, caseDeadlines };
}

export function startEmailCron() {
  cron.schedule("0 * * * *", async () => {
    try { await runEmailCron(); }
    catch (e: any) { logger.error({ err: e.message }, "Email cron error"); }
  });
  logger.info("Email cron started — runs every hour at :00");
}
