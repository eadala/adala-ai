import { requireAuthWithTenant } from "../../middlewares/requireAuth";
/**
 * Login Tracking Routes — tenant-scoped via requireAuthWithTenant on reads.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { resolveTenantId } from "../../middlewares/tenantMiddleware";
import {
  getRequiredTenantId,
  tenantRequiredResponse,
  TenantRequiredError,
} from "../../core/tenantContext";

const router = Router();

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

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? "غير محدد";
}

function handleTenantError(err: unknown, res: import("express").Response) {
  if (err instanceof TenantRequiredError) {
    return res.status(403).json(tenantRequiredResponse());
  }
  throw err;
}

router.post("/security/login", async (req, res) => {
  try {
    const auth = getAuth(req as any);
    if (!auth?.userId) return res.status(401).json({ error: "غير مصرح" });

    const userId = auth.userId;
    const sessionId: string | null = (typeof req.body?.sessionId === "string" && req.body.sessionId)
      ? req.body.sessionId : null;

    const ipAddress = getClientIp(req);
    const userAgent = (req.headers["user-agent"] as string) ?? "";
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    const officeId = await resolveTenantId(userId);
    if (!officeId) {
      return res.status(403).json(tenantRequiredResponse(userId));
    }

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
    res.status(500).json({ error: err.message });
  }
});

router.get("/security/logins", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = getRequiredTenantId(req);
    const limit  = Math.min(parseInt(String(req.query.limit  ?? 50)), 200);
    const offset = parseInt(String(req.query.offset ?? 0));
    const status = req.query.status as string | undefined;

    const data = await rows(sql`
      SELECT id, user_id, email, full_name, ip_address, browser, os,
             device_type, status, session_id, created_at
      FROM login_logs
      WHERE office_id = ${officeId}
        ${status ? sql`AND status = ${status}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRow = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs WHERE office_id = ${officeId}
        ${status ? sql`AND status = ${status}` : sql``}
    `);

    res.json({ data, total: countRow?.cnt ?? 0, limit, offset });
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/security/login-stats", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = getRequiredTenantId(req);

    const stats = await one(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'success')::int AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
        COUNT(*) FILTER (WHERE status = 'suspicious')::int AS suspicious_count,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS unique_users
      FROM login_logs
      WHERE office_id = ${officeId}
    `);

    const last24h = await one(sql`
      SELECT COUNT(*)::int AS cnt FROM login_logs
      WHERE office_id = ${officeId}
        AND created_at >= NOW() - INTERVAL '24 hours'
    `);

    const byBrowser = await rows(sql`
      SELECT browser, COUNT(*)::int AS count
      FROM login_logs
      WHERE office_id = ${officeId}
      GROUP BY browser ORDER BY count DESC LIMIT 5
    `);

    const byOs = await rows(sql`
      SELECT os, COUNT(*)::int AS count
      FROM login_logs
      WHERE office_id = ${officeId}
      GROUP BY os ORDER BY count DESC LIMIT 5
    `);

    const recentFailed = await rows(sql`
      SELECT id, user_id, email, ip_address, created_at
      FROM login_logs
      WHERE office_id = ${officeId} AND status = 'failed'
      ORDER BY created_at DESC LIMIT 10
    `);

    const topEmails = await rows(sql`
      SELECT email, COUNT(*)::int AS count
      FROM login_logs
      WHERE office_id = ${officeId} AND email IS NOT NULL
      GROUP BY email ORDER BY count DESC LIMIT 5
    `);

    const suspicious = await rows(sql`
      SELECT id, user_id, email, ip_address, browser, created_at
      FROM login_logs
      WHERE office_id = ${officeId} AND status = 'suspicious'
      ORDER BY created_at DESC LIMIT 10
    `);

    res.json({
      ...stats,
      last24h: last24h?.cnt ?? 0,
      byBrowser,
      byOs,
      recentFailed,
      topEmails,
      suspicious,
    });
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/security/active-sessions", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = getRequiredTenantId(req);

    const data = await rows(sql`
      SELECT DISTINCT ON (user_id)
        user_id, email, full_name, ip_address, browser, os, device_type, session_id, created_at
      FROM login_logs
      WHERE office_id = ${officeId}
        AND status = 'success'
        AND created_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY user_id, created_at DESC
    `);

    res.json(data);
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

router.patch("/security/logins/:id/flag", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = getRequiredTenantId(req);
    const { status = "suspicious" } = req.body as { status?: string };

    const updated = await one(sql`
      UPDATE login_logs SET status = ${status}
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
      RETURNING id, status
    `);

    if (!updated) return res.status(404).json({ error: "السجل غير موجود" });
    res.json(updated);
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
