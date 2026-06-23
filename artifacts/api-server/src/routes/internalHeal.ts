/**
 * POST /internal/heal
 * ────────────────────
 * Alertmanager webhook — يُستدعى عند تنبيه APIDown (critical).
 * Docker restart: always يُعيد تشغيل الـ container تلقائياً.
 *
 * الحماية: Bearer token (HEAL_SECRET) + IP داخلي فقط.
 * لا يُعرَّض عبر Nginx — يصل إليه Alertmanager مباشرةً عبر Docker network.
 */

import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const HEAL_SECRET = process.env.HEAL_SECRET ?? "adala-heal-token";

/* ── التحقق من Bearer token ──────────────────────────── */
function verifyHealToken(req: any): boolean {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token === HEAL_SECRET && HEAL_SECRET.length >= 12;
}

/* ── التحقق من أن المصدر داخلي (Docker network) ──────── */
function isInternalSource(req: any): boolean {
  const ip: string = req.ip ?? req.connection?.remoteAddress ?? "";
  /* Docker bridge networks: 172.16-31.x.x, 10.x.x.x */
  return (
    ip.startsWith("172.") ||
    ip.startsWith("10.")  ||
    ip === "127.0.0.1"    ||
    ip === "::1"          ||
    ip === "::ffff:127.0.0.1"
  );
}

/**
 * Alertmanager POST body:
 * { alerts: [{ labels: { alertname, severity }, status: 'firing' }] }
 */
router.post("/heal", (req, res) => {
  /* 1. IP check */
  if (!isInternalSource(req)) {
    logger.warn({ ip: req.ip }, "[AutoHeal] ⛔ رُفض — مصدر خارجي");
    return void res.status(403).json({ error: "forbidden" });
  }

  /* 2. Token check */
  if (!verifyHealToken(req)) {
    logger.warn({ ip: req.ip }, "[AutoHeal] ⛔ رُفض — token خاطئ");
    return void res.status(401).json({ error: "unauthorized" });
  }

  /* 3. قبول فقط 'firing' (ليس resolved) */
  const alerts = req.body?.alerts ?? [];
  const hasFiring = alerts.some((a: any) => a.status === "firing");
  if (!hasFiring) {
    return void res.status(200).json({ ok: true, action: "no-op" });
  }

  const alertNames = alerts.map((a: any) => a.labels?.alertname).join(", ");
  logger.warn({ alerts: alertNames }, "[AutoHeal] 🔄 إعادة التشغيل مجدولة بعد 5s");

  res.status(200).json({ ok: true, action: "restart-scheduled" });

  /* أعط الـ response وقت للوصول قبل الإغلاق */
  setTimeout(() => {
    logger.warn("[AutoHeal] 🛑 process.exit(1) — Docker سيُعيد التشغيل");
    process.exit(1);
  }, 5000);
});

/* ── Health probe للـ heal service نفسه ─────────────── */
router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    pid:    process.pid,
    memory: process.memoryUsage(),
  });
});

export default router;
