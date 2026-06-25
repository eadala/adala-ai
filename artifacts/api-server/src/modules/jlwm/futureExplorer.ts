/**
 * JLWM Phase 2 — Future Explorer
 * Generates Optimistic / Realistic / Pessimistic paths for cases, clients, and office.
 * Results stored in jlwm_future_paths table.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI }                from "../ai/aiChat";
import { extractJSON }           from "./jlwmAI";

const router = Router();

const FE_SYSTEM = `أنت محلل استراتيجي قانوني متخصص في استشراف المستقبل.
مهمتك: بناء مسارات مستقبلية واقعية بناءً على البيانات الفعلية.
أعد JSON فقط بدون أي نص إضافي. كن محدداً ودقيقاً في الأرقام والمواعيد.`;

/* ── DB table bootstrap ──────────────────────────────────────── */
export async function ensureFuturePathsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_future_paths (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id     TEXT NOT NULL,
      subject_type  TEXT NOT NULL,   -- case|client|office
      subject_id    TEXT,
      optimistic    JSONB NOT NULL DEFAULT '{}',
      realistic     JSONB NOT NULL DEFAULT '{}',
      pessimistic   JSONB NOT NULL DEFAULT '{}',
      model_used    TEXT,
      expires_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jfp_office ON jlwm_future_paths(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jfp_subject ON jlwm_future_paths(subject_type, subject_id)`).catch(() => {});
}

/* ── Path generator helpers ─────────────────────────────────── */
function buildCasePathsPrompt(caseData: any): string {
  return `حلّل هذه القضية وأنشئ 3 مسارات مستقبلية:
{
  "optimistic": {
    "label": "المسار المتفائل",
    "probability": 0-1,
    "outcome": "...",
    "timeline_days": N,
    "key_events": ["حدث 1", "حدث 2", "حدث 3"],
    "financial_impact": N,
    "risks": ["خطر 1"],
    "recommendations": ["توصية 1", "توصية 2"]
  },
  "realistic": {
    "label": "المسار الواقعي",
    "probability": 0-1,
    "outcome": "...",
    "timeline_days": N,
    "key_events": ["حدث 1", "حدث 2"],
    "financial_impact": N,
    "risks": ["خطر 1", "خطر 2"],
    "recommendations": ["توصية 1"]
  },
  "pessimistic": {
    "label": "المسار المتشائم",
    "probability": 0-1,
    "outcome": "...",
    "timeline_days": N,
    "key_events": ["حدث 1"],
    "financial_impact": N,
    "risks": ["خطر 1", "خطر 2", "خطر 3"],
    "recommendations": ["توصية 1", "توصية 2"]
  }
}
[بيانات القضية]: ${JSON.stringify(caseData, null, 2)}`;
}

function buildClientPathsPrompt(clientData: any): string {
  return `حلّل بيانات هذا العميل وأنشئ 3 مسارات مستقبلية:
{
  "optimistic": {
    "label": "المسار المتفائل",
    "probability": 0-1,
    "ltv_12m": N,
    "cases_expected": N,
    "churn_risk": "low|medium|high",
    "key_factors": ["عامل 1", "عامل 2"],
    "recommendations": ["توصية 1"]
  },
  "realistic": { ... same structure ... },
  "pessimistic": { ... same structure ... }
}
[بيانات العميل]: ${JSON.stringify(clientData, null, 2)}`;
}

function buildOfficePathsPrompt(officeData: any): string {
  return `حلّل مؤشرات هذا المكتب القانوني وأنشئ مسارات 12 شهراً:
{
  "optimistic": {
    "label": "سيناريو النمو",
    "probability": 0-1,
    "revenue_12m": N,
    "cases_12m": N,
    "win_rate": 0-1,
    "team_growth": N,
    "key_actions": ["إجراء 1", "إجراء 2"],
    "milestones": [{ "month": N, "event": "..." }]
  },
  "realistic": { ... same structure ... },
  "pessimistic": { ... same structure ... }
}
[مؤشرات المكتب]: ${JSON.stringify(officeData, null, 2)}`;
}

/* ── Deterministic fallback paths ────────────────────────────── */
function caseFallbackPaths(caseData: any) {
  const baseTime = 90;
  return {
    optimistic:  { label:"المسار المتفائل",  probability:0.30, outcome:"فوز كامل",   timeline_days: Math.round(baseTime*0.7), financial_impact: Number(caseData.invoiced_amount??0)*1.2, key_events:["تقديم مذكرة قوية","جلسة إثبات","حكم لصالح العميل"], risks:["تأخر تنفيذ الحكم"], recommendations:["استمر في تجهيز الأدلة","حضّر طلب التنفيذ مسبقاً"] },
    realistic:   { label:"المسار الواقعي",   probability:0.50, outcome:"تسوية ودية", timeline_days: baseTime,                 financial_impact: Number(caseData.invoiced_amount??0)*0.8,  key_events:["مفاوضات","عرض تسوية","إتمام الاتفاقية"],  risks:["رفض العرض أولاً","تأخر التسوية"], recommendations:["أعدّ مسودة تسوية مبكراً","قيّم عرض الخصم بجدية"] },
    pessimistic: { label:"المسار المتشائم", probability:0.20, outcome:"خسارة جزئية",timeline_days: Math.round(baseTime*1.5), financial_impact: -(Number(caseData.invoiced_amount??0)*0.3), key_events:["حكم غير مواتٍ","استئناف"], risks:["ضعف الأدلة","تأخر الإجراءات","نفقات إضافية"], recommendations:["أعدّ سيناريو الاستئناف الآن","قيّم التسوية المبكرة"] },
  };
}

function clientFallbackPaths(clientData: any) {
  const ltv = Number(clientData.total_paid ?? 0);
  return {
    optimistic:  { label:"المسار المتفائل",  probability:0.35, ltv_12m: Math.round(ltv*1.4), cases_expected:3, churn_risk:"low",    key_factors:["سداد منتظم","رضا عالٍ"], recommendations:["قدّم له خدمات إضافية","أرسل تقريراً ربع سنوياً"] },
    realistic:   { label:"المسار الواقعي",   probability:0.50, ltv_12m: Math.round(ltv*1.0), cases_expected:1, churn_risk:"medium", key_factors:["نمط ثابت","تفاعل عادي"],   recommendations:["حافظ على التواصل الدوري"] },
    pessimistic: { label:"المسار المتشائم", probability:0.15, ltv_12m: Math.round(ltv*0.3), cases_expected:0, churn_risk:"high",   key_factors:["فواتير متأخرة","قلة تفاعل"], recommendations:["تواصل فوراً واعرض تخفيضاً"] },
  };
}

function officeFallbackPaths(officeData: any) {
  const rev = Number(officeData.annualRevenue ?? 0);
  return {
    optimistic:  { label:"سيناريو النمو",     probability:0.30, revenue_12m: Math.round(rev*1.3), cases_12m:50, win_rate:0.72, team_growth:2, key_actions:["توسيع قاعدة العملاء","تطوير الخدمات الرقمية"], milestones:[{month:3,event:"اكتساب 10 عملاء جدد"},{month:6,event:"افتتاح تخصص جديد"}] },
    realistic:   { label:"سيناريو الثبات",    probability:0.50, revenue_12m: Math.round(rev*1.05),cases_12m:35, win_rate:0.65, team_growth:0, key_actions:["الحفاظ على العملاء الحاليين","تحسين العمليات"],  milestones:[{month:6,event:"إعادة هيكلة العمليات"},{month:12,event:"تجديد عقود العملاء"}] },
    pessimistic: { label:"سيناريو الانكماش", probability:0.20, revenue_12m: Math.round(rev*0.85),cases_12m:20, win_rate:0.55, team_growth:-1,key_actions:["خفض التكاليف","التركيز على القضايا المربحة"], milestones:[{month:3,event:"مراجعة التكاليف"},{month:9,event:"إعادة تقييم الاستراتيجية"}] },
  };
}

/* ── Routes ──────────────────────────────────────────────────── */

/* POST /jlwm/future/case/:caseId */
router.post("/jlwm/future/case/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { force = false } = req.body ?? {};

    if (!force) {
      const { rows: cached } = await db.execute(sql`
        SELECT optimistic, realistic, pessimistic, created_at FROM jlwm_future_paths
        WHERE office_id=${officeId} AND subject_type='case' AND subject_id=${caseId}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT 1
      `);
      if (cached.length) {
        const r = cached[0] as any;
        return res.json({ cached:true, optimistic:r.optimistic, realistic:r.realistic, pessimistic:r.pessimistic, createdAt:r.created_at });
      }
    }

    /* Gather case data */
    const { rows: [caseData] } = await db.execute(sql`
      SELECT c.*, cl.name AS client_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId}) AS task_count,
        (SELECT COALESCE(SUM(total_amount),0) FROM client_invoices i WHERE i.case_id::text=c.id::text AND i.office_id=${officeId}) AS invoiced_amount
      FROM cases c LEFT JOIN clients cl ON cl.id::text=c.client_id::text
      WHERE c.id::text=${caseId} AND c.office_id=${officeId} LIMIT 1
    `).catch(() => ({ rows: [null] }));

    if (!caseData) return res.status(404).json({ error: "القضية غير موجودة" });

    let paths = caseFallbackPaths(caseData);
    let modelUsed = "deterministic";

    try {
      const { reply, modelUsed: m } = await callAI(FE_SYSTEM, buildCasePathsPrompt(caseData), [], "auto", officeId);
      const parsed = extractJSON<typeof paths>(reply);
      if (parsed?.optimistic && parsed?.realistic && parsed?.pessimistic) {
        paths = parsed;
        modelUsed = m;
      }
    } catch { /* use fallback */ }

    const expiresAt = new Date(Date.now() + 12 * 3600_000).toISOString();
    await db.execute(sql`
      INSERT INTO jlwm_future_paths (office_id, subject_type, subject_id, optimistic, realistic, pessimistic, model_used, expires_at)
      VALUES (${officeId}, 'case', ${caseId}, ${JSON.stringify(paths.optimistic)}::jsonb, ${JSON.stringify(paths.realistic)}::jsonb, ${JSON.stringify(paths.pessimistic)}::jsonb, ${modelUsed}, ${expiresAt})
    `).catch(() => {});

    res.json({ cached:false, ...paths, modelUsed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/future/case/:caseId */
router.get("/jlwm/future/case/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_future_paths
      WHERE office_id=${officeId} AND subject_type='case' AND subject_id=${caseId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!rows.length) return res.json({ exists: false });
    const r = rows[0] as any;
    res.json({ exists:true, optimistic:r.optimistic, realistic:r.realistic, pessimistic:r.pessimistic, createdAt:r.created_at });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/future/client/:clientId */
router.post("/jlwm/future/client/:clientId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId  = (req as any).tenantId as string;
    const { clientId } = req.params as { clientId: string };

    const { rows: [clientData] } = await db.execute(sql`
      SELECT c.*,
        (SELECT COUNT(*) FROM cases cs WHERE cs.client_id::text=c.id::text AND cs.office_id=${officeId}) AS total_cases,
        (SELECT COALESCE(SUM(total_amount),0) FROM client_invoices i WHERE i.client_id::text=c.id::text AND i.status='paid' AND i.office_id=${officeId}) AS total_paid
      FROM clients c WHERE c.id::text=${clientId} AND c.office_id=${officeId} LIMIT 1
    `).catch(() => ({ rows: [null] }));

    if (!clientData) return res.status(404).json({ error: "العميل غير موجود" });

    let paths = clientFallbackPaths(clientData);
    let modelUsed = "deterministic";
    try {
      const { reply, modelUsed: m } = await callAI(FE_SYSTEM, buildClientPathsPrompt(clientData), [], "auto", officeId);
      const parsed = extractJSON<typeof paths>(reply);
      if (parsed?.optimistic && parsed?.realistic && parsed?.pessimistic) { paths = parsed; modelUsed = m; }
    } catch { /* use fallback */ }

    const expiresAt = new Date(Date.now() + 12 * 3600_000).toISOString();
    await db.execute(sql`
      INSERT INTO jlwm_future_paths (office_id, subject_type, subject_id, optimistic, realistic, pessimistic, model_used, expires_at)
      VALUES (${officeId}, 'client', ${clientId}, ${JSON.stringify(paths.optimistic)}::jsonb, ${JSON.stringify(paths.realistic)}::jsonb, ${JSON.stringify(paths.pessimistic)}::jsonb, ${modelUsed}, ${expiresAt})
    `).catch(() => {});

    res.json({ cached:false, ...paths, modelUsed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/future/office */
router.post("/jlwm/future/office", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { force = false } = req.body ?? {};

    if (!force) {
      const { rows: cached } = await db.execute(sql`
        SELECT optimistic, realistic, pessimistic, created_at FROM jlwm_future_paths
        WHERE office_id=${officeId} AND subject_type='office' AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT 1
      `);
      if (cached.length) {
        const r = cached[0] as any;
        return res.json({ cached:true, optimistic:r.optimistic, realistic:r.realistic, pessimistic:r.pessimistic, createdAt:r.created_at });
      }
    }

    /* Gather office metrics */
    const { rows: [oStats] } = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM cases WHERE office_id=${officeId}) AS total_cases,
        (SELECT COUNT(*) FROM cases WHERE office_id=${officeId} AND status IN ('won','فاز')) AS won,
        (SELECT COUNT(*) FROM cases WHERE office_id=${officeId} AND status IN ('closed','منتهية')) AS closed,
        (SELECT COALESCE(SUM(amount),0) FROM revenues WHERE office_id=${officeId} AND date >= NOW()-INTERVAL '12 months') AS annualRevenue,
        (SELECT COUNT(*) FROM clients WHERE office_id=${officeId}) AS total_clients
    `).catch(() => ({ rows: [{}] }));

    const officeData = oStats ?? {};
    let paths = officeFallbackPaths(officeData);
    let modelUsed = "deterministic";
    try {
      const { reply, modelUsed: m } = await callAI(FE_SYSTEM, buildOfficePathsPrompt(officeData), [], "auto", officeId);
      const parsed = extractJSON<typeof paths>(reply);
      if (parsed?.optimistic && parsed?.realistic && parsed?.pessimistic) { paths = parsed; modelUsed = m; }
    } catch { /* use fallback */ }

    const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
    await db.execute(sql`
      INSERT INTO jlwm_future_paths (office_id, subject_type, optimistic, realistic, pessimistic, model_used, expires_at)
      VALUES (${officeId}, 'office', ${JSON.stringify(paths.optimistic)}::jsonb, ${JSON.stringify(paths.realistic)}::jsonb, ${JSON.stringify(paths.pessimistic)}::jsonb, ${modelUsed}, ${expiresAt})
    `).catch(() => {});

    res.json({ cached:false, ...paths, modelUsed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
