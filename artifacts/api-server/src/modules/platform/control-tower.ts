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
import { collectMetrics }      from "../../observability/metrics";
import { getSystemState, setAiLock } from "../../hardening/production.lock";
import { governanceGuard } from "../../core/governance/governanceKernel";
import { requireSuperAdmin as ctGuard } from "../../middlewares/requireAuth";
import { setTenantLifecycle, isOfficeLifecycleBlocked, getLifecycleBlockedOffices } from "../../core/tenant/tenantLifecycle";

const router = Router();

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
  const rows = await db.execute(sql`
    SELECT
      om.office_id,
      COALESCE(op.name, 'مكتب #' || LEFT(om.office_id::text, 8)) AS office_name,
      COUNT(DISTINCT om.user_id)    AS members,
      COUNT(DISTINCT c.id)          AS cases,
      COUNT(DISTINCT ci.id)         AS invoices,
      MAX(al.created_at)            AS last_activity
    FROM office_members om
    LEFT JOIN office_page op ON op.office_id = om.office_id
    LEFT JOIN cases c         ON c.office_id = om.office_id
    LEFT JOIN client_invoices ci ON ci.office_id = om.office_id
    LEFT JOIN audit_logs al   ON al.office_id = om.office_id
    GROUP BY om.office_id, op.name
    ORDER BY cases DESC
  `);
  return ((rows.rows ?? rows) as any[]).map((r: any) => ({
    ...r,
    members:  Number(r.members  ?? 0),
    cases:    Number(r.cases    ?? 0),
    invoices: Number(r.invoices ?? 0),
    frozen:   isOfficeLifecycleBlocked(String(r.office_id)),
  }));
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
      frozenTenants: getLifecycleBlockedOffices(),
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
        frozenCount:  getLifecycleBlockedOffices().length,
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
      SELECT id, full_name AS name, email, phone, created_at FROM clients
      WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 20
    `).then(r => (r.rows ?? r) as any[]).catch(() => []),

    db.execute(sql`
      SELECT id, invoice_number, total AS amount, status, created_at FROM client_invoices
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
    tenantId, frozen: isOfficeLifecycleBlocked(tenantId),
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
  await setTenantLifecycle(tenantId, "frozen", {
    reason: req.body?.reason ?? "Admin action",
    by: (req as { userId?: string }).userId,
  });
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
  await setTenantLifecycle(tenantId, "active");
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

/* ──────────────────────────────────────────────────────────────────────
 * 🧠 NEW: Health Score + Anomaly Detection + AOL Auto-Actions
 * ────────────────────────────────────────────────────────────────────── */

/* GET /control-tower/health-score — composite score 0-100 */
router.get("/control-tower/health-score", ctGuard, async (_req, res) => {
  try {
    const dbAll = async (q: any): Promise<any[]> => {
      const r = await db.execute(q) as any;
      return Array.isArray(r) ? r : (r?.rows ?? []);
    };
    const dbOne = async (q: any): Promise<any> => (await dbAll(q))[0] ?? null;

    const [tenantFails, securityHigh, aiErrors, openCases, recentLogins] = await Promise.all([
      dbOne(sql`
        SELECT COUNT(*)::int AS n FROM tenant_audit_logs
        WHERE resolved = false AND created_at > NOW() - INTERVAL '1 hour'
      `).catch(() => null),
      dbOne(sql`
        SELECT COUNT(*)::int AS n FROM ct_security_events
        WHERE severity IN ('HIGH','CRITICAL') AND created_at > NOW() - INTERVAL '1 hour'
      `).catch(() => null),
      dbOne(sql`
        SELECT COUNT(*)::int AS n FROM audit_logs
        WHERE action ILIKE '%error%' AND created_at > NOW() - INTERVAL '1 hour'
      `).catch(() => null),
      dbOne(sql`SELECT COUNT(*)::int AS n FROM cases WHERE status NOT IN ('closed','archived')`).catch(() => null),
      dbOne(sql`SELECT COUNT(*)::int AS n FROM login_logs WHERE created_at > NOW() - INTERVAL '24 hours'`).catch(() => null),
    ]);

    const tf  = tenantFails?.n  ?? 0;
    const sh  = securityHigh?.n ?? 0;
    const ae  = aiErrors?.n     ?? 0;
    const { getSystemState } = await import("../../hardening/production.lock");
    const state = getSystemState();

    let score = 100;
    score -= Math.min(tf * 5,  30);   /* tenant failures  */
    score -= Math.min(sh * 10, 30);   /* security events  */
    score -= Math.min(ae * 2,  20);   /* AI errors        */
    if (state.aiLock) score -= 5;
    score = Math.max(0, Math.round(score));

    const level =
      score >= 90 ? "healthy"  :
      score >= 70 ? "stable"   :
      score >= 50 ? "warning"  : "critical";

    /* Anomaly alerts */
    const alerts: { type: string; level: string; message: string }[] = [];
    if (tf  > 5)  alerts.push({ type: "TENANT_ANOMALY",   level: "critical", message: `${tf} فشل في تحديد هوية المستأجر خلال آخر ساعة` });
    if (sh  > 3)  alerts.push({ type: "SECURITY_SPIKE",   level: "critical", message: `${sh} حادثة أمنية عالية الخطورة خلال آخر ساعة` });
    if (ae  > 10) alerts.push({ type: "AI_ERROR_SPIKE",   level: "warning",  message: `${ae} خطأ في طبقة AI خلال آخر ساعة` });

    res.json({
      score, level, alerts,
      breakdown: { tenantFailures: tf, securityEvents: sh, aiErrors: ae },
      activeCases: openCases?.n ?? 0,
      loginsToday:  recentLogins?.n ?? 0,
      aiLocked: state.aiLock,
      systemMode: state.mode,
      ts: Date.now(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* GET /control-tower/anomalies — live anomaly feed */
router.get("/control-tower/anomalies", ctGuard, async (_req, res) => {
  try {
    const dbAll = async (q: any): Promise<any[]> => {
      const r = await db.execute(q) as any;
      return Array.isArray(r) ? r : (r?.rows ?? []);
    };
    const [tenantFails, rbacDenials, securityEvents] = await Promise.all([
      dbAll(sql`
        SELECT user_id, tenant_id, steps, created_at FROM tenant_audit_logs
        WHERE resolved = false AND created_at > NOW() - INTERVAL '6 hours'
        ORDER BY created_at DESC LIMIT 20
      `).catch(() => []),
      dbAll(sql`
        SELECT al.user_id, al.action, al.resource, al.created_at
        FROM audit_logs al
        WHERE al.action ILIKE '%denied%' OR al.action ILIKE '%forbidden%'
        ORDER BY al.created_at DESC LIMIT 20
      `).catch(() => []),
      dbAll(sql`
        SELECT * FROM ct_security_events
        WHERE created_at > NOW() - INTERVAL '6 hours'
        ORDER BY created_at DESC LIMIT 20
      `).catch(() => []),
    ]);
    res.json({ tenantFails, rbacDenials, securityEvents });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /control-tower/aol/clear-caches — flush all tenant caches */
router.post("/control-tower/aol/clear-caches", ctGuard, async (_req, res) => {
  const g = governanceGuard({ type: "CACHE_FLUSH", source: "TOWER" });
  if (!g.allowed) return res.status(409).json({ error: "GOVERNANCE_BLOCK", reason: g.reason });
  try {
    const { invalidateTenantCache } = await import("../../middlewares/tenantMiddleware");
    /* Clear all users from tenant cache by getting distinct user_ids */
    const { db: _db } = await import("@workspace/db");
    const r = await _db.execute(sql`SELECT DISTINCT user_id FROM office_members WHERE status='active'`) as any;
    const users: string[] = (Array.isArray(r) ? r : (r?.rows ?? [])).map((u: any) => u.user_id);
    users.forEach(uid => invalidateTenantCache(uid));
    res.json({ success: true, clearedUsers: users.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /control-tower/aol/auto-heal — heal all unresolved tenants */
router.post("/control-tower/aol/auto-heal", ctGuard, async (_req, res) => {
  const g = governanceGuard({ type: "TENANT_REPAIR", source: "TOWER" });
  if (!g.allowed) return res.status(409).json({ error: "GOVERNANCE_BLOCK", reason: g.reason });
  try {
    const { resolveTenantWithTrace } = await import("../../core/tenant/tenantResolver");
    const { db: _db } = await import("@workspace/db");
    const r = await _db.execute(sql`
      SELECT DISTINCT user_id FROM tenant_audit_logs
      WHERE resolved = false
        AND NOT EXISTS (SELECT 1 FROM office_members om WHERE om.user_id = tenant_audit_logs.user_id AND om.status = 'active')
      LIMIT 50
    `) as any;
    const users: string[] = (Array.isArray(r) ? r : (r?.rows ?? [])).map((u: any) => u.user_id);
    let healed = 0;
    await Promise.allSettled(users.map(async uid => {
      try { await resolveTenantWithTrace(uid); healed++; } catch { }
    }));
    res.json({ success: true, attempted: users.length, healed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /control-tower/aol/switch-ai-model — toggle AI to lighter model */
router.post("/control-tower/aol/switch-ai-model", ctGuard, async (req, res) => {
  const g = governanceGuard({ type: "AI_SWITCH", source: "TOWER" });
  if (!g.allowed) return res.status(409).json({ error: "GOVERNANCE_BLOCK", reason: g.reason });
  const { model } = req.body ?? {};
  /* Store preference in system state — callAI() reads this */
  process.env.PREFERRED_AI_MODEL = model ?? "gemini-2.0-flash";
  await db.execute(sql`
    INSERT INTO ct_security_events (event_type, severity, message)
    VALUES ('AOL_AI_MODEL_SWITCH', 'LOW', ${'النموذج تم تبديله إلى: ' + (model ?? "gemini-2.0-flash")})
  `).catch(() => {});
  res.json({ success: true, activeModel: process.env.PREFERRED_AI_MODEL });
});

/* POST /control-tower/aol/strict-mode — toggle strict tenant mode */
router.post("/control-tower/aol/strict-mode", ctGuard, async (req, res) => {
  const g = governanceGuard({ type: "STRICT_MODE_TOGGLE", source: "TOWER" });
  if (!g.allowed) return res.status(409).json({ error: "GOVERNANCE_BLOCK", reason: g.reason });
  const { enable } = req.body ?? {};
  process.env.STRICT_TENANT_MODE = enable ? "1" : "0";
  await db.execute(sql`
    INSERT INTO ct_security_events (event_type, severity, message)
    VALUES ('AOL_STRICT_MODE', 'MEDIUM', ${enable ? 'تم تفعيل Strict Tenant Mode' : 'تم إلغاء Strict Tenant Mode'})
  `).catch(() => {});
  res.json({ success: true, strictMode: enable });
});

export default router;
