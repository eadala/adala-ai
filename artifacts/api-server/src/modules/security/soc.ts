import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import { getSaRateLimitStats } from "../../middlewares/requireAuth";

const router = Router();
const saGuard = requireSuperAdmin;

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_sessions (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id   TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        office_id    TEXT,
        ip_address   TEXT,
        user_agent   TEXT,
        device_type  TEXT DEFAULT 'unknown',
        browser      TEXT,
        os           TEXT,
        geo_country  TEXT,
        geo_city     TEXT,
        status       TEXT DEFAULT 'active',
        started_at   TIMESTAMPTZ DEFAULT NOW(),
        last_seen    TIMESTAMPTZ DEFAULT NOW(),
        revoked_at   TIMESTAMPTZ,
        revoked_by   TEXT
      );
      CREATE TABLE IF NOT EXISTS security_alerts (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type   TEXT NOT NULL,
        severity     TEXT DEFAULT 'medium',
        title        TEXT NOT NULL,
        description  TEXT,
        user_id      TEXT,
        office_id    TEXT,
        ip_address   TEXT,
        metadata     JSONB DEFAULT '{}',
        status       TEXT DEFAULT 'open',
        resolved_at  TIMESTAMPTZ,
        resolved_by  TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address   TEXT UNIQUE NOT NULL,
        reason       TEXT,
        blocked_by   TEXT,
        blocked_at   TIMESTAMPTZ DEFAULT NOW(),
        expires_at   TIMESTAMPTZ,
        auto_blocked BOOLEAN DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS mfa_status_cache (
        user_id      TEXT PRIMARY KEY,
        has_mfa      BOOLEAN DEFAULT false,
        checked_at   TIMESTAMPTZ DEFAULT NOW(),
        mfa_methods  JSONB DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON security_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_sessions_status ON security_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
    `);
  } catch {}
})();

async function safeQuery(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

async function safeOne(q: any): Promise<any> {
  const rows = await safeQuery(q);
  return rows[0] ?? null;
}

/* ── Phase 1: SOC Dashboard ─────────────────────────────────────────── */

router.get("/soc/dashboard", saGuard, async (req, res) => {
  try {
    const [
      activeSessions,
      failedLogins,
      saAttempts,
      blockedIps,
      openAlerts,
      rateLimitEvents,
      recentAudit,
      mfaStats,
    ] = await Promise.all([
      safeOne(sql`SELECT COUNT(*) as count FROM security_sessions WHERE status='active'`),
      safeOne(sql`SELECT COUNT(*) as count FROM login_logs WHERE status='failed' AND created_at > NOW() - INTERVAL '24 hours'`),
      safeOne(sql`SELECT COUNT(*) as count FROM audit_logs WHERE action='SA_ACCESS_DENIED' AND created_at > NOW() - INTERVAL '24 hours'`),
      safeOne(sql`SELECT COUNT(*) as count FROM blocked_ips WHERE (expires_at IS NULL OR expires_at > NOW())`),
      safeQuery(sql`SELECT * FROM security_alerts WHERE status='open' ORDER BY created_at DESC LIMIT 10`),
      safeOne(sql`SELECT COUNT(*) as count FROM audit_logs WHERE action='SA_ACCESS_DENIED' AND created_at > NOW() - INTERVAL '1 hour'`),
      safeQuery(sql`SELECT action, resource, user_full_name, ip_address, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20`),
      safeOne(sql`SELECT COUNT(*) as total, SUM(CASE WHEN has_mfa THEN 1 ELSE 0 END) as with_mfa FROM mfa_status_cache`),
    ]);

    const saRateStats = getSaRateLimitStats();

    const [suspiciousLogins, recentDevices, activeApiTokens] = await Promise.all([
      safeQuery(sql`SELECT * FROM login_logs WHERE status='suspicious' ORDER BY created_at DESC LIMIT 10`),
      safeQuery(sql`SELECT DISTINCT device_type, browser, os, user_id, ip_address, created_at FROM login_logs ORDER BY created_at DESC LIMIT 20`),
      safeOne(sql`SELECT COUNT(*) as count FROM developer_tokens WHERE (expires_at IS NULL OR expires_at > NOW())`),
    ]);

    res.json({
      summary: {
        activeSessions: Number(activeSessions?.count ?? 0),
        failedLoginsToday: Number(failedLogins?.count ?? 0),
        saAccessDeniedToday: Number(saAttempts?.count ?? 0),
        blockedIps: Number(blockedIps?.count ?? 0),
        openAlerts: openAlerts.length,
        rateLimitEventsLastHour: Number(rateLimitEvents?.count ?? 0),
        activeApiTokens: Number(activeApiTokens?.count ?? 0),
        mfaTotal: Number(mfaStats?.total ?? 0),
        mfaEnabled: Number(mfaStats?.with_mfa ?? 0),
      },
      saRateLimit: saRateStats,
      openAlerts,
      recentAudit,
      suspiciousLogins,
      recentDevices,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Phase 3: Session Security ──────────────────────────────────────── */

router.get("/soc/sessions", saGuard, async (req, res) => {
  try {
    const { status, search, limit = 50 } = req.query as any;
    let q = `SELECT * FROM security_sessions WHERE 1=1`;
    const params: any[] = [];
    if (status) { q += ` AND status = $${params.length + 1}`; params.push(status); }
    if (search) { q += ` AND (user_id ILIKE $${params.length + 1} OR ip_address ILIKE $${params.length + 1})`; params.push(`%${search}%`); }
    q += ` ORDER BY last_seen DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));
    const rows = await safeQuery(sql.raw(q) as any);
    res.json(rows);
  } catch (e: any) {
    res.json(await safeQuery(sql`SELECT * FROM security_sessions ORDER BY last_seen DESC LIMIT 50`));
  }
});

router.get("/soc/sessions/live", saGuard, async (req, res) => {
  const rows = await safeQuery(sql`
    SELECT s.*, l.full_name, l.email 
    FROM security_sessions s
    LEFT JOIN login_logs l ON l.session_id = s.session_id
    WHERE s.status = 'active'
    ORDER BY s.last_seen DESC
    LIMIT 100
  `);
  res.json(rows);
});

router.post("/soc/sessions/:id/revoke", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const meta = auditMeta(req);
    await db.execute(sql`
      UPDATE security_sessions SET status='revoked', revoked_at=NOW(), revoked_by=${meta.userId ?? 'admin'}
      WHERE id=${id}
    `);
    await auditLog({ ...meta, action: "SESSION_REVOKED", resource: "security_sessions", resourceId: id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/soc/sessions/revoke-all", saGuard, async (req, res) => {
  try {
    const { userId } = req.body;
    const meta = auditMeta(req);
    await db.execute(sql`UPDATE security_sessions SET status='revoked', revoked_at=NOW() WHERE user_id=${userId}`);
    await auditLog({ ...meta, action: "ALL_SESSIONS_REVOKED", resource: "security_sessions", details: `Force logout for user ${userId}` });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Phase 9: Threat Detection ──────────────────────────────────────── */

router.get("/soc/alerts", saGuard, async (req, res) => {
  try {
    const { severity, status = "open" } = req.query as any;
    const rows = await safeQuery(sql`
      SELECT * FROM security_alerts 
      WHERE status=${status}
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/soc/alerts/:id/resolve", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const meta = auditMeta(req);
    await db.execute(sql`
      UPDATE security_alerts SET status='resolved', resolved_at=NOW(), resolved_by=${meta.userId ?? 'admin'}
      WHERE id=${id}
    `);
    await auditLog({ ...meta, action: "ALERT_RESOLVED", resource: "security_alerts", resourceId: id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/soc/threat-scan", saGuard, async (_req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();

    const [bruteForce, massDeletes, massDownloads, crossTenant, abnormalAI, apiAbuse] = await Promise.all([
      safeQuery(sql`
        SELECT ip_address, COUNT(*) as attempts, MAX(created_at) as last_attempt
        FROM login_logs WHERE status='failed' AND created_at > ${oneDayAgo}
        GROUP BY ip_address HAVING COUNT(*) >= 10 ORDER BY attempts DESC LIMIT 20
      `),
      safeQuery(sql`
        SELECT user_id, COUNT(*) as count FROM audit_logs 
        WHERE action ILIKE '%DELETE%' AND created_at > ${oneHourAgo}
        GROUP BY user_id HAVING COUNT(*) >= 5 ORDER BY count DESC LIMIT 10
      `),
      safeQuery(sql`
        SELECT user_id, COUNT(*) as count FROM audit_logs
        WHERE action ILIKE '%DOWNLOAD%' AND created_at > ${oneHourAgo}
        GROUP BY user_id HAVING COUNT(*) >= 20 ORDER BY count DESC LIMIT 10
      `),
      safeQuery(sql`
        SELECT user_id, COUNT(DISTINCT office_id) as offices FROM audit_logs
        WHERE created_at > ${oneDayAgo} AND office_id IS NOT NULL
        GROUP BY user_id HAVING COUNT(DISTINCT office_id) >= 3 ORDER BY offices DESC LIMIT 10
      `),
      safeQuery(sql`
        SELECT user_id, office_id, COUNT(*) as requests FROM audit_logs
        WHERE action ILIKE '%AI%' AND created_at > ${oneHourAgo}
        GROUP BY user_id, office_id HAVING COUNT(*) >= 50 ORDER BY requests DESC LIMIT 10
      `),
      safeQuery(sql`
        SELECT ip_address, COUNT(*) as requests FROM audit_logs
        WHERE created_at > ${oneHourAgo}
        GROUP BY ip_address HAVING COUNT(*) >= 200 ORDER BY requests DESC LIMIT 10
      `),
    ]);

    const threats: any[] = [];

    for (const r of bruteForce) {
      threats.push({ type: "BRUTE_FORCE", severity: "high", ip: r.ip_address, count: r.attempts, detail: "محاولات تسجيل دخول متكررة" });
    }
    for (const r of massDeletes) {
      threats.push({ type: "MASS_DELETE", severity: "critical", userId: r.user_id, count: r.count, detail: "عمليات حذف جماعية" });
    }
    for (const r of massDownloads) {
      threats.push({ type: "MASS_DOWNLOAD", severity: "medium", userId: r.user_id, count: r.count, detail: "تنزيل جماعي مشبوه" });
    }
    for (const r of crossTenant) {
      threats.push({ type: "CROSS_TENANT", severity: "critical", userId: r.user_id, offices: r.offices, detail: "وصول عبر مستأجرين متعددين" });
    }
    for (const r of abnormalAI) {
      threats.push({ type: "ABNORMAL_AI", severity: "medium", userId: r.user_id, count: r.requests, detail: "استخدام AI مفرط" });
    }
    for (const r of apiAbuse) {
      threats.push({ type: "API_ABUSE", severity: "high", ip: r.ip_address, count: r.requests, detail: "إساءة استخدام API" });
    }

    if (threats.length > 0) {
      for (const t of threats.slice(0, 10)) {
        await db.execute(sql`
          INSERT INTO security_alerts (alert_type, severity, title, description, ip_address, metadata)
          VALUES (${t.type}, ${t.severity}, ${t.detail}, ${JSON.stringify(t)}, ${t.ip ?? null}, ${JSON.stringify(t)}::jsonb)
          ON CONFLICT DO NOTHING
        `).catch(() => {});
      }
    }

    res.json({ threats, scanTime: new Date().toISOString(), totalThreats: threats.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Blocked IPs ─────────────────────────────────────────────────────── */

router.get("/soc/blocked-ips", saGuard, async (_req, res) => {
  const rows = await safeQuery(sql`SELECT * FROM blocked_ips WHERE (expires_at IS NULL OR expires_at > NOW()) ORDER BY blocked_at DESC`);
  res.json(rows);
});

router.post("/soc/blocked-ips", saGuard, async (req, res) => {
  try {
    const { ip_address, reason, expires_hours } = req.body;
    const meta = auditMeta(req);
    const expiresAt = expires_hours ? new Date(Date.now() + expires_hours * 3600000).toISOString() : null;
    await db.execute(sql`
      INSERT INTO blocked_ips (ip_address, reason, blocked_by, expires_at)
      VALUES (${ip_address}, ${reason ?? 'Manual block'}, ${meta.userId ?? 'admin'}, ${expiresAt})
      ON CONFLICT (ip_address) DO UPDATE SET reason=EXCLUDED.reason, blocked_at=NOW()
    `);
    await auditLog({ ...meta, action: "IP_BLOCKED", resource: "blocked_ips", details: `Blocked IP: ${ip_address}` });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/soc/blocked-ips/:id", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const meta = auditMeta(req);
    await db.execute(sql`DELETE FROM blocked_ips WHERE id=${id}`);
    await auditLog({ ...meta, action: "IP_UNBLOCKED", resource: "blocked_ips", resourceId: id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Login Activity ──────────────────────────────────────────────────── */

router.get("/soc/login-activity", saGuard, async (req, res) => {
  const { hours = 24 } = req.query as any;
  const since = new Date(Date.now() - Number(hours) * 3600000).toISOString();
  const rows = await safeQuery(sql`
    SELECT * FROM login_logs WHERE created_at > ${since} ORDER BY created_at DESC LIMIT 200
  `);
  res.json(rows);
});

router.get("/soc/login-stats", saGuard, async (_req, res) => {
  const [daily, byStatus, byDevice, byOs] = await Promise.all([
    safeQuery(sql`
      SELECT DATE(created_at) as date, COUNT(*) as total,
        SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
      FROM login_logs WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date DESC
    `),
    safeQuery(sql`SELECT status, COUNT(*) as count FROM login_logs GROUP BY status`),
    safeQuery(sql`SELECT device_type, COUNT(*) as count FROM login_logs GROUP BY device_type`),
    safeQuery(sql`SELECT os, COUNT(*) as count FROM login_logs WHERE os IS NOT NULL GROUP BY os ORDER BY count DESC LIMIT 10`),
  ]);
  res.json({ daily, byStatus, byDevice, byOs });
});

/* ── MFA Status ─────────────────────────────────────────────────────── */

router.get("/soc/mfa-status", saGuard, async (_req, res) => {
  const [total, withMfa, withoutMfa] = await Promise.all([
    safeOne(sql`SELECT COUNT(*) as count FROM mfa_status_cache`),
    safeOne(sql`SELECT COUNT(*) as count FROM mfa_status_cache WHERE has_mfa=true`),
    safeQuery(sql`SELECT user_id FROM mfa_status_cache WHERE has_mfa=false LIMIT 50`),
  ]);
  res.json({
    total: Number(total?.count ?? 0),
    withMfa: Number(withMfa?.count ?? 0),
    withoutMfa: withoutMfa.map((r: any) => r.user_id),
  });
});

/* ── Export ──────────────────────────────────────────────────────────── */

router.get("/soc/export", saGuard, async (req, res) => {
  const { type = "alerts" } = req.query as any;
  const meta = auditMeta(req);
  let rows: any[] = [];
  if (type === "alerts") rows = await safeQuery(sql`SELECT * FROM security_alerts ORDER BY created_at DESC`);
  else if (type === "sessions") rows = await safeQuery(sql`SELECT * FROM security_sessions ORDER BY started_at DESC`);
  else if (type === "blocked") rows = await safeQuery(sql`SELECT * FROM blocked_ips ORDER BY blocked_at DESC`);
  else if (type === "logins") rows = await safeQuery(sql`SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 1000`);
  await auditLog({ ...meta, action: "SOC_EXPORT", resource: "security", details: `Exported: ${type}` });
  res.json({ data: rows, exportedAt: new Date().toISOString(), type });
});

export default router;
