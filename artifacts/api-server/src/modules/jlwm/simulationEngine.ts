/**
 * JLWM Phase 2 — Simulation Engine
 * 5 legal scenario types: appeal, settlement, expert_witness, aggressive_litigation, conservative_litigation
 * Each simulation produces multiple possible outcomes with probability scores.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI }                from "../ai/aiChat";
import { extractJSON }           from "./jlwmAI";

const router = Router();

const SIM_SYSTEM = `أنت محاكي قانوني متخصص. مهمتك: تحليل السيناريو وتوليد نتائج محتملة متعددة مع احتماليات دقيقة.
قواعد: مجموع الاحتماليات يجب أن يساوي 1.0 تقريباً. كن واقعياً ومستنداً للبيانات. أعد JSON فقط.`;

/* ── DB bootstrap ────────────────────────────────────────────── */
export async function ensureSimulationsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_simulations (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id       TEXT NOT NULL,
      case_id         TEXT NOT NULL,
      scenario_type   TEXT NOT NULL,
      scenario_params JSONB NOT NULL DEFAULT '{}',
      outcomes        JSONB NOT NULL DEFAULT '[]',
      recommended_outcome TEXT,
      model_used      TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jsim_office ON jlwm_simulations(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jsim_case   ON jlwm_simulations(case_id)`).catch(() => {});
}

/* ── Scenario definitions ────────────────────────────────────── */
export const SCENARIO_CONFIGS: Record<string, { nameAr: string; descAr: string }> = {
  appeal:                  { nameAr:"سيناريو الاستئناف",               descAr:"استئناف الحكم أمام محكمة أعلى درجة" },
  settlement:              { nameAr:"سيناريو التسوية الودية",          descAr:"إنهاء النزاع عبر تسوية تفاوضية" },
  expert_witness:          { nameAr:"سيناريو شهادة خبير",              descAr:"الاستعانة بخبير متخصص لتعزيز الموقف" },
  aggressive_litigation:   { nameAr:"سيناريو المرافعة الهجومية",       descAr:"اعتماد استراتيجية قانونية صارمة وشاملة" },
  conservative_litigation: { nameAr:"سيناريو المرافعة المحافِظة",     descAr:"استراتيجية حذرة تحافظ على الموقف الراهن" },
};

/* ── Deterministic fallback outcomes ────────────────────────── */
function fallbackOutcomes(scenarioType: string, caseData: any) {
  const invoiced = Number(caseData?.invoiced_amount ?? 50000);
  const scenarios: Record<string, any[]> = {
    appeal: [
      { name:"قبول الاستئناف وإلغاء الحكم",    probability:0.28, financial_impact: invoiced*1.1,  timeline_days:180, confidence:0.60, pros:["استرداد كامل الحقوق","سابقة قضائية قوية"], cons:["مدة أطول","تكلفة إضافية"] },
      { name:"تعديل الحكم جزئياً",               probability:0.35, financial_impact: invoiced*0.6,  timeline_days:150, confidence:0.65, pros:["تحسن في الموقف","توفير الوقت"], cons:["نتيجة جزئية"] },
      { name:"تأييد الحكم الأول",                probability:0.30, financial_impact: -invoiced*0.1, timeline_days:120, confidence:0.65, pros:["إنهاء سريع"], cons:["خسارة الاستئناف","تكلفة إضافية"] },
      { name:"إعادة القضية للمحكمة الأولى",     probability:0.07, financial_impact: 0,             timeline_days:90,  confidence:0.40, pros:["فرصة إضافية"], cons:["مدة أطول جداً"] },
    ],
    settlement: [
      { name:"تسوية شاملة كاملة",                probability:0.30, financial_impact: invoiced*0.85, timeline_days:30,  confidence:0.75, pros:["سرعة الإنهاء","ضمان النتيجة","توفير الطاقة"], cons:["مبلغ أقل من المطالبة"] },
      { name:"تسوية جزئية مع استمرار باقي المطالبات", probability:0.35, financial_impact: invoiced*0.5, timeline_days:45, confidence:0.65, pros:["استرداد فوري للجزء","استمرار المطالبة"], cons:["تعقيد إضافي"] },
      { name:"فشل التسوية والاستمرار قضائياً", probability:0.25, financial_impact: -5000,          timeline_days:180, confidence:0.60, pros:["المطالبة الكاملة محفوظة"], cons:["وقت وتكلفة إضافية"] },
      { name:"تسوية بشروط غير نقدية",           probability:0.10, financial_impact: invoiced*0.3,  timeline_days:20,  confidence:0.50, pros:["سرعة","علاقة محفوظة"], cons:["قيمة أقل نقداً"] },
    ],
    expert_witness: [
      { name:"تأثير الخبير إيجابي جداً",         probability:0.35, financial_impact: invoiced*1.2,  timeline_days:90,  confidence:0.70, pros:["تعزيز كبير للموقف","مصداقية عالية"], cons:["تكلفة الخبير"] },
      { name:"تأثير الخبير متوسط",               probability:0.40, financial_impact: invoiced*0.8,  timeline_days:75,  confidence:0.65, pros:["دعم المطالبة جزئياً"], cons:["لم يحسم الأمر"] },
      { name:"دحض الخبير من قِبل الخصم",         probability:0.18, financial_impact: invoiced*0.4,  timeline_days:120, confidence:0.55, pros:["فرصة رد على الدحض"], cons:["ضعف الموقف"] },
      { name:"رفض المحكمة لشهادة الخبير",       probability:0.07, financial_impact: -3000,         timeline_days:60,  confidence:0.50, pros:["قرار سريع"], cons:["فقدان دليل مهم"] },
    ],
    aggressive_litigation: [
      { name:"فوز كامل بكل المطالبات",           probability:0.25, financial_impact: invoiced*1.3,  timeline_days:200, confidence:0.55, pros:["أقصى تعويض","سابقة رادعة"], cons:["مدة طويلة","ضغط على العميل"] },
      { name:"فوز جزئي بالمطالبات الرئيسية",   probability:0.40, financial_impact: invoiced*0.9,  timeline_days:180, confidence:0.65, pros:["نتيجة مقبولة","تعلم قانوني"], cons:["لم تُستوفَ كل المطالبات"] },
      { name:"تعادل مع مطالبات مضادة",          probability:0.25, financial_impact: invoiced*0.2,  timeline_days:240, confidence:0.50, pros:["تجنب الخسارة الكاملة"], cons:["استنزاف طويل","مطالبات مضادة"] },
      { name:"خسارة مع مطالبات مضادة للعميل",  probability:0.10, financial_impact: -invoiced*0.3, timeline_days:300, confidence:0.45, pros:[], cons:["خسارة كاملة","مصاريف إضافية","مطالبات مضادة"] },
    ],
    conservative_litigation: [
      { name:"تسوية مبكرة بشروط معقولة",        probability:0.40, financial_impact: invoiced*0.7,  timeline_days:45,  confidence:0.75, pros:["سرعة","ضمان","توفير طاقة العميل"], cons:["نتيجة أدنى من المثلى"] },
      { name:"فوز هادئ بالمطالبات الأساسية",   probability:0.35, financial_impact: invoiced*0.85, timeline_days:120, confidence:0.65, pros:["نتيجة مضمونة نسبياً","علاقة محفوظة"], cons:["دون الحد الأقصى"] },
      { name:"استمرار بمسار طويل أكثر أماناً", probability:0.20, financial_impact: invoiced*0.6,  timeline_days:180, confidence:0.55, pros:["موقف دفاعي متين"], cons:["وقت إضافي"] },
      { name:"خسارة رغم الحذر",                 probability:0.05, financial_impact: -invoiced*0.15,timeline_days:150, confidence:0.40, pros:["تقليل الضرر"], cons:["خسارة رغم الاحتياط"] },
    ],
  };
  return scenarios[scenarioType] ?? scenarios["settlement"];
}

/* ── AI simulation call ──────────────────────────────────────── */
async function runAISimulation(scenarioType: string, caseData: any, params: any, officeId: string) {
  const cfg = SCENARIO_CONFIGS[scenarioType] ?? { nameAr: scenarioType, descAr: "" };
  const prompt = `
نفّذ محاكاة قانونية لسيناريو "${cfg.nameAr}" على القضية التالية.
أعد JSON يحتوي على 3-5 نتائج محتملة:
{
  "outcomes": [
    {
      "name": "اسم النتيجة",
      "probability": 0-1,
      "financial_impact": N,
      "timeline_days": N,
      "confidence": 0-1,
      "pros": ["ميزة 1", "ميزة 2"],
      "cons": ["عيب 1", "عيب 2"],
      "next_steps": ["خطوة 1", "خطوة 2"]
    }
  ],
  "recommended_outcome": "اسم النتيجة الأفضل",
  "overall_assessment": "تقييم شامل للسيناريو"
}
[بيانات القضية]: ${JSON.stringify(caseData, null, 2)}
[معاملات السيناريو]: ${JSON.stringify(params, null, 2)}`;

  const { reply, modelUsed } = await callAI(SIM_SYSTEM, prompt, [], "auto", officeId);
  const parsed = extractJSON<{ outcomes: any[]; recommended_outcome: string; overall_assessment: string }>(reply);
  return { parsed, modelUsed };
}

/* ── Routes ──────────────────────────────────────────────────── */

/* POST /jlwm/simulate/case/:caseId */
router.post("/jlwm/simulate/case/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { scenarioType, params = {} } = req.body ?? {};

    if (!scenarioType || !SCENARIO_CONFIGS[scenarioType])
      return res.status(400).json({ error: "نوع السيناريو غير صالح", valid: Object.keys(SCENARIO_CONFIGS) });

    /* Get case data */
    const { rows: [caseData] } = await db.execute(sql`
      SELECT c.*, cl.name AS client_name,
        (SELECT COALESCE(SUM(total_amount),0) FROM client_invoices i WHERE i.case_id::text=c.id::text AND i.office_id=${officeId}) AS invoiced_amount
      FROM cases c LEFT JOIN clients cl ON cl.id::text=c.client_id::text
      WHERE c.id::text=${caseId} AND c.office_id=${officeId} LIMIT 1
    `).catch(() => ({ rows: [null] }));

    if (!caseData) return res.status(404).json({ error: "القضية غير موجودة" });

    /* Run AI simulation with fallback */
    let outcomes = fallbackOutcomes(scenarioType, caseData);
    let recommendedOutcome = outcomes.sort((a, b) => b.probability - a.probability)[0]?.name ?? "";
    let overallAssessment = `سيناريو ${SCENARIO_CONFIGS[scenarioType].nameAr}: التقييم مبني على بيانات المكتب والقضية`;
    let modelUsed = "deterministic";

    try {
      const { parsed, modelUsed: m } = await runAISimulation(scenarioType, caseData, params, officeId);
      if (parsed?.outcomes?.length) {
        outcomes = parsed.outcomes;
        recommendedOutcome = parsed.recommended_outcome ?? recommendedOutcome;
        overallAssessment  = parsed.overall_assessment  ?? overallAssessment;
        modelUsed = m;
      }
    } catch { /* use fallback */ }

    /* Save to DB */
    const { rows: [saved] } = await db.execute(sql`
      INSERT INTO jlwm_simulations
        (office_id, case_id, scenario_type, scenario_params, outcomes, recommended_outcome, model_used)
      VALUES
        (${officeId}, ${caseId}, ${scenarioType}, ${JSON.stringify(params)}::jsonb,
         ${JSON.stringify(outcomes)}::jsonb, ${recommendedOutcome}, ${modelUsed})
      RETURNING id, created_at
    `).catch(() => ({ rows: [{}] }));

    const cfg = SCENARIO_CONFIGS[scenarioType];
    res.json({
      id:          (saved as any)?.id,
      scenarioType,
      scenarioName: cfg.nameAr,
      scenarioDesc: cfg.descAr,
      outcomes,
      recommendedOutcome,
      overallAssessment,
      modelUsed,
      createdAt:   (saved as any)?.created_at,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/simulate/case/:caseId — history */
router.get("/jlwm/simulate/case/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { rows } = await db.execute(sql`
      SELECT id, scenario_type, outcomes, recommended_outcome, model_used, created_at
      FROM   jlwm_simulations
      WHERE  office_id=${officeId} AND case_id=${caseId}
      ORDER  BY created_at DESC LIMIT 10
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/simulate/scenarios — list available scenarios */
router.get("/jlwm/simulate/scenarios", requireAuthWithTenant, async (_req, res) => {
  res.json(Object.entries(SCENARIO_CONFIGS).map(([id, cfg]) => ({ id, ...cfg })));
});

export default router;
