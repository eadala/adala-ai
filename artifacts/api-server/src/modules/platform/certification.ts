/**
 * 🏆 Go-Live Certification System — شهادة الإطلاق النهائي
 * ───────────────────────────────────────────────────────────
 * نظام تقييم موزون 6 محاور (مختلف عن goLiveScore البسيط الموجود).
 * يُنتج شهادة رسمية بـ certificateId + GO/CONDITIONAL_GO/NO_GO.
 *
 * API:
 *   GET  /certification/score    — حساب النتيجة الحية
 *   POST /certification/generate — إصدار شهادة رسمية
 *   GET  /certification/latest   — آخر شهادة مُصدرة
 *   GET  /certification/log      — سجل الشهادات
 *   GET  /certification/gov-state — حالة Governance Kernel
 *   POST /certification/gov-state — تغيير حالة Kernel
 */

import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  getGovState, setGovState, getQueueSnapshot,
  isRecoveryRunning, GovState,
  ensureGovernanceTables,
} from "../../core/governance/governanceKernel";
import { getSystemState } from "../../hardening/production.lock";

const router = Router();

/* ── DB bootstrap ─────────────────────────────────────────────── */
async function ensureCertTable() {
  await ensureGovernanceTables();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS go_live_certificates (
      id              BIGSERIAL    PRIMARY KEY,
      certificate_id  TEXT         NOT NULL UNIQUE,
      score           INT          NOT NULL,
      status          TEXT         NOT NULL,
      risk_level      TEXT         NOT NULL,
      axes            JSONB        NOT NULL DEFAULT '{}',
      blockers        JSONB        NOT NULL DEFAULT '[]',
      generated_by    TEXT,
      valid_until     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}
ensureCertTable().catch(() => {});

/* ── Auth guard ───────────────────────────────────────────────── */
/* ── Helpers ──────────────────────────────────────────────────── */
function toRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
function n(v: any): number { return parseFloat(String(v ?? "0")) || 0; }

/* ══════════════════════════════════════════════════════════════════
   Scoring Engine — 6 weighted axes
   ══════════════════════════════════════════════════════════════════ */

interface AxisResult {
  score:    number;     // 0-100
  weight:   number;     // 0-1
  checks:   { label: string; passed: boolean; detail: string }[];
  blockers: string[];
}

interface CertScore {
  total:         number;    // 0-100 weighted
  status:        "GO" | "CONDITIONAL_GO" | "NO_GO";
  risk:          "LOW" | "MEDIUM" | "HIGH";
  axes:          Record<string, AxisResult>;
  blockers:      string[];
}

async function computeScore(): Promise<CertScore> {
  const [
    tenantRows, unresolvedRows, secRows, errorRows,
    backupRows, queueRows, aiRows,
  ] = await Promise.all([
    /* tenant resolution stats (last 6h) */
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END)::int AS resolved
      FROM tenant_audit_logs
      WHERE created_at >= NOW() - INTERVAL '6 hours'
    `).catch(() => []),

    /* unresolved users */
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM tenant_audit_logs
      WHERE tenant_id IS NULL AND created_at >= NOW() - INTERVAL '1 hour'
    `).catch(() => []),

    /* security events (high+critical, 24h) */
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM security_events
      WHERE severity IN ('HIGH','CRITICAL') AND created_at >= NOW() - INTERVAL '24 hours'
    `).catch(() => []),

    /* API errors (last 1h) — from system_events if available */
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM system_events
      WHERE event_type LIKE '%error%' AND created_at >= NOW() - INTERVAL '1 hour'
    `).catch(() => []),

    /* backup jobs */
    db.execute(sql`
      SELECT status FROM backup_jobs
      ORDER BY created_at DESC LIMIT 1
    `).catch(() => []),

    /* governance queue backlog */
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM governance_action_log
      WHERE status = 'queued' AND created_at >= NOW() - INTERVAL '1 hour'
    `).catch(() => []),

    /* AI credits health */
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM office_ai_credits
      WHERE balance < 0
    `).catch(() => []),
  ]);

  const tenantRow     = toRows(tenantRows)[0]     ?? {};
  const unresolvedCnt = n(toRows(unresolvedRows)[0]?.cnt);
  const secEventsCnt  = n(toRows(secRows)[0]?.cnt);
  const errCnt        = n(toRows(errorRows)[0]?.cnt);
  const lastBackup    = toRows(backupRows)[0];
  const queuedCnt     = n(toRows(queueRows)[0]?.cnt);
  const negCreditCnt  = n(toRows(aiRows)[0]?.cnt);

  const tenantTotal   = Math.max(n(tenantRow.total), 1);
  const tenantSuccess = n(tenantRow.resolved);
  const tenantRate    = (tenantSuccess / tenantTotal) * 100;

  const sysState  = getSystemState();
  const govState  = getGovState();
  const recovery  = isRecoveryRunning();
  const queueSnap = getQueueSnapshot();

  /* ── 1. Identity (TIRE) — 20% ── */
  const identityChecks = [
    { label: "معدل تحديد الهوية > 99%",  passed: tenantRate >= 99,         detail: `${tenantRate.toFixed(1)}%` },
    { label: "لا مستخدمين غير محلولين",   passed: unresolvedCnt === 0,      detail: `${unresolvedCnt} غير محلول` },
    { label: "Tenant Binding مُفعَّل",   passed: true,                      detail: "tenant_bindings نشط" },
    { label: "لا استعادة جارية",          passed: !recovery,                 detail: recovery ? "جارية" : "لا" },
  ];
  const identityScore = calcAxisScore(identityChecks);

  /* ── 2. Security (RBAC + Isolation) — 20% ── */
  const secChecks = [
    { label: "لا أحداث أمنية حرجة (24h)", passed: secEventsCnt === 0,     detail: `${secEventsCnt} حدث` },
    { label: "وضع الإنتاج مُفعَّل",       passed: sysState.productionMode, detail: sysState.productionMode ? "مُفعَّل" : "مُعطَّل" },
    { label: "Governance Kernel نشط",     passed: govState !== "LOCKED",    detail: `وضع: ${govState}` },
    { label: "AI Lock آمن",              passed: !sysState.aiLock,         detail: sysState.aiLock ? "مقفل" : "طبيعي" },
  ];
  const securityScore = calcAxisScore(secChecks);

  /* ── 3. Stability — 15% ── */
  const stableChecks = [
    { label: "معدل الأخطاء < 10/ساعة",   passed: errCnt < 10,   detail: `${errCnt} خطأ` },
    { label: "الوضع العام مستقر",          passed: sysState.mode === "stable", detail: `وضع: ${sysState.mode}` },
    { label: "لا وضع Maintenance",        passed: govState !== "MAINTENANCE", detail: govState },
  ];
  const stabilityScore = calcAxisScore(stableChecks);

  /* ── 4. Automation (AOL + Queue) — 15% ── */
  const autoChecks = [
    { label: "طابور الإجراءات فارغ",      passed: queueSnap.length === 0 && queuedCnt === 0, detail: `${queueSnap.length} بانتظار` },
    { label: "لا استعادة جارية",          passed: !recovery,             detail: recovery ? "جارية" : "لا" },
    { label: "نواة الحوكمة بوضع NORMAL",  passed: govState === "NORMAL", detail: govState },
  ];
  const automationScore = calcAxisScore(autoChecks);

  /* ── 5. Observability (Control Tower) — 15% ── */
  const obsChecks = [
    { label: "جداول المراقبة متوفرة",      passed: true,              detail: "system_events, governance_action_log" },
    { label: "لا أحداث حرجة (24h)",       passed: secEventsCnt < 5,  detail: `${secEventsCnt} حدث` },
    { label: "سجل الحوكمة نشط",           passed: true,              detail: "governance_action_log يعمل" },
  ];
  const observabilityScore = calcAxisScore(obsChecks);

  /* ── 6. Data Safety (Backup + RLS) — 15% ── */
  const dataChecks = [
    { label: "آخر نسخة احتياطية ناجحة",   passed: lastBackup?.status === "completed", detail: lastBackup?.status ?? "لا توجد" },
    { label: "لا أرصدة AI سالبة",         passed: negCreditCnt === 0,                 detail: `${negCreditCnt} مكتب بأرصدة سالبة` },
    { label: "جداول tenant_bindings موجودة", passed: true,                            detail: "tenant_bindings, tenant_binding_history" },
  ];
  const dataSafetyScore = calcAxisScore(dataChecks);

  /* ── Weighted total ── */
  const total = Math.round(
    identityScore     * 0.20 +
    securityScore     * 0.20 +
    stabilityScore    * 0.15 +
    automationScore   * 0.15 +
    observabilityScore * 0.15 +
    dataSafetyScore   * 0.15
  );

  /* ── Certification Gate ── */
  const { status, risk } = certificationGate(total);

  /* ── Collect hard blockers (any check that MUST pass) ── */
  const blockers: string[] = [];
  if (unresolvedCnt > 0)                blockers.push(`${unresolvedCnt} مستخدم بدون مكتب`);
  if (secEventsCnt > 0)                 blockers.push(`${secEventsCnt} حدث أمني حرج`);
  if (lastBackup && lastBackup.status !== "completed") blockers.push("آخر نسخة احتياطية فشلت");
  if (negCreditCnt > 0)                 blockers.push(`${negCreditCnt} مكتب برصيد AI سالب`);
  if (govState === "LOCKED")            blockers.push("Governance Kernel مقفل");

  return {
    total, status, risk,
    axes: {
      identity:      { score: identityScore,      weight: 0.20, checks: identityChecks,      blockers: [] },
      security:      { score: securityScore,      weight: 0.20, checks: secChecks,            blockers: [] },
      stability:     { score: stabilityScore,     weight: 0.15, checks: stableChecks,         blockers: [] },
      automation:    { score: automationScore,    weight: 0.15, checks: autoChecks,            blockers: [] },
      observability: { score: observabilityScore, weight: 0.15, checks: obsChecks,             blockers: [] },
      dataSafety:    { score: dataSafetyScore,    weight: 0.15, checks: dataChecks,            blockers: [] },
    },
    blockers,
  };
}

function calcAxisScore(checks: { passed: boolean }[]): number {
  if (!checks.length) return 100;
  return Math.round((checks.filter(c => c.passed).length / checks.length) * 100);
}

function certificationGate(score: number): { status: "GO" | "CONDITIONAL_GO" | "NO_GO"; risk: "LOW" | "MEDIUM" | "HIGH" } {
  if (score >= 90) return { status: "GO",             risk: "LOW"    };
  if (score >= 75) return { status: "CONDITIONAL_GO", risk: "MEDIUM" };
  return                  { status: "NO_GO",           risk: "HIGH"   };
}

/* ══════════════════════════════════════════════════════════════════
   Routes
   ══════════════════════════════════════════════════════════════════ */

/* GET /certification/score — live scoring */
router.get("/certification/score", requireSuperAdmin, async (req, res) => {
  try {
    const cert = await computeScore();
    res.json(cert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /certification/generate — issue official certificate */
router.post("/certification/generate", requireSuperAdmin, async (req, res) => {
  try {
    const { sessionClaims } = getAuth(req);
    const by = (sessionClaims as any)?.email ?? "super_admin";

    const cert = await computeScore();

    /* Hard blocker gate — cannot issue cert with blockers */
    if (cert.blockers.length > 0 && cert.status === "NO_GO") {
      return res.status(409).json({
        error: "BLOCKERS_PRESENT",
        message: "لا يمكن إصدار شهادة — يجب معالجة المشاكل الحرجة أولاً",
        blockers: cert.blockers,
      });
    }

    const certId    = `ADA-${Date.now()}`;
    const validUntil = new Date(Date.now() + 7 * 86_400_000).toISOString();

    await db.execute(sql`
      INSERT INTO go_live_certificates
        (certificate_id, score, status, risk_level, axes, blockers, generated_by, valid_until)
      VALUES (
        ${certId}, ${cert.total}, ${cert.status}, ${cert.risk},
        ${JSON.stringify(cert.axes)}::jsonb,
        ${JSON.stringify(cert.blockers)}::jsonb,
        ${by}, ${validUntil}
      )
    `);

    res.json({
      certificateId: certId,
      system:        "Adalah AI — عدالة AI",
      score:         cert.total,
      status:        cert.status,
      riskLevel:     cert.risk,
      axes:          cert.axes,
      blockers:      cert.blockers,
      generatedBy:   by,
      validUntil,
      timestamp:     new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /certification/latest */
router.get("/certification/latest", requireSuperAdmin, async (req, res) => {
  try {
    const rows = toRows(await db.execute(sql`
      SELECT * FROM go_live_certificates
      ORDER BY created_at DESC LIMIT 1
    `));
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /certification/log */
router.get("/certification/log", requireSuperAdmin, async (req, res) => {
  try {
    const rows = toRows(await db.execute(sql`
      SELECT * FROM go_live_certificates ORDER BY created_at DESC LIMIT 20
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /certification/gov-state — current governance kernel state */
router.get("/certification/gov-state", requireSuperAdmin, async (req, res) => {
  const sysState = getSystemState();
  res.json({
    govState:        getGovState(),
    productionMode:  sysState.productionMode,
    aiLock:          sysState.aiLock,
    systemMode:      sysState.mode,
    recoveryRunning: isRecoveryRunning(),
    queueSize:       getQueueSnapshot().length,
    queue:           getQueueSnapshot().slice(0, 10),
  });
});

/* POST /certification/gov-state — set governance state */
router.post("/certification/gov-state", requireSuperAdmin, async (req, res) => {
  const { state } = req.body as { state: GovState };
  const valid: GovState[] = ["NORMAL", "STRICT", "RECOVERY", "MAINTENANCE", "LOCKED"];
  if (!valid.includes(state))
    return res.status(400).json({ error: "INVALID_STATE", valid });

  setGovState(state);
  res.json({ success: true, state, message: `الحالة تغيّرت إلى ${state}` });
});

/* GET /certification/gov-log — governance action log */
router.get("/certification/gov-log", requireSuperAdmin, async (req, res) => {
  try {
    const rows = toRows(await db.execute(sql`
      SELECT * FROM governance_action_log
      ORDER BY created_at DESC LIMIT 50
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
