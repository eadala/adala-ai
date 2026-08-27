/**
 * Isolation Routes — 7 endpoints (super_admin only)
 * rls_* policies owned by Migration 057 — readiness / verification only (no Runtime DDL).
 */
import { Router, type Request } from "express";
import { requireSuperAdmin} from "../../middlewares/requireAuth";
import { getLeakEvents, getIsolationStats, detectLeak } from "../../isolation/tenant.scope";
import { runIsolationAudit } from "../../isolation/isolation.audit";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

type PgRow = Record<string, unknown>;
type TenantRequest = Request & { tenantId?: string };

function pgRows(result: unknown): PgRow[] {
  if (Array.isArray(result)) return result as PgRow[];
  return (result as { rows?: PgRow[] }).rows ?? [];
}

function pgFirstRow(result: unknown): PgRow {
  return pgRows(result)[0] ?? {};
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isolationPolicyName(table: string) {
  return `rls_${table}`;
}

/** Verify Migration 057 rls_* readiness for a tenant-keyed table (no DDL). */
async function verifyIsolationRlsReadiness(
  table: string,
  tenantCol: string,
): Promise<{ ready: boolean; ownedBy056?: boolean; error?: string }> {
  const owned = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = ${table}
        AND (
          p.policyname = 'vault_tenant_isolation'
          OR p.policyname = ${`zta_tenant_isolation_${table}`}
        )
    ) AS owned_by_056
  `);
  const ownedRow = pgFirstRow(owned);
  if (ownedRow.owned_by_056) {
    return { ready: true, ownedBy056: true };
  }

  const status = await db.execute(sql`
    SELECT
      c.relrowsecurity AS rls_enabled,
      p.qual AS policy_qual
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_policies p
      ON p.schemaname = 'public'
     AND p.tablename = ${table}
     AND p.policyname = ${isolationPolicyName(table)}
    WHERE n.nspname = 'public' AND c.relname = ${table}
  `);
  const row = pgFirstRow(status);

  if (!row.rls_enabled) {
    return { ready: false, error: "RLS not enabled — apply Migration 057" };
  }
  if (!row.policy_qual) {
    return { ready: false, error: `${isolationPolicyName(table)} missing — apply Migration 057` };
  }

  const qual = String(row.policy_qual);
  if (
    !qual.includes(tenantCol)
    || !/current_setting/i.test(qual)
    || !/coalesce/i.test(qual)
    || !/bypass_rls/i.test(qual)
  ) {
    return { ready: false, error: `${isolationPolicyName(table)} incompatible qual — manual review required` };
  }

  return { ready: true };
}

/* ── GET /isolation/rls-status ── حالة RLS لكل جدول ── */
router.get("/isolation/rls-status", requireSuperAdmin, async (_req, res) => {
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

    const tables = pgRows(rows);
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
  } catch (e: unknown) { res.status(500).json({ error: errMsg(e) }); }
});

/* ── GET /isolation/audit ── فحص الكود ── */
router.get("/isolation/audit", requireSuperAdmin, async (_req, res) => {
  try {
    const result = await runIsolationAudit();
    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: errMsg(e) }); }
});

/* ── GET /isolation/leak-log ── سجل التسربات ── */
router.get("/isolation/leak-log", requireSuperAdmin, (_req, res) => {
  const limit = Math.min(Number(_req.query.limit) || 50, 200);
  res.json({ events: getLeakEvents(limit), stats: getIsolationStats() });
});

/* ── GET /isolation/stats ── إحصائيات ── */
router.get("/isolation/stats", requireSuperAdmin, (_req, res) => {
  res.json(getIsolationStats());
});

/* ── POST /isolation/test ── اختبار العزل ── */
router.post("/isolation/test", requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = (req as TenantRequest).tenantId;
    if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const targetTable = (req.body?.table as string) || "cases";
    const allowedTables = ["cases","clients","revenues","expenses","tasks","documents"];
    if (!allowedTables.includes(targetTable)) {
      return res.status(400).json({ error: "جدول غير مسموح به للاختبار" });
    }

    /* محاولة قراءة بيانات مكتب مختلف (يجب أن يُرفض بـ RLS) */
    const rows = await db.execute(sql`
      SELECT office_id FROM ${sql.raw(targetTable)} LIMIT 10
    `);
    const results = pgRows(rows);

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
  } catch (e: unknown) { res.status(500).json({ error: errMsg(e) }); }
});

/* ── POST /isolation/enable-rls ── verify Migration 057 rls_* readiness ── */
router.post("/isolation/enable-rls", requireSuperAdmin, async (req, res) => {
  try {
    const table = req.body?.table as string;
    if (!table || !/^[a-z_]+$/.test(table)) {
      return res.status(400).json({ error: "اسم جدول غير صالح" });
    }

    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = ${table} AND table_schema = 'public'
        AND column_name IN ('office_id', 'tenant_id')
      ORDER BY CASE column_name WHEN 'office_id' THEN 0 ELSE 1 END
      LIMIT 1
    `);
    const col = pgFirstRow(colCheck).column_name as string | undefined;
    if (!col) return res.status(400).json({ error: "الجدول لا يحتوي office_id أو tenant_id" });

    const result = await verifyIsolationRlsReadiness(table, col);
    if (!result.ready) {
      return res.status(409).json({
        ok: false,
        table,
        policy: isolationPolicyName(table),
        column: col,
        error: result.error,
      });
    }

    res.json({
      ok: true,
      table,
      policy: result.ownedBy056 ? `zta/vault (Migration 056)` : isolationPolicyName(table),
      column: col,
      ownedBy056: result.ownedBy056 ?? false,
      message: result.ownedBy056
        ? "RLS owned by Migration 056 — no rls_* policy required"
        : "Migration 057 rls_* policy ready",
    });
  } catch (e: unknown) { res.status(500).json({ error: errMsg(e) }); }
});

/* ── GET /isolation/summary ── ملخص كامل ── */
router.get("/isolation/summary", requireSuperAdmin, async (_req, res) => {
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

    const rls = pgFirstRow(rlsRow);
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
      code:    { ...auditResult.summary },
      runtime: leakStats,
      grade:   isolationScore >= 90 ? "A" : isolationScore >= 75 ? "B" : isolationScore >= 60 ? "C" : "D",
    });
  } catch (e: unknown) { res.status(500).json({ error: errMsg(e) }); }
});

export default router;
