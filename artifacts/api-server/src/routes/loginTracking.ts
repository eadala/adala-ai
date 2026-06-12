/**
 * Login Tracking Routes — Professional SaaS Login Analytics
 *
 * POST /api/security/login        — record a login event (called by frontend)
 * GET  /api/security/logins       — paginated login history
 * GET  /api/security/login-stats  — aggregated stats for dashboard
 * GET  /api/security/active-sessions — users active in last 30 min
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

/* ── helpers ──────────────────────────────────────────── */
async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function one(q: any): Promise<any | null> {
  const r = await rows(q);
  return r[0] ?? null;
}

/** Parse browser and OS from user-agent string */
function parseUserAgent(ua: string): { browser: string; os: string; deviceType: string } {
  const s = ua ?? "";

  let browser = "غير محدد";
  if (/Edg\//.test(s))        browser = "Microsoft Edge";
  else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = "Chrome";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s) && !/Chrome/.test(s))  browser = "Safari";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/MSIE|Trident/.test(s)) browser = "Internet Explorer";

  let os = "غير محدد";
  if (/Windows NT 10/.test(s))         os = "Windows 10/11";
  else if (/Windows NT 6/.test(s))     os = "Windows 7/8";
  else if (/Mac OS X/.test(s))         os = "macOS";
  else if (/iPhone|iPad/.test(s))      os = "iOS";
  else if (/Android/.test(s))          os = "Android";
  else if (/Linux/.test(s))            os = "Linux";

  let deviceType = "desktop";
  if (/Mobi|Android|iPhone/.test(s))   deviceType = "mobile";
  else if (/iPad|Tablet/.test(s))      deviceType = "tablet";

  return { browser, os, deviceType };
}

/** Extract real IP from forwarded headers */
function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? "غير محدد";
}

/* ══════════════════════════════════════════════════
   POST /api/security/login — Record login event
══════════════════════════════════════════════════ */
router.post("/security/login", async (req, res) => {
  try {
    /* Auth required — userId and identity always server-resolved from Clerk */
    const auth = getAuth(req as any);
    if (!auth?.userId) return res.status(401).json({ error: "غير مصرح" });

    const userId = auth.userId;

    /* Only sessionId accepted from client — identity fields server-resolved */
    const sessionId: string | null = (typeof req.body?.sessionId === "string" && req.body.sessionId)
      ? req.body.sessionId : null;

    const ipAddress = getClientIp(req);
    const userAgent = (req.headers["user-agent"] as string) ?? "";
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const officeId = "default";

    await db.execute(sql`
      INSERT INTO login_logs
        (user_id, email, full_name, ip_address, user_agent, browser, os, device_type,
         status, office_id, session_id)
      VALUES
        (${userId}, null, null, ${ipAddress}, ${userAgent}, ${browser},
         ${os}, ${deviceType}, 'success', ${officeId}, ${sessionId})
    `);

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[LoginTracking]", err);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   GET /api/security/logins — Login history
══════════════════════════════════════════════════ */
router.get("/security/logins", async (req, res) => {
  const auth = getAuth(req as any);
  if (!auth?.userId) return res.status(401).json({ error: "غير مصرح" });

  const limit  = Math.min(parseInt(String(req.query.limit  ?? 50)), 200);
  const offset = parseInt(String(req.query.offset ?? 0));
  const status = req.query.status as string | undefined;

  try {
    const data = await rows(sql`
      SELECT id, user_id, email, full_name, ip_address, browser, os,
             device_type, status, session_id, created_at
      FROM login_logs
      WHERE office_id = 'default'
        ${status ? sql`AND status = ${status}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs WHERE office_id = 'default'
      ${status ? sql`AND status = ${status}` : sql``}
    `);

    res.json({ logs: data, total: total?.cnt ?? 0, limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   GET /api/security/login-stats — Dashboard stats
══════════════════════════════════════════════════ */
router.get("/security/login-stats", async (req, res) => {
  const auth = getAuth(req as any);
  if (!auth?.userId) return res.status(401).json({ error: "غير مصرح" });

  try {
    const today = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs
      WHERE office_id = 'default'
        AND created_at >= CURRENT_DATE
    `);

    const total = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs WHERE office_id = 'default'
    `);

    const successCount = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs
      WHERE office_id = 'default' AND status = 'success'
    `);

    const failedCount = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs
      WHERE office_id = 'default' AND status = 'failed'
    `);

    const suspiciousCount = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs
      WHERE office_id = 'default' AND status = 'suspicious'
    `);

    const uniqueUsers = await one(sql`
      SELECT COUNT(DISTINCT user_id)::int AS cnt FROM login_logs
      WHERE office_id = 'default' AND user_id IS NOT NULL
    `);

    const uniqueIps = await one(sql`
      SELECT COUNT(DISTINCT ip_address)::int AS cnt FROM login_logs
      WHERE office_id = 'default'
    `);

    /* Browsers breakdown */
    const browsers = await rows(sql`
      SELECT browser, COUNT(*)::int AS cnt
      FROM login_logs WHERE office_id = 'default'
      GROUP BY browser ORDER BY cnt DESC LIMIT 6
    `);

    /* OS breakdown */
    const devices = await rows(sql`
      SELECT device_type, COUNT(*)::int AS cnt
      FROM login_logs WHERE office_id = 'default'
      GROUP BY device_type ORDER BY cnt DESC
    `);

    /* Hourly activity (last 7 days) */
    const hourly = await rows(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD HH24') AS hour,
        COUNT(*)::int AS cnt
      FROM login_logs
      WHERE office_id = 'default'
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY hour ORDER BY hour
    `);

    /* Top users */
    const topUsers = await rows(sql`
      SELECT email, full_name, COUNT(*)::int AS login_count,
             MAX(created_at) AS last_login
      FROM login_logs
      WHERE office_id = 'default' AND email IS NOT NULL
      GROUP BY email, full_name
      ORDER BY login_count DESC LIMIT 10
    `);

    /* Recent suspicious */
    const suspicious = await rows(sql`
      SELECT id, email, full_name, ip_address, browser, os, created_at
      FROM login_logs
      WHERE office_id = 'default' AND status = 'suspicious'
      ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      today:           today?.cnt ?? 0,
      total:           total?.cnt ?? 0,
      success:         successCount?.cnt ?? 0,
      failed:          failedCount?.cnt ?? 0,
      suspicious:      suspiciousCount?.cnt ?? 0,
      uniqueUsers:     uniqueUsers?.cnt ?? 0,
      uniqueIps:       uniqueIps?.cnt ?? 0,
      browsers,
      devices,
      hourly,
      topUsers,
      recentSuspicious: suspicious,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   GET /api/security/my-sessions — Current user's own sessions
══════════════════════════════════════════════════ */
router.get("/security/my-sessions", async (req, res) => {
  const auth = getAuth(req as any);
  if (!auth?.userId) return res.status(401).json({ error: "غير مصرح" });

  try {
    const data = await rows(sql`
      SELECT id, ip_address, browser, os, device_type, status, created_at
      FROM login_logs
      WHERE user_id = ${auth.userId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const uniqueIps   = new Set(data.map((r: any) => r.ip_address)).size;
    const deviceBreak = data.reduce((acc: any, r: any) => {
      acc[r.device_type] = (acc[r.device_type] || 0) + 1;
      return acc;
    }, {});

    res.json({ sessions: data, uniqueIps, deviceBreakdown: deviceBreak, total: data.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   DELETE /api/security/logins/:id — Remove log entry
══════════════════════════════════════════════════ */
router.delete("/security/logins/:id", async (req, res) => {
  const auth = getAuth(req as any);
  if (!auth?.userId) return res.status(401).json({ error: "غير مصرح" });

  try {
    await db.execute(sql`
      DELETE FROM login_logs
      WHERE id = ${req.params.id}::uuid AND office_id = 'default'
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
