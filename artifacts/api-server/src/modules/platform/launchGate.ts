/**
 * Launch Gate & Runtime Shield — API Routes
 */

import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { runLaunchGate } from "../../core/launchGate";
import { getShieldStatus, banIp, unbanIp, getBannedIps } from "../../core/runtimeShield";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function isSuperAdmin(req: any): boolean {
  const meta = req.auth?.sessionClaims?.publicMetadata as any;
  if (meta?.role === "super_admin") return true;
  const emails = (process.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map((e: string) => e.trim());
  return emails.includes(req.auth?.sessionClaims?.email ?? "");
}

/* ── Ensure ct_security_events table ── */
async function ensureTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ct_security_events (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      event_type    TEXT NOT NULL,
      severity      TEXT NOT NULL DEFAULT 'P3',
      description   TEXT,
      request_path  TEXT,
      request_method TEXT,
      client_ip     TEXT,
      user_id       TEXT,
      office_id     TEXT,
      resolved      BOOLEAN DEFAULT false,
      resolved_at   TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ct_sec_events_severity ON ct_security_events(severity, resolved, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ct_sec_events_office ON ct_security_events(office_id, created_at DESC)`);
}
ensureTables().catch(() => {});

/* ─────────────────────────────────────────────────────────────────────────
   POST /api/launch-gate/run
   Run all 8 gates and return the GO/NO-GO report
──────────────────────────────────────────────────────────────────────────── */
router.post("/launch-gate/run", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  try {
    const report = await runLaunchGate();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/launch-gate/status
   Last cached report or quick health
──────────────────────────────────────────────────────────────────────────── */
router.get("/launch-gate/status", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  const shield = getShieldStatus();
  res.json({ shield, timestamp: new Date().toISOString() });
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/launch-gate/shield
   Live runtime shield status
──────────────────────────────────────────────────────────────────────────── */
router.get("/launch-gate/shield", requireAuth, (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  res.json(getShieldStatus());
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/launch-gate/threats
   Recent threat events from DB
──────────────────────────────────────────────────────────────────────────── */
router.get("/launch-gate/threats", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  try {
    const rows = await db.execute(sql`
      SELECT id, event_type, severity, description, request_path,
             request_method, client_ip, user_id, office_id, resolved, created_at
      FROM ct_security_events
      ORDER BY created_at DESC
      LIMIT 100
    `);
    const events = (rows as any).rows ?? rows;
    res.json({ events });
  } catch {
    res.json({ events: [] });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /api/launch-gate/resolve/:id
   Resolve a threat event
──────────────────────────────────────────────────────────────────────────── */
router.post("/launch-gate/resolve/:id", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  const { id } = req.params as Record<string, string>;
  try {
    await db.execute(sql`
      UPDATE ct_security_events SET resolved=true, resolved_at=NOW() WHERE id=${id}
    `);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "فشل التحديث" });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /api/launch-gate/ban-ip
   Ban a suspicious IP
──────────────────────────────────────────────────────────────────────────── */
router.post("/launch-gate/ban-ip", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  const { ip } = req.body as { ip: string };
  if (!ip) { res.status(400).json({ error: "IP مطلوب" }); return; }
  banIp(ip);
  res.json({ ok: true, message: `تم حظر ${ip}` });
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /api/launch-gate/unban-ip
──────────────────────────────────────────────────────────────────────────── */
router.post("/launch-gate/unban-ip", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  const { ip } = req.body as { ip: string };
  if (!ip) { res.status(400).json({ error: "IP مطلوب" }); return; }
  unbanIp(ip);
  res.json({ ok: true, message: `تم رفع الحظر عن ${ip}` });
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/launch-gate/banned-ips
──────────────────────────────────────────────────────────────────────────── */
router.get("/launch-gate/banned-ips", requireAuth, (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  res.json({ ips: getBannedIps() });
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/launch-gate/stats
   Aggregate security stats for dashboard
──────────────────────────────────────────────────────────────────────────── */
router.get("/launch-gate/stats", requireAuth, async (req, res) => {
  if (!isSuperAdmin(req)) { res.status(403).json({ error: "غير مصرح" }); return; }
  try {
    const totalRow = await db.execute(sql`SELECT COUNT(*) as cnt FROM ct_security_events`);
    const unresolvedRow = await db.execute(sql`SELECT COUNT(*) as cnt FROM ct_security_events WHERE resolved=false`);
    const p0Row = await db.execute(sql`SELECT COUNT(*) as cnt FROM ct_security_events WHERE severity='P0'`);
    const todayRow = await db.execute(sql`SELECT COUNT(*) as cnt FROM ct_security_events WHERE created_at > NOW() - INTERVAL '24 hours'`);
    const bySeverity = await db.execute(sql`
      SELECT severity, COUNT(*) as cnt FROM ct_security_events GROUP BY severity ORDER BY severity
    `);

    const tr = (r: any) => Number(((r as any).rows ?? r)[0]?.cnt ?? 0);

    res.json({
      total: tr(totalRow),
      unresolved: tr(unresolvedRow),
      p0Count: tr(p0Row),
      todayCount: tr(todayRow),
      bySeverity: ((bySeverity as any).rows ?? bySeverity),
      shield: getShieldStatus(),
    });
  } catch {
    res.json({ total: 0, unresolved: 0, p0Count: 0, todayCount: 0, bySeverity: [], shield: getShieldStatus() });
  }
});

export default router;
