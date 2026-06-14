/**
 * Platform Command Center (PCC) — Real-time SaaS Operations Console
 * لوحة القيادة اللحظية — مركز عمليات المنصة
 *
 * Guards: isSuperAdmin only (platform owner)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as os from "os";
import { getAuth, createClerkClient } from "@clerk/express";

const router = Router();
export default router;

/* ── helpers ── */
function sqlRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
async function q(query: any): Promise<any[]> {
  try { return sqlRows(await db.execute(query)); } catch { return []; }
}

let _clerk: any = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

async function isSuperAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  if (!auth?.userId) return false;
  try {
    const user = await getClerk().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const meta = user.publicMetadata as any;
    const owner = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    return (!!owner && email === owner) || meta?.role === "super_admin";
  } catch { return false; }
}

async function pccOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req)))
    return res.status(403).json({ error: "غير مصرح — مركز القيادة لمالك المنصة فقط" });
  next();
}

/* ── Ensure tables ── */
(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pcc_command_log (
        id          BIGSERIAL PRIMARY KEY,
        command     TEXT NOT NULL,
        result      JSONB,
        user_id     TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch {}
})();

/* ══════════════════════════════════════════════════
   1. SYSTEM HEALTH  — GET /pcc/system-health
══════════════════════════════════════════════════ */
router.get("/pcc/system-health", pccOnly, async (_req, res) => {
  try {
    const mem   = process.memoryUsage();
    const total = os.totalmem();
    const free  = os.freemem();
    const load  = os.loadavg();
    const cpus  = os.cpus();

    const start  = Date.now();
    const dbRows = await q(sql`SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'public'`);
    const dbLatencyMs = Date.now() - start;
    const tableCount  = Number(dbRows[0]?.cnt ?? 0);

    const [officeCount] = await q(sql`SELECT COUNT(*) AS cnt FROM offices`);
    const [userCount]   = await q(sql`SELECT COUNT(*) AS cnt FROM users`);
    const [caseCount]   = await q(sql`SELECT COUNT(*) AS cnt FROM cases WHERE status NOT IN ('closed','archived')`);
    const [invCount]    = await q(sql`SELECT COUNT(*) AS cnt FROM client_invoices WHERE status = 'unpaid'`);

    res.json({
      timestamp: new Date().toISOString(),
      process: {
        uptime:    Math.round(process.uptime()),
        pid:       process.pid,
        nodeVersion: process.version,
        heapUsedMB:  Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB:       Math.round(mem.rss / 1024 / 1024),
      },
      os: {
        platform:    os.platform(),
        arch:        os.arch(),
        cpuCount:    cpus.length,
        cpuModel:    cpus[0]?.model ?? "unknown",
        loadAvg1m:   Math.round(load[0] * 100) / 100,
        loadAvg5m:   Math.round(load[1] * 100) / 100,
        totalRamMB:  Math.round(total / 1024 / 1024),
        freeRamMB:   Math.round(free / 1024 / 1024),
        usedRamPct:  Math.round((1 - free / total) * 100),
      },
      db: {
        latencyMs:  dbLatencyMs,
        tableCount,
        status:     dbLatencyMs < 200 ? "healthy" : dbLatencyMs < 500 ? "slow" : "critical",
      },
      platform: {
        offices:        Number(officeCount?.cnt ?? 0),
        activeCases:    Number(caseCount?.cnt ?? 0),
        users:          Number(userCount?.cnt ?? 0),
        unpaidInvoices: Number(invCount?.cnt ?? 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   2. TENANT MATRIX  — GET /pcc/tenant-matrix
══════════════════════════════════════════════════ */
router.get("/pcc/tenant-matrix", pccOnly, async (_req, res) => {
  try {
    const offices = await q(sql`
      SELECT
        o.id, o.name, o.slug, o.subscription_plan, o.status, o.created_at,
        COUNT(DISTINCT c.id)                                         AS cases_count,
        COUNT(DISTINCT cl.id)                                        AS clients_count,
        COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'paid'), 0)    AS revenue,
        COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'unpaid'), 0)  AS outstanding,
        COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'overdue')             AS overdue_invoices,
        MAX(c.updated_at)                                            AS last_activity
      FROM offices o
      LEFT JOIN cases            c  ON c.office_id = o.id
      LEFT JOIN clients          cl ON cl.office_id = o.id
      LEFT JOIN client_invoices  i  ON i.office_id = o.id
      GROUP BY o.id, o.name, o.slug, o.subscription_plan, o.status, o.created_at
      ORDER BY revenue DESC
      LIMIT 200
    `);

    const aiUsage = await q(sql`
      SELECT office_id, COUNT(*) AS ai_calls, SUM(credits_used) AS ai_credits
      FROM ai_credit_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY office_id
    `).catch(() => []);
    const aiMap: Record<string, any> = {};
    for (const r of aiUsage) aiMap[r.office_id] = r;

    const matrix = offices.map((o: any) => {
      const rev  = Number(o.revenue ?? 0);
      const out  = Number(o.outstanding ?? 0);
      const od   = Number(o.overdue_invoices ?? 0);
      const ai   = aiMap[o.id];
      const last = o.last_activity ? new Date(o.last_activity).getTime() : 0;
      const daysSince = last ? Math.round((Date.now() - last) / 86400000) : 999;

      let healthScore = 100;
      if (od > 0) healthScore -= Math.min(od * 10, 40);
      if (daysSince > 30) healthScore -= 20;
      if (daysSince > 60) healthScore -= 20;
      if (out > rev * 0.5 && rev > 0) healthScore -= 15;
      if (o.status === "suspended") healthScore = 0;
      healthScore = Math.max(0, healthScore);

      const risk = healthScore >= 80 ? "low" : healthScore >= 50 ? "medium" : "high";

      return {
        id:          o.id,
        name:        o.name,
        slug:        o.slug,
        plan:        o.subscription_plan ?? "free",
        status:      o.status ?? "active",
        casesCount:  Number(o.cases_count ?? 0),
        clientsCount:Number(o.clients_count ?? 0),
        revenue:     rev,
        outstanding: out,
        overdueInvoices: od,
        aiCalls:     Number(ai?.ai_calls ?? 0),
        aiCredits:   Number(ai?.ai_credits ?? 0),
        daysSinceActivity: daysSince,
        healthScore,
        risk,
        createdAt:   o.created_at,
      };
    });

    const summary = {
      total:     matrix.length,
      healthy:   matrix.filter((m: any) => m.risk === "low").length,
      atRisk:    matrix.filter((m: any) => m.risk === "medium").length,
      critical:  matrix.filter((m: any) => m.risk === "high").length,
      totalRevenue: matrix.reduce((s: number, m: any) => s + m.revenue, 0),
    };

    res.json({ offices: matrix, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   3. EVENT STREAM  — GET /pcc/event-stream
══════════════════════════════════════════════════ */
router.get("/pcc/event-stream", pccOnly, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const auditEvents = await q(sql`
      SELECT
        'audit' AS source, id::text, action AS type, resource, resource_id,
        user_full_name AS actor, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ${limit / 2}
    `).catch(() => []);

    const aiEvents = await q(sql`
      SELECT
        'ai_event' AS source, id::text, type, 'platform' AS resource,
        NULL AS resource_id, 'AI Engine' AS actor,
        json_build_object('severity', severity, 'body', body) AS details,
        created_at
      FROM ai_events
      ORDER BY created_at DESC
      LIMIT ${limit / 2}
    `).catch(() => []);

    const combined = [...auditEvents, ...aiEvents]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    res.json({ events: combined, total: combined.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   4. AI OPS  — GET /pcc/ai-ops
══════════════════════════════════════════════════ */
router.get("/pcc/ai-ops", pccOnly, async (_req, res) => {
  try {
    const byOffice = await q(sql`
      SELECT
        l.office_id, o.name AS office_name, l.model,
        COUNT(*) AS calls, SUM(l.credits_used) AS credits
      FROM ai_credit_log l
      LEFT JOIN offices o ON o.id = l.office_id
      WHERE l.created_at > NOW() - INTERVAL '30 days'
      GROUP BY l.office_id, o.name, l.model
      ORDER BY credits DESC
      LIMIT 100
    `).catch(() => []);

    const byModel = await q(sql`
      SELECT model, COUNT(*) AS calls, SUM(credits_used) AS credits
      FROM ai_credit_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY model
      ORDER BY calls DESC
    `).catch(() => []);

    const dailyTrend = await q(sql`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        COUNT(*) AS calls,
        SUM(credits_used) AS credits
      FROM ai_credit_log
      WHERE created_at > NOW() - INTERVAL '14 days'
      GROUP BY 1
      ORDER BY 1
    `).catch(() => []);

    const [totals] = await q(sql`
      SELECT COUNT(*) AS total_calls, SUM(credits_used) AS total_credits
      FROM ai_credit_log
      WHERE created_at > NOW() - INTERVAL '30 days'
    `).catch(() => [{}]);

    res.json({
      byOffice,
      byModel,
      dailyTrend,
      totals: {
        calls:   Number(totals?.total_calls ?? 0),
        credits: Number(totals?.total_credits ?? 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
