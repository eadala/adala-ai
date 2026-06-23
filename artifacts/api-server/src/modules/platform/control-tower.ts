/**
 * 🏛️ Adala Control Tower — SOC + Admin Observatory
 * ─────────────────────────────────────────────────
 * يوفر:
 *  • مراقبة لحظية لكل المكاتب والجلسات والـ AI
 *  • SSE stream كل 3 ثوانٍ
 *  • Deep Inspect لأي مكتب
 *  • Freeze / Unfreeze tenant
 *  • Security feed مرتب بالخطورة
 *  • AI Kill Switch
 *
 * الحماية: isSuperAdmin — نفس نمط جميع وحدات المنصة
 */

import { Router }              from "express";
import { db }                  from "@workspace/db";
import { sql }                 from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import { collectMetrics }      from "../../observability/metrics";
import { getSystemState, setAiLock } from "../../hardening/production.lock";

const router = Router();

/* ── Super-Admin Guard (local — same pattern as all platform modules) ────── */
let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}
async function isSuperAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return false;
  try {
    const user = await getClerk().users.getUser(userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
    const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    return (!!ownerEmail && email === ownerEmail) || user.publicMetadata?.role === "super_admin";
  } catch { return false; }
}
async function ctGuard(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req)))
    return res.status(403).json({ error: "FORBIDDEN — Control Tower Access Denied" });
  next();
}

/* ── In-memory Frozen Tenants (persisted to system_events for audit) ──── */
const frozenTenants = new Set<string>();

/* ── Bootstrap CT security events table ─────────────────────────────── */
async function ensureCtTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ct_security_events (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id  TEXT,
      event_type TEXT NOT NULL,
      severity   TEXT NOT NULL DEFAULT 'LOW',
      message    TEXT NOT NULL,
      metadata   JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureCtTables().catch(() => {});

/* ── Helpers ─────────────────────────────────────────────────────────── */
async function getTenantMatrix() {
  try {
    const rows = await db.execute(sql`
      SELECT
        om.office_id,
        COALESCE(op.name, 'مكتب #' || LEFT(om.office_id::text, 8)) AS office_name,
        COUNT(DISTINCT om.user_id)    AS members,
        COUNT(DISTINCT c.id)          AS cases,
        COUNT(DISTINCT ci.id)         AS invoices,
        MAX(al.created_at)            AS last_activity
      FROM office_members om
      LEFT JOIN office_page op      ON op.office_id  = om.office_id
      LEFT JOIN cases c             ON c.office_id   = om.office_id::uuid
      LEFT JOIN client_invoices ci  ON ci.office_id  = om.office_id::uuid
      LEFT JOIN audit_logs al       ON al.office_id::text = om.office_id::text
      GROUP BY om.office_id, op.name
      ORDER BY cases DESC
    `);
    return ((rows.rows ?? rows) as any[]).map((r: any) => ({
      ...r,
      members:  Number(r.members  ?? 0),
      cases:    Number(r.cases    ?? 0),
      invoices: Number(r.invoices ?? 0),
      frozen:   frozenTenants.has(String(r.office_id)),
    }));
  } catch { return []; }
}

async function getSecurityFeed() {
  const sysRows = await db.execute(sql`
    SELECT
      event_type,
      office_id,
      metadata,
      created_at,
      CASE
        WHEN event_type IN ('LOGIN_FAILED','UNAUTHORIZED_ACCESS','SUSPICIOUS_ACTIVITY','TENANT_FROZEN')
          THEN 'HIGH'
        WHEN event_type IN ('CASE_DELETED','DOCUMENT_DELETED','ADMIN_ACTION','TENANT_UNFROZEN')
          THEN 'MEDIUM'
        ELSE 'LOW'
      END AS severity,
      'system' AS source
    FROM system_events
    ORDER BY created_at DESC
    LIMIT 40
  `).then(r => (r.rows ?? r) as any[]).catch(() => []);

  const auditRows = await db.execute(sql`
    SELECT
      action        AS event_type,
      office_id,
      resource      AS metadata,
      created_at,
      CASE WHEN action IN ('delete','freeze','impersonate') THEN 'HIGH' ELSE 'LOW' END AS severity,
      'audit'       AS source
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 20
  `).then(r => (r.rows ?? r) as any[]).catch(() => []);

  return [...sysRows, ...auditRows]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);
}

async function getActiveUsers(): Promise<number> {
  return db.execute(sql`
    SELECT COUNT(DISTINCT user_id) AS cnt
    FROM login_logs
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `).then(r => Number(((r.rows ?? r) as any[])[0]?.cnt ?? 0)).catch(() => 0);
}

async function getAiPendingCount(): Promise<number> {
  return db.execute(sql`
    SELECT COUNT(*) AS cnt FROM ai_tasks WHERE status = 'pending'
  `).then(r => Number(((r.rows ?? r) as any[])[0]?.cnt ?? 0)).catch(() => 0);
}

/* ═══════════════════════════════════════════════════════════════════════
   ENDPOINTS
═══════════════════════════════════════════════════════════════════════ */

/* GET /control-tower/metrics — full snapshot */
router.get("/control-tower/metrics", ctGuard, async (_req, res) => {
  try {
    const [metrics, tenants, securityFeed, activeUsers, aiLoad] = await Promise.all([
      collectMetrics(),
      getTenantMatrix(),
      getSecurityFeed(),
      getActiveUsers(),
      getAiPendingCount(),
    ]);
    const state = getSystemState();

    res.json({
      systemHealth: {
        status:         state.mode,
        aiLock:         state.aiLock,
        productionMode: state.productionMode,
        dbHealth:       metrics.dbHealth,
        dbLatency:      metrics.dbLatency,
        memory:         metrics.memory,
        uptime:         metrics.uptime,
        errorRate:      parseFloat((metrics.errorRate * 100).toFixed(2)),
        totalRequests:  metrics.totalRequests,
        failedRequests: metrics.failedRequests,
        webhookFailures: metrics.webhookFailures,
      },
      activeUsers,
      aiLoad,
      tenantMatrix: tenants,
      securityFeed: securityFeed.slice(0, 20),
      frozenTenants: Array.from(frozenTenants),
      timestamp: Date.now(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* GET /control-tower/stream — SSE live feed every 3 s */
router.get("/control-tower/stream", ctGuard, (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  async function push() {
    try {
      const [metrics, activeUsers, aiLoad, tenants] = await Promise.all([
        collectMetrics(),
        getActiveUsers(),
        getAiPendingCount(),
        getTenantMatrix(),
      ]);
      const state = getSystemState();
      res.write(`data: ${JSON.stringify({
        timestamp:    Date.now(),
        memory:       metrics.memory,
        dbLatency:    metrics.dbLatency,
        errorRate:    parseFloat((metrics.errorRate * 100).toFixed(2)),
        uptime:       Math.floor(metrics.uptime),
        totalRequests: metrics.totalRequests,
        failedRequests: metrics.failedRequests,
        activeUsers,
        aiLoad,
        mode:         state.mode,
        aiLock:       state.aiLock,
        tenantCount:  tenants.length,
        frozenCount:  frozenTenants.size,
      })}\n\n`);
    } catch { /* non-fatal */ }
  }

  push();
  const interval = setInterval(push, 3000);
  req.on("close", () => clearInterval(interval));
});

/* GET /control-tower/inspect/:tenantId — deep dive */
router.get("/control-tower/inspect/:tenantId", ctGuard, async (req, res) => {
  const tenantId = String((req.params as Record<string, string>).tenantId);

  const [cases, clients, invoices, auditLogs, members, aiActivity] = await Promise.all([
    db.execute(sql`
      SELECT id, title, status, created_at FROM cases
      WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 20
    `).then(r => (r.rows ?? r) as any[]).catch(() => []),

    db.execute(sql`
      SELECT id, name, email, phone, created_at FROM clients
      WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 20
    `).then(r => (r.rows ?? r) as any[]).catch(() => []),

    db.execute(sql`
      SELECT id, invoice_number, amount, status, created_at FROM client_invoices
      WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 20
    `).then(r => (r.rows ?? r) as any[]).catch(() => []),

    db.execute(sql`
      SELECT action, resource, user_full_name, details, created_at FROM audit_logs
      WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 30
    `).then(r => (r.rows ?? r) as any[]).catch(() => []),

    db.execute(sql`
      SELECT user_id, role, created_at FROM office_members
      WHERE office_id = ${tenantId}
    `).then(r => (r.rows ?? r) as any[]).catch(() => []),

    db.execute(sql`
      SELECT task_type, status, created_at FROM ai_tasks
      WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 10
    `).then(r => (r.rows ?? r) as any[]).catch(() => []),
  ]);

  res.json({
    tenantId, frozen: frozenTenants.has(tenantId),
    cases, clients, invoices, auditLogs, members, aiActivity,
  });
});

/* GET /control-tower/security-feed */
router.get("/control-tower/security-feed", ctGuard, async (_req, res) => {
  res.json(await getSecurityFeed());
});

/* POST /control-tower/freeze/:tenantId */
router.post("/control-tower/freeze/:tenantId", ctGuard, async (req, res) => {
  const tenantId = String((req.params as Record<string, string>).tenantId);
  frozenTenants.add(tenantId);
  await db.execute(sql`
    INSERT INTO system_events (event_type, office_id, metadata)
    VALUES ('TENANT_FROZEN', ${tenantId},
            ${JSON.stringify({ reason: req.body?.reason ?? "Admin action", ts: new Date().toISOString() })}::jsonb)
  `).catch(() => {});
  res.json({ success: true, frozen: true, tenantId });
});

/* DELETE /control-tower/freeze/:tenantId */
router.delete("/control-tower/freeze/:tenantId", ctGuard, async (req, res) => {
  const tenantId = String((req.params as Record<string, string>).tenantId);
  frozenTenants.delete(tenantId);
  await db.execute(sql`
    INSERT INTO system_events (event_type, office_id, metadata)
    VALUES ('TENANT_UNFROZEN', ${tenantId}, '{}'::jsonb)
  `).catch(() => {});
  res.json({ success: true, frozen: false, tenantId });
});

/* POST /control-tower/ai-lock */
router.post("/control-tower/ai-lock", ctGuard, async (req, res) => {
  const locked = !!req.body?.locked;
  setAiLock(locked);
  await db.execute(sql`
    INSERT INTO system_events (event_type, metadata)
    VALUES ('AI_LOCK_CHANGED', ${JSON.stringify({ locked })}::jsonb)
  `).catch(() => {});
  res.json({ success: true, aiLock: locked });
});

/* POST /control-tower/push-event — manual SOC event injection */
router.post("/control-tower/push-event", ctGuard, async (req, res) => {
  const { office_id, event_type, severity, message } = req.body ?? {};
  await db.execute(sql`
    INSERT INTO ct_security_events (office_id, event_type, severity, message)
    VALUES (${office_id ?? null}, ${String(event_type)}, ${severity ?? "LOW"}, ${String(message)})
  `).catch(() => {});
  res.json({ success: true });
});

export default router;
