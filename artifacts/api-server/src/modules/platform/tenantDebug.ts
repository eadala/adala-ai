/**
 * Tenant Identity Debug API
 * ─────────────────────────
 * Super-admin only routes for inspecting and healing tenant identity.
 *
 * Routes:
 *   GET  /tenant/debug/:userId   — resolve + trace for a specific user
 *   GET  /tenant/audit           — last N audit log entries
 *   GET  /tenant/stats           — resolution stats (success rate, sources)
 *   GET  /tenant/unresolved      — users without office_members (problem list)
 *   POST /tenant/heal/:userId    — manually trigger auto-link for a user
 *   POST /tenant/invalidate/:userId — bust the 5-min cache for a user
 */

import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createClerkClient, getAuth } from "@clerk/express";
import { resolveTenantWithTrace } from "../../core/tenant/tenantResolver";
import { invalidateTenantCache } from "../../middlewares/tenantMiddleware";
import { recoverIdentity, getBindingHistory } from "../../core/tenant/tenantVersioning";

const router = Router();
const requireSA = requireSuperAdmin;

/* ── Super-admin guard ─────────────────────────────────────────────── */

async function dbAll(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function dbOne(q: any): Promise<any> {
  const rows = await dbAll(q);
  return rows[0] ?? null;
}

/* ── Ensure audit table exists ─────────────────────────────────────── */

async function ensureAuditTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_audit_logs (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id     TEXT NOT NULL,
      tenant_id   TEXT,
      source      TEXT NOT NULL,
      steps       JSONB NOT NULL DEFAULT '[]',
      resolved    BOOLEAN NOT NULL DEFAULT false,
      error_msg   TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_tenant_audit_user   ON tenant_audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_audit_time   ON tenant_audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tenant_audit_source ON tenant_audit_logs(source);
  `).catch(() => {});
}

/* ──────────────────────────────────────────────────────────────────── */

/* GET /tenant/debug/:userId — trace resolution for a user */
router.get("/developer/tenant/debug/:userId", requireSA, async (req, res) => {
  await ensureAuditTable();
  const userId = String(req.params.userId);
  try {
    const trace = await resolveTenantWithTrace(userId);
    res.json({ status: "resolved", ...trace });
  } catch (err: any) {
    res.json({
      status: "failed",
      error: err.message,
      steps: err.steps ?? [],
      userId,
    });
  }
});

/* GET /tenant/audit — last N audit log entries */
router.get("/developer/tenant/audit", requireSA, async (req, res) => {
  await ensureAuditTable();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const userId = req.query.userId ? String(req.query.userId) : null;
  const failedOnly = req.query.failed === "1";

  const rows = await dbAll(sql`
    SELECT id, user_id, tenant_id, source, steps, resolved, error_msg, ip_address, created_at
    FROM tenant_audit_logs
    WHERE
      (${userId} IS NULL OR user_id = ${userId})
      AND (${failedOnly ? 1 : 0} = 0 OR resolved = false)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  res.json(rows);
});

/* GET /tenant/stats — aggregate stats */
router.get("/developer/tenant/stats", requireSA, async (req, res) => {
  await ensureAuditTable();

  const [total, failed, sources, last24h] = await Promise.all([
    dbOne(sql`SELECT COUNT(*)::int AS n FROM tenant_audit_logs`),
    dbOne(sql`SELECT COUNT(*)::int AS n FROM tenant_audit_logs WHERE resolved = false`),
    dbAll(sql`
      SELECT source, COUNT(*)::int AS n
      FROM tenant_audit_logs
      GROUP BY source ORDER BY n DESC
    `),
    dbOne(sql`
      SELECT COUNT(*)::int AS n FROM tenant_audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `),
  ]);

  const totalN = total?.n ?? 0;
  const failedN = failed?.n ?? 0;
  res.json({
    total: totalN,
    failed: failedN,
    resolved: totalN - failedN,
    successRate: totalN ? Math.round(((totalN - failedN) / totalN) * 100) : 100,
    last24h: last24h?.n ?? 0,
    bySource: sources,
  });
});

/* GET /tenant/unresolved — users who have NO office_members entry */
router.get("/developer/tenant/unresolved", requireSA, async (req, res) => {
  const rows = await dbAll(sql`
    SELECT DISTINCT tal.user_id, MAX(tal.created_at) AS last_attempt, COUNT(*)::int AS attempts
    FROM tenant_audit_logs tal
    WHERE tal.resolved = false
      AND NOT EXISTS (
        SELECT 1 FROM office_members om WHERE om.user_id = tal.user_id AND om.status = 'active'
      )
    GROUP BY tal.user_id
    ORDER BY last_attempt DESC
    LIMIT 100
  `).catch(() => []);

  /* Also check onboarding_state users without office_members */
  const onboarding = await dbAll(sql`
    SELECT os.user_id, os.completed, os.step, os.office_id, os.created_at AS joined_at
    FROM onboarding_state os
    WHERE NOT EXISTS (
      SELECT 1 FROM office_members om WHERE om.user_id = os.user_id AND om.status = 'active'
    )
    ORDER BY os.created_at DESC
    LIMIT 100
  `).catch(() => []);

  res.json({ unresolvedFromLogs: rows, unresolvedFromOnboarding: onboarding });
});

/* POST /tenant/heal/:userId — manually trigger auto-link */
router.post("/developer/tenant/heal/:userId", requireSA, async (req, res) => {
  const userId = String(req.params.userId);
  invalidateTenantCache(userId);
  try {
    const trace = await resolveTenantWithTrace(userId);
    res.json({ success: true, trace });
  } catch (err: any) {
    res.json({ success: false, error: err.message, steps: err.steps ?? [] });
  }
});

/* POST /tenant/invalidate/:userId — bust cache */
router.post("/developer/tenant/invalidate/:userId", requireSA, async (req, res) => {
  const userId = String(req.params.userId);
  invalidateTenantCache(userId);
  res.json({ success: true, userId, message: "Cache invalidated" });
});

/* POST /developer/tenant/recover/:userId — disaster identity recovery */
router.post("/developer/tenant/recover/:userId", requireSA, async (req, res) => {
  const userId = String(req.params.userId);
  invalidateTenantCache(userId);
  try {
    const result = await recoverIdentity(userId);
    if (!result) return res.json({ success: false, error: "NO_RECOVERY_POINT — لا توجد نقطة استعادة سابقة" });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

/* GET /developer/tenant/binding-history/:userId — versioning history */
router.get("/developer/tenant/binding-history/:userId", requireSA, async (req, res) => {
  const userId = String(req.params.userId);
  const history = await getBindingHistory(userId);
  res.json(history);
});

/* GET /tenant/members-report — full office_members listing */
router.get("/developer/tenant/members-report", requireSA, async (req, res) => {
  const rows = await dbAll(sql`
    SELECT om.user_id, om.office_id, om.role, om.status, om.created_at,
           op.name AS office_name
    FROM office_members om
    LEFT JOIN office_page op ON op.id::text = om.office_id
    ORDER BY om.created_at DESC
    LIMIT 500
  `).catch(() => []);
  res.json(rows);
});

export default router;
