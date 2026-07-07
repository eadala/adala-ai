import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS telegram_settings (
      id                SERIAL PRIMARY KEY,
      office_id         TEXT NOT NULL DEFAULT 'default' UNIQUE,
      enabled           BOOLEAN NOT NULL DEFAULT FALSE,
      bot_token         TEXT,
      chat_id           TEXT,
      notify_cases      BOOLEAN NOT NULL DEFAULT TRUE,
      notify_invoices   BOOLEAN NOT NULL DEFAULT TRUE,
      notify_reminders  BOOLEAN NOT NULL DEFAULT TRUE,
      use_as_storage    BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS telegram_logs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id   TEXT NOT NULL DEFAULT 'default',
      chat_id     TEXT,
      message     TEXT,
      type        TEXT NOT NULL DEFAULT 'message',
      file_id     TEXT,
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

// ── Core Telegram API caller ──────────────────────────────────────────────────
export async function callTelegramAPI(botToken: string, method: string, body: Record<string, any>): Promise<{ ok: boolean; result?: any; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json() as any;
  } catch (e: any) {
    return { ok: false, description: e.message };
  }
}

// ── Send text message ─────────────────────────────────────────────────────────
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML"
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const r = await callTelegramAPI(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  });
  return { ok: r.ok, messageId: r.result?.message_id, error: r.description };
}

// ── Notify Telegram when case status changes ──────────────────────────────────
export async function notifyTelegramCaseStatus(updatedCase: any) {
  try {
    await ensureTables();
    const officeId = updatedCase.office_id ?? updatedCase.officeId;
    if (!officeId || officeId === "default") return;
    const settings = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${officeId} LIMIT 1`);
    if (!settings?.enabled || !settings?.notify_cases || !settings?.bot_token || !settings?.chat_id) return;

    const STATUS_LABELS: Record<string, string> = {
      open: "مفتوحة ⚪",
      in_progress: "قيد التنفيذ 🔵",
      closed: "مغلقة ✅",
    };
    const statusLabel = STATUS_LABELS[updatedCase.status] ?? updatedCase.status;
    const text = [
      `⚖️ <b>تحديث قضية</b>`,
      ``,
      `📂 <b>القضية:</b> ${updatedCase.title ?? "—"}`,
      updatedCase.clientName ? `👤 <b>العميل:</b> ${updatedCase.clientName}` : null,
      `📌 <b>الحالة الجديدة:</b> ${statusLabel}`,
      ``,
      `<i>منصة عدالة AI</i>`,
    ].filter(Boolean).join("\n");

    const r = await sendTelegramMessage(settings.bot_token, settings.chat_id, text);

    await db.execute(sql`
      INSERT INTO telegram_logs (office_id, chat_id, message, type, status, error)
      VALUES (${officeId}, ${settings.chat_id}, ${text}, 'case_update', ${r.ok ? 'sent' : 'failed'}, ${r.error ?? null})
    `);
  } catch { /* non-fatal */ }
}

// ── GET /telegram/settings ────────────────────────────────────────────────────
router.get("/telegram/settings", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    let row = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${tid}`);
    if (!row) {
      await db.execute(sql`INSERT INTO telegram_settings (office_id) VALUES (${tid}) ON CONFLICT DO NOTHING`);
      row = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${tid}`);
    }
    const safe = { ...row, bot_token: row?.bot_token ? "••••••••" : "" };
    res.json(safe ?? {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /telegram/settings ─────────────────────────────────────────────────
router.patch("/telegram/settings", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const {
      enabled, botToken, chatId,
      notifyCases, notifyInvoices, notifyReminders,
      useAsStorage,
    } = req.body;

    await db.execute(sql`
      INSERT INTO telegram_settings
        (office_id, enabled, bot_token, chat_id,
         notify_cases, notify_invoices, notify_reminders, use_as_storage, updated_at)
      VALUES (
        ${tid}, ${enabled ?? false},
        ${botToken && botToken !== "••••••••" ? botToken : null},
        ${chatId ?? null},
        ${notifyCases ?? true}, ${notifyInvoices ?? true},
        ${notifyReminders ?? true}, ${useAsStorage ?? false},
        NOW()
      )
      ON CONFLICT (office_id) DO UPDATE SET
        enabled          = EXCLUDED.enabled,
        bot_token        = CASE WHEN EXCLUDED.bot_token IS NOT NULL THEN EXCLUDED.bot_token ELSE telegram_settings.bot_token END,
        chat_id          = COALESCE(EXCLUDED.chat_id, telegram_settings.chat_id),
        notify_cases     = EXCLUDED.notify_cases,
        notify_invoices  = EXCLUDED.notify_invoices,
        notify_reminders = EXCLUDED.notify_reminders,
        use_as_storage   = EXCLUDED.use_as_storage,
        updated_at       = NOW()
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /telegram/test ───────────────────────────────────────────────────────
router.post("/telegram/test", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const settings = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${tid}`);
    if (!settings?.bot_token || !settings?.chat_id) {
      res.json({ ok: false, error: "أدخل Bot Token و Chat ID أولاً" }); return;
    }
    const text = [
      `🎉 <b>تكامل تليجرام يعمل!</b>`,
      ``,
      `✅ تم ربط منصة عدالة AI بمجموعة/قناة تليجرام بنجاح.`,
      `ستتلقى الآن الإشعارات والتحديثات هنا مباشرةً.`,
      ``,
      `<i>منصة عدالة AI — نظام التشغيل القانوني</i>`,
    ].join("\n");

    const r = await sendTelegramMessage(settings.bot_token, settings.chat_id, text);
    await db.execute(sql`
      INSERT INTO telegram_logs (office_id, chat_id, message, type, status, error)
      VALUES (${tid}, ${settings.chat_id}, ${text}, 'test', ${r.ok ? 'sent' : 'failed'}, ${r.error ?? null})
    `);
    res.json(r);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /telegram/send (manual send) ────────────────────────────────────────
router.post("/telegram/send", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const { message } = req.body;
    if (!message) { res.status(400).json({ error: "message مطلوب" }); return; }
    const settings = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${tid}`);
    if (!settings?.enabled || !settings?.bot_token || !settings?.chat_id) {
      res.json({ ok: false, error: "تليجرام غير مفعّل أو لم يتم الإعداد" }); return;
    }
    const r = await sendTelegramMessage(settings.bot_token, settings.chat_id, message);
    await db.execute(sql`
      INSERT INTO telegram_logs (office_id, chat_id, message, type, status, error)
      VALUES (${tid}, ${settings.chat_id}, ${message}, 'manual', ${r.ok ? 'sent' : 'failed'}, ${r.error ?? null})
    `);
    res.json(r);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /telegram/forward-file ───────────────────────────────────────────────
// Forward a file URL to the Telegram channel as backup storage
router.post("/telegram/forward-file", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const { fileUrl, fileName, caption } = req.body;
    if (!fileUrl) { res.status(400).json({ error: "fileUrl مطلوب" }); return; }

    const settings = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${tid}`);
    if (!settings?.enabled || !settings?.use_as_storage || !settings?.bot_token || !settings?.chat_id) {
      res.json({ ok: false, error: "التخزين عبر تليجرام غير مفعّل" }); return;
    }

    const r = await callTelegramAPI(settings.bot_token, "sendDocument", {
      chat_id: settings.chat_id,
      document: fileUrl,
      caption: caption ?? fileName ?? "ملف من عدالة AI",
      parse_mode: "HTML",
    });

    const fileId = r.result?.document?.file_id ?? r.result?.photo?.at(-1)?.file_id ?? null;

    await db.execute(sql`
      INSERT INTO telegram_logs (office_id, chat_id, message, type, file_id, status, error)
      VALUES (${tid}, ${settings.chat_id}, ${fileName ?? fileUrl}, 'file', ${fileId}, ${r.ok ? 'sent' : 'failed'}, ${r.description ?? null})
    `);

    res.json({ ok: r.ok, fileId, error: r.description });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /telegram/bot-info ────────────────────────────────────────────────────
router.get("/telegram/bot-info", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const settings = await sqlOne(sql`SELECT * FROM telegram_settings WHERE office_id = ${tid}`);
    if (!settings?.bot_token) { res.json({ ok: false, error: "لم يتم إدخال Bot Token" }); return; }
    const r = await callTelegramAPI(settings.bot_token, "getMe", {});
    res.json(r);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /telegram/logs ────────────────────────────────────────────────────────
router.get("/telegram/logs", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const rows = await sqlAll(sql`
      SELECT * FROM telegram_logs WHERE office_id = ${tid}
      ORDER BY sent_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

ensureTables().catch(() => {});
export default router;
