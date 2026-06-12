import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function sqlAll(q: any): Promise<Record<string, any>[]> {
  const r = await db.execute(q) as any;
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
async function sqlOne(q: any): Promise<Record<string, any>> {
  return (await sqlAll(q))[0] ?? {};
}
function num(v: any) { return parseFloat(String(v ?? "0")) || 0; }

/* ── Stats overview ── */
router.get("/audit-logs/stats", requireAuth, async (_req, res) => {
  try {
    const today = await sqlOne(sql`
      SELECT COUNT(*)::int AS total FROM audit_logs WHERE created_at >= CURRENT_DATE
    `);
    const users = await sqlOne(sql`
      SELECT COUNT(DISTINCT user_id)::int AS total FROM audit_logs WHERE created_at >= CURRENT_DATE
    `);
    const deletions = await sqlOne(sql`
      SELECT COUNT(*)::int AS total FROM audit_logs WHERE action = 'delete' AND created_at >= CURRENT_DATE
    `);
    const byAction = await sqlAll(sql`
      SELECT action, COUNT(*)::int AS count FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY action ORDER BY count DESC LIMIT 8
    `);
    const byResource = await sqlAll(sql`
      SELECT resource, COUNT(*)::int AS count FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY resource ORDER BY count DESC LIMIT 8
    `);
    const hourly = await sqlAll(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('hour', created_at), 'HH24:MI') AS hour,
        COUNT(*)::int AS count
      FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at) ORDER BY DATE_TRUNC('hour', created_at)
    `);
    const suspicious = await sqlAll(sql`
      SELECT user_id, user_full_name, COUNT(*)::int AS count
      FROM audit_logs
      WHERE action = 'delete' AND created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY user_id, user_full_name
      HAVING COUNT(*) >= 3
      ORDER BY count DESC
    `);

    res.json({
      todayTotal: num(today.total),
      todayUsers: num(users.total),
      todayDeletions: num(deletions.total),
      byAction,
      byResource,
      hourly,
      suspicious,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Paginated log list ── */
router.get("/audit-logs", requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit  = Math.min(100, parseInt(String(req.query.limit ?? "50")));
    const offset = (page - 1) * limit;
    const action   = String(req.query.action ?? "");
    const resource = String(req.query.resource ?? "");
    const from     = String(req.query.from ?? "");
    const to       = String(req.query.to ?? "");
    const search   = String(req.query.search ?? "");

    const rows = await sqlAll(sql`
      SELECT id, user_id, user_full_name, action, resource, resource_id, details, created_at
      FROM audit_logs
      WHERE 1=1
        ${action   ? sql`AND action = ${action}`     : sql``}
        ${resource ? sql`AND resource = ${resource}` : sql``}
        ${from     ? sql`AND created_at >= ${from}::timestamptz` : sql``}
        ${to       ? sql`AND created_at <= ${to}::timestamptz`   : sql``}
        ${search   ? sql`AND (user_full_name ILIKE ${'%' + search + '%'}
                           OR resource_id    ILIKE ${'%' + search + '%'})` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRow = await sqlOne(sql`
      SELECT COUNT(*)::int AS total FROM audit_logs
      WHERE 1=1
        ${action   ? sql`AND action = ${action}`     : sql``}
        ${resource ? sql`AND resource = ${resource}` : sql``}
        ${from     ? sql`AND created_at >= ${from}::timestamptz` : sql``}
        ${to       ? sql`AND created_at <= ${to}::timestamptz`   : sql``}
        ${search   ? sql`AND (user_full_name ILIKE ${'%' + search + '%'}
                           OR resource_id    ILIKE ${'%' + search + '%'})` : sql``}
    `);

    const total = num(countRow.total);
    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
