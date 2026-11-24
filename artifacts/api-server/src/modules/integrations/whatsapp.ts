import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS whatsapp_settings (
      id          SERIAL PRIMARY KEY,
      office_id   TEXT NOT NULL DEFAULT 'default' UNIQUE,
      enabled     BOOLEAN NOT NULL DEFAULT FALSE,
      provider    TEXT NOT NULL DEFAULT 'twilio',
      account_sid TEXT,
      auth_token  TEXT,
      from_number TEXT,
      meta_token  TEXT,
      meta_phone_id TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id          SERIAL PRIMARY KEY,
      office_id   TEXT NOT NULL DEFAULT 'default',
      to_number   TEXT NOT NULL,
      message     TEXT NOT NULL,
      template    TEXT,
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

router.get("/whatsapp/settings", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    let row = await sqlOne(sql`SELECT * FROM whatsapp_settings WHERE office_id = ${tid}`);
    if (!row) {
      await db.execute(sql`INSERT INTO whatsapp_settings (office_id) VALUES (${tid}) ON CONFLICT DO NOTHING`);
      row = await sqlOne(sql`SELECT * FROM whatsapp_settings WHERE office_id = ${tid}`);
    }
    const safe = {
      ...row,
      auth_token: row?.auth_token ? "••••••••" : "",
      meta_token: row?.meta_token ? "••••••••" : "",
    };
    res.json(safe ?? {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/whatsapp/settings", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const { enabled, provider, accountSid, authToken, fromNumber, metaToken, metaPhoneId } = req.body;
    const row = await sqlOne(sql`
      INSERT INTO whatsapp_settings
        (office_id, enabled, provider, account_sid, auth_token, from_number, meta_token, meta_phone_id, updated_at)
      VALUES (
        ${tid}, ${enabled ?? false}, ${provider ?? 'twilio'},
        ${accountSid ?? null},
        ${authToken && authToken !== "••••••••" ? authToken : null},
        ${fromNumber ?? null},
        ${metaToken && metaToken !== "••••••••" ? metaToken : null},
        ${metaPhoneId ?? null},
        NOW()
      )
      ON CONFLICT (office_id) DO UPDATE SET
        enabled      = EXCLUDED.enabled,
        provider     = EXCLUDED.provider,
        account_sid  = COALESCE(EXCLUDED.account_sid, whatsapp_settings.account_sid),
        auth_token   = CASE WHEN EXCLUDED.auth_token IS NOT NULL THEN EXCLUDED.auth_token ELSE whatsapp_settings.auth_token END,
        from_number  = COALESCE(EXCLUDED.from_number, whatsapp_settings.from_number),
        meta_token   = CASE WHEN EXCLUDED.meta_token IS NOT NULL THEN EXCLUDED.meta_token ELSE whatsapp_settings.meta_token END,
        meta_phone_id = COALESCE(EXCLUDED.meta_phone_id, whatsapp_settings.meta_phone_id),
        updated_at   = NOW()
      RETURNING *
    `);
    res.json({ ok: true, row });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

async function sendWhatsAppMessage(settings: any, to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const phone = to.replace(/\D/g, "");
  const toFormatted = phone.startsWith("0") ? "966" + phone.slice(1) : phone;

  if (settings.provider === "meta" && settings.meta_token && settings.meta_phone_id) {
    try {
      const resp = await fetch(
        `https://graph.facebook.com/v18.0/${settings.meta_phone_id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.meta_token}` },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: toFormatted,
            type: "text",
            text: { body: message },
          }),
        }
      );
      const data = await resp.json() as any;
      if (data.error) return { ok: false, error: data.error.message };
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }

  if (settings.provider === "twilio" && settings.account_sid && settings.auth_token && settings.from_number) {
    try {
      const credentials = Buffer.from(`${settings.account_sid}:${settings.auth_token}`).toString("base64");
      const body = new URLSearchParams({
        From: `whatsapp:+${settings.from_number.replace(/\D/g, "")}`,
        To: `whatsapp:+${toFormatted}`,
        Body: message,
      });
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${settings.account_sid}/Messages.json`,
        { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body }
      );
      const data = await resp.json() as any;
      if (data.status === "failed" || data.error_code) return { ok: false, error: data.error_message ?? "Twilio error" };
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  }

  return { ok: false, error: "لم يتم تكوين الإعدادات أو المزود غير مدعوم" };
}

router.post("/whatsapp/send", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const { to, message, template } = req.body;
    if (!to || !message) { res.status(400).json({ error: "to و message مطلوبان" }); return; }

    const settings = await sqlOne(sql`SELECT * FROM whatsapp_settings WHERE office_id = ${tid}`);
    if (!settings?.enabled) {
      await db.execute(sql`
        INSERT INTO whatsapp_logs (office_id, to_number, message, template, status, error)
        VALUES (${tid}, ${to}, ${message}, ${template ?? null}, 'failed', 'الخدمة غير مفعّلة')
      `);
      res.json({ ok: false, error: "خدمة واتساب غير مفعّلة. يرجى تفعيلها من الإعدادات." }); return;
    }

    const result = await sendWhatsAppMessage(settings, to, message);
    await db.execute(sql`
      INSERT INTO whatsapp_logs (office_id, to_number, message, template, status, error)
      VALUES (${tid}, ${to}, ${message}, ${template ?? null}, ${result.ok ? 'sent' : 'failed'}, ${result.error ?? null})
    `);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/whatsapp/test", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const { to } = req.body;
    if (!to) { res.status(400).json({ error: "رقم الهاتف مطلوب" }); return; }
    const settings = await sqlOne(sql`SELECT * FROM whatsapp_settings WHERE office_id = ${tid}`);
    if (!settings?.enabled) { res.json({ ok: false, error: "الخدمة غير مفعّلة" }); return; }
    const result = await sendWhatsAppMessage(settings, to, "مرحباً 👋\nهذه رسالة اختبار من منصة عدالة AI\nتم تكوين واتساب بنجاح ✅");
    await db.execute(sql`
      INSERT INTO whatsapp_logs (office_id, to_number, message, template, status, error)
      VALUES (${tid}, ${to}, 'رسالة اختبار', 'test', ${result.ok ? 'sent' : 'failed'}, ${result.error ?? null})
    `);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/whatsapp/logs", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const rows = await sqlAll(sql`
      SELECT * FROM whatsapp_logs WHERE office_id = ${tid}
      ORDER BY sent_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/whatsapp/templates", requireAuthWithTenant, async (req, res) => {
  res.json([
    { key: "invoice", label: "إشعار فاتورة", body: "السلام عليكم {name}،\nيرجى سداد الفاتورة رقم {invoice_number} بمبلغ {amount} ر.س\nتاريخ الاستحقاق: {due_date}\nرابط الدفع: {link}" },
    { key: "case_update", label: "تحديث القضية", body: "السلام عليكم {name}،\nتحديث على قضيتكم رقم {case_number}:\nالحالة الجديدة: {status}\nللمزيد من المعلومات تواصلوا معنا." },
    { key: "appointment", label: "تذكير موعد", body: "السلام عليكم {name}،\nتذكير بموعدكم غداً {date} الساعة {time}\nالمكتب: {office_name}\nيرجى التأكيد أو الإلغاء." },
    { key: "welcome", label: "ترحيب بعميل جديد", body: "أهلاً وسهلاً {name} 🎉\nيسعدنا انضمامكم لعملاء {office_name}\nفريقنا جاهز لخدمتكم على مدار الساعة." },
  ]);
});

export default router;
