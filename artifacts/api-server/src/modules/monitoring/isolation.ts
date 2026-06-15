/**
 * Isolation Routes — 7 endpoints (super_admin only)
 */
import { Router, type Request, type Response } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { getLeakEvents, getIsolationStats, detectLeak } from "../../isolation/tenant.scope";
import { runIsolationAudit } from "../../isolation/isolation.audit";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function guard(req: any, res: any, next: any) {
  const meta = req.auth?.sessionClaims?.publicMetadata as any;
  if (meta?.role !== "super_admin") return res.status(403).json({ error: "super_admin only" });
  next();
}

/* ── GET /isolation/rls-status ── حالة RLS لكل جدول ── */
router.get("/isolation/rls-status", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        t.tablename,
        t.rowsecurity AS rls_enabled,
        COUNT(p.policyname) AS policy_count,
        c.column_name IS NOT NULL AS has_office_id
      FROM pg_tables t
      LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
      LEFT JOIN information_schema.columns c
        ON c.table_name = t.tablename
        AND c.table_schema = 'public'
        AND c.column_name IN ('office_id', 'tenant_id')
      WHERE t.schemaname = 'public'
      GROUP BY t.tablename, t.rowsecurity, c.column_name
      ORDER BY t.rowsecurity DESC, t.tablename ASC
    `);

    const tables = (rows.rows ?? rows) as any[];
    const withOfficeId   = tables.filter(t => t.has_office_id);
    const rlsEnabled     = withOfficeId.filter(t => t.rls_enabled);
    const rlsMissing     = withOfficeId.filter(t => !t.rls_enabled);
    const coveragePct    = withOfficeId.length > 0
      ? Math.round((rlsEnabled.length / withOfficeId.length) * 100)
      : 100;

    res.json({
      tables,
      summary: {
        totalTables:    tables.length,
        withTenantKey:  withOfficeId.length,
        rlsEnabled:     rlsEnabled.length,
        rlsMissing:     rlsMissing.length,
        coveragePct,
      },
      missing: rlsMissing.map(t => t.tablename),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /isolation/audit ── فحص الكود ── */
router.get("/isolation/audit", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const result = await runIsolationAudit();
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /isolation/leak-log ── سجل التسربات ── */
router.get("/isolation/leak-log", requireAuthWithTenant, guard, (_req, res) => {
  const limit = Math.min(Number(_req.query.limit) || 50, 200);
  res.json({ events: getLeakEvents(limit), stats: getIsolationStats() });
});

/* ── GET /isolation/stats ── إحصائيات ── */
router.get("/isolation/stats", requireAuthWithTenant, guard, (_req, res) => {
  res.json(getIsolationStats());
});

/* ── POST /isolation/test ── اختبار العزل ── */
router.post("/isolation/test", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const tenantId    = (req as any).tenantId ?? "default";
    const targetTable = (req.body?.table as string) || "cases";
    const allowedTables = ["cases","clients","revenues","expenses","tasks","documents"];
    if (!allowedTables.includes(targetTable)) {
      return res.status(400).json({ error: "جدول غير مسموح به للاختبار" });
    }

    /* محاولة قراءة بيانات مكتب مختلف (يجب أن يُرفض بـ RLS) */
    const rows = await db.execute(sql`
      SELECT office_id FROM ${sql.raw(targetTable)} LIMIT 10
    `);
    const results = (rows.rows ?? rows) as any[];

    /* كشف التسرب */
    const { clean, foreignTenants } = detectLeak(results, tenantId, { path: "/isolation/test", method: "POST" });

    res.json({
      table:          targetTable,
      tenantId,
      rowsReturned:   results.length,
      isolationClean: clean,
      foreignTenants,
      message:        clean
        ? "✅ العزل يعمل — لا بيانات من مكاتب أخرى"
        : `⚠️ وُجدت بيانات من: ${foreignTenants.join(", ")}`,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── POST /isolation/enable-rls ── تفعيل RLS يدوياً ── */
router.post("/isolation/enable-rls", requireAuthWithTenant, guard, async (req, res) => {
  try {
    const table = req.body?.table as string;
    if (!table || !/^[a-z_]+$/.test(table)) {
      return res.status(400).json({ error: "اسم جدول غير صالح" });
    }

    /* تحقق من وجود office_id */
    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = ${table} AND table_schema = 'public'
        AND column_name IN ('office_id', 'tenant_id')
      LIMIT 1
    `);
    const col = ((colCheck.rows ?? colCheck) as any[])[0]?.column_name;
    if (!col) return res.status(400).json({ error: "الجدول لا يحتوي office_id" });

    await db.execute(sql`ALTER TABLE ${sql.raw(table)} ENABLE ROW LEVEL SECURITY`);
    await db.execute(sql`DROP POLICY IF EXISTS ${sql.raw(`rls_${table}`)} ON ${sql.raw(table)}`);
    await db.execute(sql`
      CREATE POLICY ${sql.raw(`rls_${table}`)} ON ${sql.raw(table)}
      USING (
        ${sql.raw(col)}::text = current_setting('app.current_tenant', true)
        OR coalesce(current_setting('app.current_tenant', true), '') = ''
        OR current_setting('app.bypass_rls', true) = 'on'
      )
    `);

    res.json({ ok: true, table, policy: `rls_${table}`, column: col });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── GET /isolation/summary ── ملخص كامل ── */
router.get("/isolation/summary", requireAuthWithTenant, guard, async (_req, res) => {
  try {
    const [rlsRow, leakStats, auditResult] = await Promise.all([
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public') AS total_tables,
          (SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true) AS rls_tables,
          (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema='public' AND column_name IN ('office_id','tenant_id')) AS tenant_columns
      `),
      Promise.resolve(getIsolationStats()),
      runIsolationAudit(),
    ]);

    const rls = ((rlsRow.rows ?? rlsRow) as any[])[0] ?? {};
    const rlsCoverage = rls.rls_tables > 0
      ? Math.round((Number(rls.rls_tables) / Math.max(Number(rls.tenant_columns), 1)) * 100)
      : 0;

    const isolationScore = Math.round(
      rlsCoverage * 0.5 +
      auditResult.summary.overallScore * 0.3 +
      (leakStats.leakCount === 0 ? 100 : Math.max(0, 100 - leakStats.leakCount * 5)) * 0.2
    );

    res.json({
      isolationScore,
      rls: {
        totalTables:  Number(rls.total_tables ?? 0),
        rlsTables:    Number(rls.rls_tables   ?? 0),
        coverage:     rlsCoverage,
      },
      code:    { overallScore: auditResult.summary.overallScore, ...auditResult.summary },
      runtime: leakStats,
      grade:   isolationScore >= 90 ? "A" : isolationScore >= 75 ? "B" : isolationScore >= 60 ? "C" : "D",
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
