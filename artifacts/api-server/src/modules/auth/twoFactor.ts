import { Router } from "express";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { logger } from "../../lib/logger";

const router = Router();

async function ensureTwoFactorTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS two_factor_settings (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      TEXT NOT NULL UNIQUE,
      secret       TEXT NOT NULL,
      enabled      BOOLEAN NOT NULL DEFAULT false,
      backup_codes TEXT[] DEFAULT '{}',
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

ensureTwoFactorTable().catch(e => logger.error({ e }, "[2FA] Table init failed"));

/* ── GET /api/2fa/status ────────────────────────────────────────────────── */
router.get("/status", requireAuthWithTenant, async (req, res) => {
  try {
    const userId = (req as any).auth?.userId;
    const rows = await db.execute(sql`
      SELECT enabled FROM two_factor_settings WHERE user_id = ${userId}
    `) as any;
    const row = (rows.rows ?? rows)?.[0];
    res.json({ enabled: row?.enabled ?? false, configured: !!row });
  } catch (e) {
    logger.error({ e }, "[2FA] status error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

/* ── POST /api/2fa/setup — generate secret + QR ────────────────────────── */
router.post("/setup", requireAuthWithTenant, async (req, res) => {
  try {
    const userId = (req as any).auth?.userId;
    const userEmail = (req as any).auth?.sessionClaims?.email ?? userId;

    const secret = speakeasy.generateSecret({
      name: `عدالة AI (${userEmail})`,
      length: 20,
    });

    await db.execute(sql`
      INSERT INTO two_factor_settings (user_id, secret, enabled)
      VALUES (${userId}, ${secret.base32}, false)
      ON CONFLICT (user_id) DO UPDATE SET secret = ${secret.base32}, enabled = false, updated_at = NOW()
    `);

    const otpauthUrl = secret.otpauth_url!;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({
      secret:     secret.base32,
      qrCodeUrl:  qrCodeDataUrl,
      manualCode: secret.base32,
      otpauthUrl,
    });
  } catch (e) {
    logger.error({ e }, "[2FA] setup error");
    res.status(500).json({ error: "خطأ في الإعداد" });
  }
});

/* ── POST /api/2fa/verify — confirm code (enables 2FA if not yet enabled) ─ */
router.post("/verify", requireAuthWithTenant, async (req, res) => {
  try {
    const userId = (req as any).auth?.userId;
    const { token } = req.body as { token: string };
    if (!token) { res.status(400).json({ error: "الرمز مطلوب" }); return; }

    const rows = await db.execute(sql`
      SELECT secret, enabled FROM two_factor_settings WHERE user_id = ${userId}
    `) as any;
    const row = (rows.rows ?? rows)?.[0];
    if (!row) { res.status(404).json({ error: "لم يتم إعداد 2FA بعد" }); return; }

    const valid = speakeasy.totp.verify({
      secret:   row.secret,
      encoding: "base32",
      token:    token.replace(/\s/g, ""),
      window:   1,
    });

    if (!valid) { res.status(400).json({ error: "الرمز غير صحيح" }); return; }

    let backupCodes: string[] = [];
    if (!row.enabled) {
      backupCodes = Array.from({ length: 8 }, () =>
        Math.random().toString(36).slice(2, 8).toUpperCase()
      );
      await db.execute(sql`
        UPDATE two_factor_settings
        SET enabled = true, backup_codes = ${JSON.stringify(backupCodes)}::text[], updated_at = NOW()
        WHERE user_id = ${userId}
      `);
    }

    res.json({ success: true, backupCodes });
  } catch (e) {
    logger.error({ e }, "[2FA] verify error");
    res.status(500).json({ error: "خطأ في التحقق" });
  }
});

/* ── POST /api/2fa/check — called by frontend after Clerk login ─────────── */
router.post("/check", requireAuthWithTenant, async (req, res) => {
  try {
    const userId = (req as any).auth?.userId;
    const { token } = req.body as { token: string };
    if (!token) { res.status(400).json({ error: "الرمز مطلوب" }); return; }

    const rows = await db.execute(sql`
      SELECT secret, backup_codes FROM two_factor_settings
      WHERE user_id = ${userId} AND enabled = true
    `) as any;
    const row = (rows.rows ?? rows)?.[0];
    if (!row) { res.json({ success: true }); return; }

    const cleanToken = token.replace(/\s/g, "");
    const valid = speakeasy.totp.verify({ secret: row.secret, encoding: "base32", token: cleanToken, window: 1 });

    if (valid) { res.json({ success: true }); return; }

    const backupCodes: string[] = row.backup_codes ?? [];
    const bIdx = backupCodes.indexOf(cleanToken.toUpperCase());
    if (bIdx !== -1) {
      backupCodes.splice(bIdx, 1);
      await db.execute(sql`
        UPDATE two_factor_settings SET backup_codes = ${JSON.stringify(backupCodes)}::text[] WHERE user_id = ${userId}
      `);
      res.json({ success: true }); return;
    }

    res.status(400).json({ error: "الرمز غير صحيح" });
  } catch (e) {
    logger.error({ e }, "[2FA] check error");
    res.status(500).json({ error: "خطأ في التحقق" });
  }
});

/* ── POST /api/2fa/disable ─────────────────────────────────────────────── */
router.post("/disable", requireAuthWithTenant, async (req, res) => {
  try {
    const userId = (req as any).auth?.userId;
    const { token } = req.body as { token: string };
    if (!token) { res.status(400).json({ error: "الرمز مطلوب" }); return; }

    const rows = await db.execute(sql`
      SELECT secret FROM two_factor_settings WHERE user_id = ${userId} AND enabled = true
    `) as any;
    const row = (rows.rows ?? rows)?.[0];
    if (!row) { res.status(404).json({ error: "2FA غير مفعّل" }); return; }

    const valid = speakeasy.totp.verify({ secret: row.secret, encoding: "base32", token: token.replace(/\s/g, ""), window: 1 });
    if (!valid) { res.status(400).json({ error: "الرمز غير صحيح" }); return; }

    await db.execute(sql`
      UPDATE two_factor_settings SET enabled = false, updated_at = NOW() WHERE user_id = ${userId}
    `);
    res.json({ success: true });
  } catch (e) {
    logger.error({ e }, "[2FA] disable error");
    res.status(500).json({ error: "خطأ في الإيقاف" });
  }
});

export default router;
