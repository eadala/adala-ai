import { Router } from "express";
import nodemailer from "nodemailer";

const router = Router();

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

router.post("/email/send-letter", async (req, res) => {
  const { to, toName, subject, body, fromName } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ error: "البريد والموضوع والمحتوى مطلوبة" });
  }

  const transporter = getTransporter();
  if (!transporter) {
    return res.json({ success: false, mailtoFallback: true });
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const htmlBody = `
    <div dir="rtl" style="font-family:'Cairo',Arial,sans-serif;line-height:2;color:#111;max-width:700px;margin:0 auto;padding:40px 30px;border:1px solid #e5e7eb;border-radius:8px">
      ${body
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br/>")
      }
      <hr style="margin-top:40px;border-color:#e5e7eb"/>
      <p style="color:#6b7280;font-size:12px;text-align:center">
        تم إرسال هذا الخطاب من منصة عدالة AI
      </p>
    </div>`;

  try {
    await transporter.sendMail({
      from: `"${fromName || "مكتب المحاماة"}" <${fromAddress}>`,
      to: toName ? `"${toName}" <${to}>` : to,
      subject,
      text: body.replace(/\*\*(.*?)\*\*/g, "$1"),
      html: htmlBody,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل إرسال البريد" });
  }
});

router.get("/email/smtp-status", (_req, res) => {
  const configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  res.json({ configured });
});

// ─── POST /email/send-reminder ───────────────────────────────────────────────
router.post("/email/send-reminder", async (req, res) => {
  const { to, eventTitle, eventDate, eventType, location, minutesBefore } = req.body;
  if (!to || !eventTitle) {
    return res.status(400).json({ error: "البريد وعنوان الحدث مطلوبان" });
  }

  const typeLabels: Record<string, string> = {
    court_session:  "جلسة محكمة",
    deadline:       "موعد نهائي",
    client_meeting: "اجتماع عميل",
    team_meeting:   "اجتماع فريق",
    task:           "مهمة",
    other:          "حدث",
  };
  const typeLabel = typeLabels[eventType] ?? "حدث";
  const reminderText =
    minutesBefore >= 1440
      ? `بعد ${Math.round(minutesBefore / 1440)} يوم`
      : minutesBefore >= 60
      ? `بعد ${Math.round(minutesBefore / 60)} ساعة`
      : `بعد ${minutesBefore} دقيقة`;

  const subject = `تذكير: ${typeLabel} — ${eventTitle}`;
  const htmlBody = `
    <div dir="rtl" style="font-family:'Cairo',Arial,sans-serif;line-height:2;color:#111;max-width:600px;margin:0 auto;padding:30px;border:1px solid #e5e7eb;border-radius:12px">
      <div style="background:linear-gradient(135deg,#0d1b2a,#1a2e44);color:white;padding:20px 24px;border-radius:10px;margin-bottom:24px">
        <h2 style="margin:0;font-size:20px">🔔 تذكير من عدالة AI</h2>
        <p style="margin:8px 0 0;opacity:0.8;font-size:14px">${typeLabel} يقترب</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:10px;background:#f9fafb;border-radius:8px;font-weight:bold;width:35%">الحدث</td>
          <td style="padding:10px;background:#f9fafb;border-radius:8px">${eventTitle}</td>
        </tr>
        <tr>
          <td style="padding:10px;font-weight:bold">التاريخ</td>
          <td style="padding:10px">${eventDate ?? ""}</td>
        </tr>
        ${location ? `<tr><td style="padding:10px;background:#f9fafb;border-radius:8px;font-weight:bold">المكان</td><td style="padding:10px;background:#f9fafb;border-radius:8px">${location}</td></tr>` : ""}
        <tr>
          <td style="padding:10px;font-weight:bold">الوقت المتبقي</td>
          <td style="padding:10px;color:#d97706;font-weight:bold">${reminderText}</td>
        </tr>
      </table>
      <hr style="border-color:#e5e7eb" />
      <p style="color:#6b7280;font-size:12px;text-align:center">منصة عدالة AI — نظام التشغيل القانوني</p>
    </div>`;

  const transporter = getTransporter();
  if (!transporter) {
    // SMTP not configured — return mailto fallback
    return res.json({ success: false, mailtoFallback: true, subject, note: "SMTP غير مضبوط — يُرجى تكوين SMTP_HOST/SMTP_USER/SMTP_PASS" });
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER!;
  try {
    await transporter.sendMail({
      from: `"عدالة AI" <${fromAddress}>`,
      to,
      subject,
      html: htmlBody,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل إرسال التذكير" });
  }
});

export default router;
