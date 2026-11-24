/**
 * Validation Pipeline — خط التحقق قبل النشر
 * ───────────────────────────────────────────
 * يُشغّل مجموعة فحوصات ويُعيد: pass | fail
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runFinancialGuard } from "./financial.guard";

export interface PipelineCheck {
  id:      string;
  name:    string;
  status:  "pass" | "fail" | "warn";
  detail:  string;
  durationMs: number;
}

export interface PipelineResult {
  passed:        boolean;
  score:         number;
  checks:        PipelineCheck[];
  deployAllowed: boolean;
  runAt:         string;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = Date.now();
  const v = await fn();
  return [v, Date.now() - t];
}

export async function runValidationPipeline(): Promise<PipelineResult> {
  const checks: PipelineCheck[] = [];

  /* ── 1. DB connectivity ── */
  const [dbOk, dbMs] = await timed(async () => {
    try { await db.execute(sql`SELECT 1`); return true; } catch { return false; }
  });
  checks.push({ id: "db_health", name: "قاعدة البيانات متاحة", status: dbOk ? "pass" : "fail", detail: dbOk ? "اتصال ناجح" : "فشل الاتصال بالـ DB", durationMs: dbMs });

  /* ── 2. RLS Coverage ── */
  const [rlsCoverage, rlsMs] = await timed(async () => {
    try {
      const r = await db.execute(sql`
        SELECT
          COUNT(CASE WHEN rowsecurity THEN 1 END)::int AS enabled,
          COUNT(*)::int AS total
        FROM pg_tables WHERE schemaname = 'public'
      `);
      const row = ((r.rows ?? r) as any[])[0];
      return { enabled: Number(row?.enabled ?? 0), total: Number(row?.total ?? 0) };
    } catch { return { enabled: 0, total: 0 }; }
  });
  const rlsPct = rlsCoverage.total > 0 ? Math.round(rlsCoverage.enabled / rlsCoverage.total * 100) : 0;
  checks.push({
    id: "rls_coverage", name: "تغطية RLS للجداول",
    status: rlsPct >= 30 ? "pass" : "warn",
    detail: `${rlsCoverage.enabled}/${rlsCoverage.total} جدول (${rlsPct}%)`,
    durationMs: rlsMs,
  });

  /* ── 3. Financial Guard ── */
  const [finReport, finMs] = await timed(() => runFinancialGuard());
  const finFails = finReport.checks.filter(c => c.status === "fail").length;
  checks.push({
    id: "financial_integrity", name: "سلامة البيانات المالية",
    status: finFails === 0 ? "pass" : "fail",
    detail: finFails === 0 ? `كل الفحوصات ناجحة (${finReport.score}/100)` : `${finFails} فحص فاشل — score: ${finReport.score}`,
    durationMs: finMs,
  });

  /* ── 4. No orphan cases ── */
  const [orphanCases, ocMs] = await timed(async () => {
    try {
      const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM cases WHERE office_id IS NULL`);
      return Number(((r.rows ?? r) as any[])[0]?.n ?? 0);
    } catch { return 0; }
  });
  checks.push({
    id: "case_tenant_scope", name: "كل القضايا مرتبطة بمكتب",
    status: orphanCases === 0 ? "pass" : "fail",
    detail: orphanCases === 0 ? "لا قضايا يتيمة" : `${orphanCases} قضية بدون office_id`,
    durationMs: ocMs,
  });

  /* ── 5. Hardening state ── */
  const [stateOk, stMs] = await timed(async () => {
    try {
      const r = await db.execute(sql`SELECT mode FROM hardening_state WHERE is_active = true LIMIT 1`);
      return ((r.rows ?? r) as any[])[0]?.mode ?? "unknown";
    } catch { return "unknown"; }
  });
  checks.push({
    id: "hardening_active", name: "حالة نظام القفل",
    status: stateOk !== "unknown" ? "pass" : "warn",
    detail: `النظام في وضع: ${stateOk}`,
    durationMs: stMs,
  });

  /* ── Score ── */
  const failCount = checks.filter(c => c.status === "fail").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const score     = Math.max(0, 100 - failCount * 20 - warnCount * 5);
  const passed    = failCount === 0;

  return {
    passed,
    score,
    checks,
    deployAllowed: passed && score >= 70,
    runAt:         new Date().toISOString(),
  };
}
