import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_notification_settings (
      id          SERIAL PRIMARY KEY,
      office_id   TEXT NOT NULL DEFAULT 'default' UNIQUE,
      enabled     BOOLEAN NOT NULL DEFAULT FALSE,
      smtp_host   TEXT,
      smtp_port   INTEGER DEFAULT 587,
      smtp_user   TEXT,
      smtp_pass   TEXT,
      from_name   TEXT DEFAULT 'عدالة AI',
      from_email  TEXT,
      triggers    JSONB DEFAULT '{}',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_notification_logs (
      id          SERIAL PRIMARY KEY,
      office_id   TEXT NOT NULL DEFAULT 'default',
      type        TEXT NOT NULL,
      recipient   TEXT NOT NULL,
      subject     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'sent',
      error       TEXT,
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

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

router.get("/email-notifications/settings", requireAuthWithTenant, async (_req, res) => {
  await ensureTables();
  try {
    const row = await sqlOne(sql`SELECT * FROM email_notification_settings WHERE office_id = 'default'`);
    if (!row) {
      const fresh = await sqlOne(sql`
        INSERT INTO email_notification_settings (office_id) VALUES ('default')
        ON CONFLICT (office_id) DO NOTHING
        RETURNING *
      `);
      const existing = await sqlOne(sql`SELECT * FROM email_notification_settings WHERE office_id = 'default'`);
      return res.json(existing ?? {});
    }
    const safe = { ...row, smtp_pass: row.smtp_pass ? "••••••••" : "" };
    res.json(safe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/email-notifications/settings", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const { enabled, smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromEmail, triggers } = req.body;
    const row = await sqlOne(sql`
      INSERT INTO email_notification_settings
        (office_id, enabled, smtp_host, smtp_port, smtp_user, smtp_pass, from_name, from_email, triggers, updated_at)
      VALUES ('default', ${enabled ?? false}, ${smtpHost ?? null}, ${smtpPort ?? 587},
              ${smtpUser ?? null},
              ${smtpPass && smtpPass !== "••••••••" ? smtpPass : null},
              ${fromName ?? "عدالة AI"}, ${fromEmail ?? null},
              ${JSON.stringify(triggers ?? {})}::jsonb, NOW())
      ON CONFLICT (office_id) DO UPDATE SET
        enabled    = EXCLUDED.enabled,
        smtp_host  = EXCLUDED.smtp_host,
        smtp_port  = EXCLUDED.smtp_port,
        smtp_user  = EXCLUDED.smtp_user,
        smtp_pass  = CASE WHEN EXCLUDED.smtp_pass IS NOT NULL THEN EXCLUDED.smtp_pass ELSE email_notification_settings.smtp_pass END,
        from_name  = EXCLUDED.from_name,
        from_email = EXCLUDED.from_email,
        triggers   = EXCLUDED.triggers,
        updated_at = NOW()
      RETURNING *
    `);
    res.json({ ok: true, row });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/email-notifications/test", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const settings = await sqlOne(sql`SELECT * FROM email_notification_settings WHERE office_id = 'default'`);
    if (!settings?.smtp_host || !settings?.smtp_user || !settings?.smtp_pass) {
      return res.status(400).json({ error: "يرجى إعداد إعدادات SMTP أولاً" });
    }
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "يرجى تحديد البريد الإلكتروني المستلم" });

    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransporter({
        host: settings.smtp_host,
        port: settings.smtp_port ?? 587,
        secure: settings.smtp_port === 465,
        auth: { user: settings.smtp_user, pass: settings.smtp_pass },
      });
      await transporter.sendMail({
        from: `"${settings.from_name ?? "عدالة AI"}" <${settings.from_email ?? settings.smtp_user}>`,
        to,
        subject: "رسالة تجريبية من عدالة AI",
        html: `<div dir="rtl" style="font-family:sans-serif;padding:24px;">
          <h2 style="color:#C9A84C;">عدالة AI</h2>
          <p>هذه رسالة تجريبية للتأكد من صحة إعدادات البريد الإلكتروني.</p>
          <p style="color:#666;">تم الإرسال بنجاح من منصة عدالة AI.</p>
        </div>`,
      });
      await db.execute(sql`
        INSERT INTO email_notification_logs (office_id, type, recipient, subject, status)
        VALUES ('default', 'test', ${to}, 'رسالة تجريبية من عدالة AI', 'sent')
      `);
      res.json({ ok: true, message: "تم إرسال الرسالة التجريبية بنجاح" });
    } catch (mailErr: any) {
      await db.execute(sql`
        INSERT INTO email_notification_logs (office_id, type, recipient, subject, status, error)
        VALUES ('default', 'test', ${to}, 'رسالة تجريبية من عدالة AI', 'failed', ${mailErr.message})
      `);
      res.status(500).json({ error: "فشل الإرسال: " + mailErr.message });
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/email-notifications/run-now", requireAuthWithTenant, async (_req, res) => {
  try {
    const { runEmailCron } = await import("../cron/emailCron");
    const result = await runEmailCron();
    res.json({ ok: true, ...result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/email-notifications/logs", requireAuthWithTenant, async (_req, res) => {
  await ensureTables();
  try {
    const rows = await sqlAll(sql`
      SELECT * FROM email_notification_logs WHERE office_id = 'default'
      ORDER BY sent_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
