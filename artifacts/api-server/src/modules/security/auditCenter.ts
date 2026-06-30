import { Router } from "express";
import { requireSuperAdmin, requireAuth } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();
const saGuard = requireSuperAdmin;

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_coverage_rules (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource    TEXT NOT NULL UNIQUE,
        actions     TEXT[] DEFAULT '{}',
        risk_level  TEXT DEFAULT 'medium',
        enabled     BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS audit_risk_scores (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL,
        office_id   TEXT,
        score       INTEGER DEFAULT 0,
        factors     JSONB DEFAULT '[]',
        computed_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource   ON audit_logs(resource);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_office_id  ON audit_logs(office_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
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
  return (await safeQuery(q))[0] ?? null;
}

/* ── Phase 2: Enterprise Audit Center ─────────────────────────────────── */

router.get("/audit-center/overview", saGuard, async (_req, res) => {
  try {
    const [total, today, byResource, byAction, byRisk, topUsers, timeline] = await Promise.all([
      safeOne(sql`SELECT COUNT(*) as count FROM audit_logs`),
      safeOne(sql`SELECT COUNT(*) as count FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'`),
      safeQuery(sql`SELECT resource, COUNT(*) as count FROM audit_logs GROUP BY resource ORDER BY count DESC LIMIT 20`),
      safeQuery(sql`SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC LIMIT 20`),
      safeQuery(sql`SELECT risk_level, COUNT(*) as count FROM audit_logs WHERE risk_level IS NOT NULL GROUP BY risk_level`),
      safeQuery(sql`
        SELECT user_id, user_full_name, COUNT(*) as actions, MAX(created_at) as last_action
        FROM audit_logs WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY user_id, user_full_name ORDER BY actions DESC LIMIT 10
      `),
      safeQuery(sql`
        SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as count
        FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', created_at) ORDER BY hour
      `),
    ]);

    const coverageResources = [
      "cases","clients","contracts","documents","experts","bankruptcy",
      "finance","invoices","subscriptions","payments","users","permissions",
      "roles","ai_operations","settings","api_keys","integrations"
    ];
    const coveredResources = byResource.map((r: any) => r.resource);
    const coverage = coverageResources.filter(r => coveredResources.includes(r)).length;

    res.json({
      total: Number(total?.count ?? 0),
      today: Number(today?.count ?? 0),
      byResource,
      byAction,
      byRisk,
      topUsers,
      timeline,
      coverage: Math.round((coverage / coverageResources.length) * 100),
      coverageDetails: coverageResources.map(r => ({ resource: r, covered: coveredResources.includes(r) })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audit-center/logs", saGuard, async (req, res) => {
  try {
    const {
      resource, action, userId, officeId, riskLevel,
      startDate, endDate, search,
      page = 1, limit = 50
    } = req.query as any;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (resource) { params.push(resource); conditions.push(`resource = $${params.length}`); }
    if (action)   { params.push(action);   conditions.push(`action = $${params.length}`); }
    if (userId)   { params.push(userId);   conditions.push(`user_id = $${params.length}`); }
    if (officeId) { params.push(officeId); conditions.push(`office_id = $${params.length}`); }
    if (riskLevel){ params.push(riskLevel);conditions.push(`risk_level = $${params.length}`); }
    if (startDate){ params.push(startDate);conditions.push(`created_at >= $${params.length}`); }
    if (endDate)  { params.push(endDate);  conditions.push(`created_at <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(action ILIKE $${params.length} OR resource ILIKE $${params.length} OR user_full_name ILIKE $${params.length} OR details ILIKE $${params.length})`);
    }

    const where = conditions.join(" AND ");
    params.push(Number(limit), offset);

    const [rows, countRow] = await Promise.all([
      safeQuery(sql`
        SELECT id, user_id, user_full_name, office_id, action, resource, resource_id,
               details, ip_address, user_agent, risk_level, old_value, new_value,
               request_id, correlation_id, created_at
        FROM audit_logs ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}
      `),
      safeOne(sql`SELECT COUNT(*) as count FROM audit_logs`),
    ]);

    res.json({
      logs: rows,
      total: Number(countRow?.count ?? 0),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audit-center/logs/:id", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const row = await safeOne(sql`SELECT * FROM audit_logs WHERE id=${id}`);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audit-center/user-timeline/:userId", saGuard, async (req, res) => {
  try {
    const { userId } = req.params as any;
    const rows = await safeQuery(sql`
      SELECT * FROM audit_logs WHERE user_id=${userId}
      ORDER BY created_at DESC LIMIT 200
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audit-center/resource-history/:resource/:resourceId", saGuard, async (req, res) => {
  try {
    const { resource, resourceId } = req.params as any;
    const rows = await safeQuery(sql`
      SELECT * FROM audit_logs WHERE resource=${resource} AND resource_id=${resourceId}
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audit-center/risk-analysis", saGuard, async (_req, res) => {
  try {
    const [highRisk, deletions, permChanges, saAccess, aiOps] = await Promise.all([
      safeQuery(sql`
        SELECT user_id, user_full_name, COUNT(*) as count, MAX(created_at) as last
        FROM audit_logs WHERE risk_level IN ('high','critical') AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY user_id, user_full_name ORDER BY count DESC LIMIT 20
      `),
      safeQuery(sql`
        SELECT user_id, user_full_name, COUNT(*) as count, MAX(created_at) as last
        FROM audit_logs WHERE action ILIKE '%DELETE%' AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY user_id, user_full_name ORDER BY count DESC LIMIT 20
      `),
      safeQuery(sql`
        SELECT * FROM audit_logs WHERE resource IN ('permissions','roles','users')
        AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 50
      `),
      safeQuery(sql`
        SELECT * FROM audit_logs WHERE action LIKE 'SA_%'
        ORDER BY created_at DESC LIMIT 50
      `),
      safeQuery(sql`
        SELECT * FROM audit_logs WHERE resource ILIKE '%ai%' OR action ILIKE '%AI%'
        ORDER BY created_at DESC LIMIT 50
      `),
    ]);
    res.json({ highRisk, deletions, permChanges, saAccess, aiOps });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audit-center/export", saGuard, async (req, res) => {
  try {
    const { format = "json", resource, startDate, endDate } = req.query as any;
    const meta = auditMeta(req);
    const rows = await safeQuery(sql`
      SELECT * FROM audit_logs
      WHERE (${resource} IS NULL OR resource=${resource ?? null})
      ORDER BY created_at DESC LIMIT 5000
    `);
    await auditLog({ ...meta, action: "AUDIT_EXPORT", resource: "audit_logs", details: `Exported ${rows.length} records` });
    res.json({ data: rows, count: rows.length, exportedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/audit-center/coverage", saGuard, async (_req, res) => {
  const resources = await safeQuery(sql`SELECT DISTINCT resource, COUNT(*) as count FROM audit_logs GROUP BY resource ORDER BY count DESC`);
  const actions   = await safeQuery(sql`SELECT DISTINCT action,   COUNT(*) as count FROM audit_logs GROUP BY action   ORDER BY count DESC`);
  const required  = [
    "cases","clients","contracts","documents","experts","bankruptcy",
    "finance","invoices","subscriptions","payments","users","permissions",
    "roles","ai_operations","settings","api_keys","integrations"
  ];
  const covered = resources.map((r: any) => r.resource);
  const missing = required.filter(r => !covered.includes(r));
  const pct = Math.round(((required.length - missing.length) / required.length) * 100);
  res.json({ resources, actions, required, covered, missing, coveragePercent: pct });
});

export default router;
