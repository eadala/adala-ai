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

export default router;
