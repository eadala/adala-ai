import { Router } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "../ai/aiChat";
import nodemailer from "nodemailer";

/* ── helpers ── */
function sqlOne<T = any>(q: ReturnType<typeof sql>): Promise<T | null> {
  return db.execute(q).then((r: any) => {
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return (rows[0] ?? null) as T | null;
  });
}

async function ensureNotifTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_coo_notif_settings (
      id                SERIAL PRIMARY KEY,
      office_id         TEXT NOT NULL UNIQUE,
      telegram_enabled  BOOLEAN DEFAULT false,
      whatsapp_enabled  BOOLEAN DEFAULT false,
      email_enabled     BOOLEAN DEFAULT false,
      min_level         TEXT DEFAULT 'critical',
      email_recipients  TEXT DEFAULT '',
      whatsapp_numbers  TEXT DEFAULT '',
      auto_notify       BOOLEAN DEFAULT false,
      last_notified_at  TIMESTAMPTZ,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
}

/* ── channel senders ── */
async function sendTelegramAlert(officeId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${officeId} OR office_id = 'default' ORDER BY (office_id = ${officeId}) DESC LIMIT 1`);
    if (!s?.bot_token || !s?.chat_id) return { ok: false, error: "Telegram غير مضبوط" };
    const r = await fetch(`https://api.telegram.org/bot${s.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: s.chat_id, text, parse_mode: "HTML" }),
    });
    const j = await r.json() as any;
    if (!j.ok) return { ok: false, error: j.description };
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

async function sendWhatsAppAlert(officeId: string, phones: string[], text: string): Promise<{ ok: boolean; sent: number; error?: string }> {
  try {
    const s = await sqlOne(sql`SELECT * FROM whatsapp_settings WHERE office_id = ${officeId} OR office_id = 'default' ORDER BY (office_id = ${officeId}) DESC LIMIT 1`);
    if (!s?.meta_token || !s?.meta_phone_id) return { ok: false, sent: 0, error: "WhatsApp غير مضبوط" };
    let sent = 0;
    for (const raw of phones.filter(Boolean)) {
      const phone = raw.replace(/\D/g, "");
      const to = phone.startsWith("0") ? "966" + phone.slice(1) : phone;
      const r = await fetch(`https://graph.facebook.com/v18.0/${s.meta_phone_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.meta_token}` },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      });
      const j = await r.json() as any;
      if (!j.error) sent++;
    }
    return { ok: sent > 0, sent };
  } catch (e: any) { return { ok: false, sent: 0, error: e.message }; }
}

async function sendEmailAlert(officeId: string, recipients: string[], subject: string, html: string): Promise<{ ok: boolean; sent: number; error?: string }> {
  try {
    const s = await sqlOne(sql`SELECT * FROM email_notification_settings WHERE office_id = ${officeId} OR office_id = 'default' ORDER BY (office_id = ${officeId}) DESC LIMIT 1`);
    if (!s?.smtp_host || !s?.smtp_user || !s?.smtp_pass) return { ok: false, sent: 0, error: "SMTP غير مضبوط" };
    const transporter = nodemailer.createTransport({
      host: s.smtp_host, port: parseInt(s.smtp_port ?? "587"),
      secure: s.smtp_secure === true, auth: { user: s.smtp_user, pass: s.smtp_pass },
    });
    let sent = 0;
    for (const to of recipients.filter(r => r?.includes("@"))) {
      await transporter.sendMail({
        from: `"${s.from_name ?? "عدالة AI — AI COO"}" <${s.from_email ?? s.smtp_user}>`,
        to, subject, html,
      }).then(() => sent++).catch(() => {});
    }
    return { ok: sent > 0, sent };
  } catch (e: any) { return { ok: false, sent: 0, error: e.message }; }
}

function buildAlertMessage(alerts: any[], healthScore: number, officeId: string): { text: string; html: string } {
  const date = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const critical = alerts.filter(a => a.level === "critical");
  const warning  = alerts.filter(a => a.level === "warning");
  const hsLabel  = healthScore >= 80 ? "ممتاز ✅" : healthScore >= 60 ? "جيد ⚠️" : "يحتاج تدخل 🔴";

  const lines = [
    `🧠 <b>تقرير AI COO — عدالة</b>`,
    `📅 ${date}`,
    `📊 الصحة التشغيلية: <b>${healthScore}/100</b> — ${hsLabel}`,
    ``,
    ...(critical.length ? [`🔴 <b>تنبيهات حرجة:</b>`, ...critical.map(a => `• ${a.message}`), ``] : []),
    ...(warning.length  ? [`🟡 <b>تحذيرات:</b>`, ...warning.map(a => `• ${a.message}`), ``] : []),
    `<i>منصة عدالة AI — النظام التشغيلي الذكي</i>`,
  ];
  const text = lines.join("\n");

  const htmlLines = [
    `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">`,
    `<div style="background:#1A56DB;padding:20px;color:white"><h2 style="margin:0">🧠 تقرير AI COO</h2><p style="margin:4px 0 0;opacity:.8">منصة عدالة AI</p></div>`,
    `<div style="padding:20px;background:#f9fafb">`,
    `<p style="color:#374151">📅 ${date}</p>`,
    `<div style="background:white;border-radius:8px;padding:16px;margin:12px 0;border:1px solid #e5e7eb">`,
    `<b>📊 الصحة التشغيلية: ${healthScore}/100</b><br/><span style="color:${healthScore>=80?"#22c55e":healthScore>=60?"#f59e0b":"#ef4444"}">${hsLabel}</span>`,
    `</div>`,
    ...(critical.length ? [
      `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:12px 0">`,
      `<b style="color:#dc2626">🔴 تنبيهات حرجة</b><ul style="margin:8px 0 0;padding-right:20px">`,
      ...critical.map(a => `<li style="color:#374151;margin:4px 0">${a.message}</li>`),
      `</ul></div>`,
    ] : []),
    ...(warning.length ? [
      `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:12px 0">`,
      `<b style="color:#d97706">🟡 تحذيرات</b><ul style="margin:8px 0 0;padding-right:20px">`,
      ...warning.map(a => `<li style="color:#374151;margin:4px 0">${a.message}</li>`),
      `</ul></div>`,
    ] : []),
    `<p style="color:#6b7280;font-size:12px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px">تم الإرسال تلقائياً من نظام AI COO — منصة عدالة AI</p>`,
    `</div></div>`,
  ];

  return { text, html: htmlLines.join("") };
}

const router = Router();

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

router.get("/ai-coo/overview", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const [casesRaw, casesStatusRaw, employeesRaw, invoicesRaw, tasksRaw, tasksOverdueRaw] =
      await Promise.all([
        db.execute(sql`
          SELECT
            COUNT(*)::int                                                                    AS total,
            COUNT(CASE WHEN status NOT IN ('closed','won','lost') THEN 1 END)::int          AS active,
            COUNT(CASE WHEN next_hearing_date < NOW()
                        AND status NOT IN ('closed','won','lost') THEN 1 END)::int          AS overdue
          FROM cases WHERE office_id = ${tenantId}
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT status, COUNT(*)::int AS cnt
          FROM cases WHERE office_id = ${tenantId}
          GROUP BY status
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT e.id, e.full_name, e.job_title, e.department,
                 COUNT(c.id)::int AS case_count
          FROM employees e
          LEFT JOIN cases c
            ON c.assigned_to = e.id::text
           AND c.status NOT IN ('closed','won','lost')
           AND c.office_id = ${tenantId}
          WHERE e.office_id = ${tenantId} AND e.status = 'active'
          GROUP BY e.id, e.full_name, e.job_title, e.department
          ORDER BY case_count DESC
          LIMIT 20
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT
            COUNT(*)::int                                                                AS total,
            COUNT(CASE WHEN status = 'paid'    THEN 1 END)::int                        AS paid_count,
            COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int                        AS overdue_count,
            COUNT(CASE WHEN status = 'pending' THEN 1 END)::int                        AS pending_count,
            COALESCE(SUM(CASE WHEN status = 'paid'
              AND created_at >= DATE_TRUNC('month', NOW()) THEN total ELSE 0 END),0)::float AS monthly_revenue,
            COALESCE(SUM(CASE WHEN status = 'overdue' THEN total ELSE 0 END),0)::float AS overdue_amount,
            COALESCE(SUM(total),0)::float                                               AS total_amount
          FROM client_invoices WHERE office_id = ${tenantId}
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT priority, COUNT(*)::int AS cnt
          FROM tasks WHERE office_id = ${tenantId} AND status != 'done'
          GROUP BY priority
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT COUNT(*)::int AS cnt
          FROM tasks
          WHERE office_id = ${tenantId}
            AND status != 'done'
            AND due_date < CURRENT_DATE
        `).catch(() => ({ rows: [] })),
      ]);

    /* ── Cases ── */
    const cr = ((casesRaw.rows ?? [])[0] ?? {}) as any;
    const totalCases  = parseInt(cr.total  ?? 0);
    const activeCases = parseInt(cr.active ?? 0);
    const overdueCases = parseInt(cr.overdue ?? 0);
    const byStatus: Record<string, number> = {};
    for (const r of (casesStatusRaw.rows ?? []) as any[]) byStatus[r.status] = r.cnt;
    const casesScore = clamp(totalCases === 0 ? 100 : 100 - (overdueCases / Math.max(totalCases, 1)) * 160);

    /* ── HR ── */
    const empRows = (employeesRaw.rows ?? []) as any[];
    const totalEmp   = empRows.length;
    const highLoadEmp = empRows.filter(e => e.case_count >= 15).length;
    const medLoadEmp  = empRows.filter(e => e.case_count >= 8 && e.case_count < 15).length;
    const hrScore = clamp(totalEmp === 0 ? 100 : 100 - (highLoadEmp / Math.max(totalEmp, 1)) * 130);
    const employees = empRows.slice(0, 12).map(e => ({
      id:        e.id,
      name:      e.full_name  ?? "موظف",
      title:     e.job_title  ?? "",
      dept:      e.department ?? "",
      caseCount: e.case_count ?? 0,
      load:      e.case_count >= 15 ? "high" : e.case_count >= 8 ? "medium" : "low",
    }));

    /* ── Finance ── */
    const fr = ((invoicesRaw.rows ?? [])[0] ?? {}) as any;
    const monthlyRevenue = parseFloat(fr.monthly_revenue ?? 0);
    const overdueAmount  = parseFloat(fr.overdue_amount  ?? 0);
    const totalAmount    = parseFloat(fr.total_amount    ?? 0);
    const paidCount      = parseInt(fr.paid_count    ?? 0);
    const overdueCount   = parseInt(fr.overdue_count ?? 0);
    const pendingCount   = parseInt(fr.pending_count ?? 0);
    const finScore = clamp(totalAmount === 0 ? 100 : 100 - (overdueAmount / Math.max(totalAmount, 1)) * 220);

    /* ── Tasks ── */
    const taskRows = (tasksRaw.rows ?? []) as any[];
    const byPriority: Record<string, number> = {};
    let totalTasks = 0, urgentTasks = 0;
    for (const r of taskRows) { byPriority[r.priority] = r.cnt; totalTasks += r.cnt; if (r.priority === "urgent") urgentTasks += r.cnt; }
    const overdueTasks = parseInt(((tasksOverdueRaw.rows ?? [])[0] as any)?.cnt ?? 0);
    const tasksScore = clamp(totalTasks === 0 ? 100 : 100 - (overdueTasks / Math.max(totalTasks, 1)) * 160);

    const healthScore = Math.round((casesScore + hrScore + finScore + tasksScore) / 4);

    /* ── Alerts ── */
    const alerts: { level: string; domain: string; message: string }[] = [];
    if (overdueCases > 0)   alerts.push({ level: overdueCases > 5   ? "critical" : "warning", domain: "cases",   message: `${overdueCases} قضية تجاوزت تاريخ الجلسة — مراجعة فورية مطلوبة` });
    if (highLoadEmp  > 0)   alerts.push({ level: highLoadEmp  > 3   ? "critical" : "warning", domain: "hr",      message: `${highLoadEmp} موظف بضغط عالٍ (أكثر من 15 قضية نشطة)` });
    if (overdueAmount > 0)  alerts.push({ level: overdueAmount > 15000 ? "critical" : "warning", domain: "finance", message: `فواتير متأخرة بقيمة ${overdueAmount.toLocaleString("ar-SA")} ريال` });
    if (overdueTasks > 0)   alerts.push({ level: overdueTasks > 10  ? "critical" : "warning", domain: "tasks",   message: `${overdueTasks} مهمة تجاوزت تاريخ الاستحقاق` });
    if (urgentTasks  > 0)   alerts.push({ level: "warning", domain: "tasks",   message: `${urgentTasks} مهمة عاجلة تنتظر التنفيذ` });
    if (pendingCount > 5)   alerts.push({ level: "warning", domain: "finance", message: `${pendingCount} فاتورة معلقة لم تُسدَّد بعد` });
    if (healthScore >= 85)  alerts.push({ level: "info",    domain: "overview", message: `الأداء التشغيلي ممتاز — المنظومة تعمل بكفاءة عالية` });

    /* ── AI Summary ── */
    let aiSummary = "";
    let recommendations: string[] = [];
    try {
      const prompt = `أنت نظام AI COO (مدير تنفيذي ذكي) لمكتب محاماة. بناءً على البيانات التشغيلية التالية:

• القضايا: ${totalCases} إجمالي | ${activeCases} نشطة | ${overdueCases} متأخرة
• الموظفون: ${totalEmp} موظف نشط | ${highLoadEmp} بضغط عالٍ | ${medLoadEmp} بضغط متوسط
• المالية: ${monthlyRevenue.toLocaleString("ar-SA")} ريال إيرادات هذا الشهر | ${overdueAmount.toLocaleString("ar-SA")} ريال فواتير متأخرة
• المهام: ${totalTasks} مهمة نشطة | ${overdueTasks} متأخرة | ${urgentTasks} عاجلة
• درجة الصحة التشغيلية: ${healthScore}/100

قدّم:
1. ملخصاً تنفيذياً (3 جمل فقط) عن الوضع العام
2. أبرز 3 توصيات قابلة للتنفيذ، ابدأ كل توصية بـ "•"

أجب باللغة العربية فقط، بأسلوب مدير تنفيذي موجز واحترافي.`;

      const { reply: raw } = await callAI("أنت نظام AI-COO لمكتب محاماة — مستشار تنفيذي ذكي. قدّم ملخصاً موجزاً.", prompt, [], "gemini");
      const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);
      const recIdx = lines.findIndex((l: string) => l.startsWith("•") || l.match(/^\d\./));
      if (recIdx > 0) {
        aiSummary = lines.slice(0, recIdx).join(" ");
        recommendations = lines.filter((l: string) => l.startsWith("•") || l.match(/^\d\./))
          .map((l: string) => l.replace(/^[•\d\.]\s*/, "").trim()).filter(Boolean);
      } else {
        aiSummary = lines.join(" ");
      }
    } catch {
      aiSummary = healthScore >= 80
        ? `المنظومة التشغيلية تعمل بكفاءة عالية بدرجة صحة ${healthScore}/100.`
        : `درجة الصحة التشغيلية ${healthScore}/100 — توجد نقاط تحتاج مراجعة.`;
      recommendations = [
        overdueCases   > 0 ? `مراجعة القضايا المتأخرة (${overdueCases} قضية)` : null,
        highLoadEmp    > 0 ? `إعادة توزيع القضايا على الموظفين المثقلين` : null,
        overdueAmount  > 0 ? `متابعة تحصيل الفواتير المتأخرة` : null,
      ].filter(Boolean) as string[];
    }

    res.json({
      healthScore,
      domains: {
        cases:   { score: casesScore,  total: totalCases, active: activeCases, overdue: overdueCases, byStatus },
        hr:      { score: hrScore,     total: totalEmp,   highLoad: highLoadEmp, medLoad: medLoadEmp, employees },
        finance: { score: finScore,    monthlyRevenue, overdueAmount, totalAmount, paidCount, overdueCount, pendingCount },
        tasks:   { score: tasksScore,  total: totalTasks, overdue: overdueTasks, urgent: urgentTasks, byPriority },
      },
      alerts,
      aiSummary,
      recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/ai-coo/ask", requireAuthWithTenant, async (req, res) => {
  const { question, context } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: "السؤال مطلوب" });
  try {
    const prompt = `أنت نظام AI COO لمكتب محاماة — مستشار تنفيذي ذكي.
${context ? `السياق التشغيلي الحالي:\n${context}\n` : ""}
سؤال المدير: ${question}

أجب بشكل مختصر واحترافي (3-5 جمل) باللغة العربية.`;
    const { reply } = await callAI("أنت مستشار تنفيذي ذكي لمكتب محاماة. أجب بشكل مختصر باللغة العربية.", prompt);
    res.json({ reply });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /ai-coo/notif-settings ── */
router.get("/ai-coo/notif-settings", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  await ensureNotifTable();
  try {
    let row = await sqlOne(sql`SELECT * FROM ai_coo_notif_settings WHERE office_id = ${tenantId}`);
    if (!row) {
      await db.execute(sql`INSERT INTO ai_coo_notif_settings (office_id) VALUES (${tenantId}) ON CONFLICT DO NOTHING`);
      row = await sqlOne(sql`SELECT * FROM ai_coo_notif_settings WHERE office_id = ${tenantId}`);
    }

    /* Check whether each channel is actually configured */
    const [tg, wa, em] = await Promise.all([
      sqlOne(sql`SELECT bot_token, chat_id FROM telegram_settings WHERE office_id = ${tenantId} OR office_id = 'default' ORDER BY (office_id = ${tenantId}) DESC LIMIT 1`).catch(() => null),
      sqlOne(sql`SELECT meta_token, meta_phone_id FROM whatsapp_settings WHERE office_id = ${tenantId} OR office_id = 'default' ORDER BY (office_id = ${tenantId}) DESC LIMIT 1`).catch(() => null),
      sqlOne(sql`SELECT smtp_host FROM email_notification_settings WHERE office_id = ${tenantId} OR office_id = 'default' ORDER BY (office_id = ${tenantId}) DESC LIMIT 1`).catch(() => null),
    ]);

    res.json({
      ...row,
      telegram_configured: !!(tg?.bot_token && tg?.chat_id),
      whatsapp_configured: !!(wa?.meta_token && wa?.meta_phone_id),
      email_configured:    !!(em?.smtp_host),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── PATCH /ai-coo/notif-settings ── */
router.patch("/ai-coo/notif-settings", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  await ensureNotifTable();
  try {
    const { telegram_enabled, whatsapp_enabled, email_enabled, min_level, email_recipients, whatsapp_numbers, auto_notify } = req.body;
    await db.execute(sql`
      INSERT INTO ai_coo_notif_settings
        (office_id, telegram_enabled, whatsapp_enabled, email_enabled, min_level, email_recipients, whatsapp_numbers, auto_notify, updated_at)
      VALUES
        (${tenantId},
         ${!!telegram_enabled}, ${!!whatsapp_enabled}, ${!!email_enabled},
         ${min_level ?? "critical"},
         ${email_recipients ?? ""}, ${whatsapp_numbers ?? ""},
         ${!!auto_notify}, NOW())
      ON CONFLICT (office_id) DO UPDATE SET
        telegram_enabled  = EXCLUDED.telegram_enabled,
        whatsapp_enabled  = EXCLUDED.whatsapp_enabled,
        email_enabled     = EXCLUDED.email_enabled,
        min_level         = EXCLUDED.min_level,
        email_recipients  = EXCLUDED.email_recipients,
        whatsapp_numbers  = EXCLUDED.whatsapp_numbers,
        auto_notify       = EXCLUDED.auto_notify,
        updated_at        = NOW()
    `);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /ai-coo/notify  (manual trigger + auto) ── */
router.post("/ai-coo/notify", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  await ensureNotifTable();
  try {
    /* Load notification prefs */
    const prefs = await sqlOne(sql`SELECT * FROM ai_coo_notif_settings WHERE office_id = ${tenantId}`);
    if (!prefs) return res.json({ sent: false, reason: "لم يتم ضبط إعدادات الإشعارات بعد" });

    /* Build alerts from live data */
    const [casesRaw, employeesRaw, invoicesRaw, tasksRaw] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS total, COUNT(CASE WHEN next_hearing_date < NOW() AND status NOT IN ('closed','won','lost') THEN 1 END)::int AS overdue, COUNT(CASE WHEN status NOT IN ('closed','won','lost') THEN 1 END)::int AS active FROM cases WHERE office_id = ${tenantId}`).catch(() => ({ rows: [] })),
      db.execute(sql`SELECT COUNT(CASE WHEN cc >= 15 THEN 1 END)::int AS high FROM (SELECT COUNT(c.id) AS cc FROM employees e LEFT JOIN cases c ON c.assigned_to=e.id::text AND c.status NOT IN ('closed','won','lost') AND c.office_id=${tenantId} WHERE e.office_id=${tenantId} AND e.status='active' GROUP BY e.id) sub`).catch(() => ({ rows: [] })),
      db.execute(sql`SELECT COALESCE(SUM(CASE WHEN status='overdue' THEN total ELSE 0 END),0)::float AS overdue_amt, COUNT(CASE WHEN status='overdue' THEN 1 END)::int AS overdue_cnt FROM client_invoices WHERE office_id=${tenantId}`).catch(() => ({ rows: [] })),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM tasks WHERE office_id=${tenantId} AND status!='done' AND due_date < CURRENT_DATE`).catch(() => ({ rows: [] })),
    ]);

    const cr   = ((casesRaw.rows ?? [])[0]     ?? {}) as any;
    const er   = ((employeesRaw.rows ?? [])[0]  ?? {}) as any;
    const fr   = ((invoicesRaw.rows ?? [])[0]   ?? {}) as any;
    const tr   = ((tasksRaw.rows ?? [])[0]      ?? {}) as any;

    const overdueCases  = parseInt(cr.overdue  ?? 0);
    const highLoadEmp   = parseInt(er.high     ?? 0);
    const overdueAmount = parseFloat(fr.overdue_amt ?? 0);
    const overdueTasks  = parseInt(tr.cnt      ?? 0);
    const totalCases    = parseInt(cr.total    ?? 0);
    const activeCases   = parseInt(cr.active   ?? 0);

    const casesScore   = clamp(totalCases === 0 ? 100 : 100 - (overdueCases / Math.max(totalCases, 1)) * 160);
    const healthScore  = Math.round((casesScore + Math.max(0, 100 - highLoadEmp * 20) + (overdueAmount > 0 ? 60 : 100) + (overdueTasks > 5 ? 60 : 100)) / 4);

    const allAlerts: { level: string; domain: string; message: string }[] = [];
    if (overdueCases  > 0) allAlerts.push({ level: overdueCases > 5 ? "critical" : "warning",   domain: "cases",   message: `${overdueCases} قضية تجاوزت تاريخ الجلسة` });
    if (highLoadEmp   > 0) allAlerts.push({ level: highLoadEmp  > 3 ? "critical" : "warning",   domain: "hr",      message: `${highLoadEmp} موظف بضغط عالٍ (أكثر من 15 قضية)` });
    if (overdueAmount > 0) allAlerts.push({ level: overdueAmount > 15000 ? "critical" : "warning", domain: "finance", message: `فواتير متأخرة بقيمة ${overdueAmount.toLocaleString("ar-SA")} ريال` });
    if (overdueTasks  > 0) allAlerts.push({ level: overdueTasks > 10 ? "critical" : "warning",  domain: "tasks",   message: `${overdueTasks} مهمة تجاوزت تاريخ الاستحقاق` });

    /* Filter by min_level */
    const levelOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
    const minOrder = levelOrder[prefs.min_level ?? "critical"] ?? 3;
    const alerts   = allAlerts.filter(a => (levelOrder[a.level] ?? 0) >= minOrder);

    if (alerts.length === 0) {
      await db.execute(sql`UPDATE ai_coo_notif_settings SET last_notified_at=NOW() WHERE office_id=${tenantId}`);
      return res.json({ sent: true, channels: [], reason: "لا توجد تنبيهات تستوفي المستوى المحدد — تم تسجيل المحاولة" });
    }

    const { text, html } = buildAlertMessage(alerts, healthScore, tenantId);
    const results: Record<string, any> = {};

    /* Telegram */
    if (prefs.telegram_enabled) {
      results.telegram = await sendTelegramAlert(tenantId, text);
    }

    /* WhatsApp */
    if (prefs.whatsapp_enabled && prefs.whatsapp_numbers?.trim()) {
      const phones = prefs.whatsapp_numbers.split(/[\n,،]+/).map((s: string) => s.trim()).filter(Boolean);
      const plainText = alerts.map(a => `• ${a.message}`).join("\n");
      const wa = `🧠 تقرير AI COO — عدالة\n📊 الصحة: ${healthScore}/100\n\n${plainText}\n\nمنصة عدالة AI`;
      results.whatsapp = await sendWhatsAppAlert(tenantId, phones, wa);
    }

    /* Email */
    if (prefs.email_enabled && prefs.email_recipients?.trim()) {
      const emails = prefs.email_recipients.split(/[\n,،]+/).map((s: string) => s.trim()).filter(Boolean);
      const criticalCount = alerts.filter(a => a.level === "critical").length;
      const subject = criticalCount > 0 ? `🔴 AI COO — ${criticalCount} تنبيه حرج في المنصة` : `🟡 AI COO — تقرير تشغيلي`;
      results.email = await sendEmailAlert(tenantId, emails, subject, html);
    }

    await db.execute(sql`UPDATE ai_coo_notif_settings SET last_notified_at=NOW() WHERE office_id=${tenantId}`);

    res.json({ sent: true, alertsCount: alerts.length, healthScore, activeCases, results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
