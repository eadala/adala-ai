/**
 * JLWM Phase 2 — Litigation Intelligence Engine
 * Generates: Strengths, Weaknesses, Missing Evidence, Procedural Risks, Recommended Actions
 * One comprehensive AI-powered report per case — cached in jlwm_litigation_intel table.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI }                from "../ai/aiChat";
import { extractJSON }           from "./jlwmAI";

const router = Router();

const LI_SYSTEM = `أنت خبير استراتيجية قانونية JLWM. مهمتك تحليل ملف القضية بعمق واستخراج ذكاء قانوني شامل.
التزم بـ: الدقة، العملية، الواقعية. لا تختلق حقائق. استند للبيانات الفعلية. أعد JSON فقط.`;

/* ── DB bootstrap ────────────────────────────────────────────── */
export async function ensureLitigationIntelTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_litigation_intel (
      id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id          TEXT NOT NULL,
      case_id            TEXT NOT NULL,
      strengths          JSONB NOT NULL DEFAULT '[]',
      weaknesses         JSONB NOT NULL DEFAULT '[]',
      missing_evidence   JSONB NOT NULL DEFAULT '[]',
      procedural_risks   JSONB NOT NULL DEFAULT '[]',
      recommended_actions JSONB NOT NULL DEFAULT '[]',
      overall_score      FLOAT NOT NULL DEFAULT 0.5,
      confidence         FLOAT NOT NULL DEFAULT 0.5,
      model_used         TEXT,
      expires_at         TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jli_office ON jlwm_litigation_intel(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jli_case   ON jlwm_litigation_intel(case_id)`).catch(() => {});
}

/* ── Intelligence item types ────────────────────────────────── */
interface IntelItem  { text: string; impact: "high"|"medium"|"low"; detail?: string }
interface ActionItem { priority: "critical"|"high"|"medium"|"low"; action: string; deadline?: string; owner?: string }

interface LitigationReport {
  strengths:           IntelItem[];
  weaknesses:          IntelItem[];
  missing_evidence:    IntelItem[];
  procedural_risks:    IntelItem[];
  recommended_actions: ActionItem[];
  overall_score:       number;
  confidence:          number;
  summary?:            string;
}

/* ── AI call ─────────────────────────────────────────────────── */
async function callLitigationAI(caseCtx: any, officeId: string): Promise<{ report: LitigationReport; modelUsed: string }> {
  const prompt = `
حلّل هذه القضية القانونية بعمق وأعد تقرير استخباراتي شاملاً بصيغة JSON:
{
  "strengths": [
    { "text": "نقطة قوة محددة", "impact": "high|medium|low", "detail": "شرح تفصيلي" }
  ],
  "weaknesses": [
    { "text": "نقطة ضعف محددة", "impact": "high|medium|low", "detail": "شرح وكيفية التعامل معها" }
  ],
  "missing_evidence": [
    { "text": "دليل ناقص محدد", "impact": "high|medium|low", "detail": "كيفية الحصول عليه" }
  ],
  "procedural_risks": [
    { "text": "خطر إجرائي محدد", "impact": "high|medium|low", "detail": "كيفية تجنبه" }
  ],
  "recommended_actions": [
    { "priority": "critical|high|medium|low", "action": "إجراء محدد وقابل للتنفيذ", "deadline": "خلال X أيام", "owner": "من ينفذ" }
  ],
  "overall_score": 0-1,
  "confidence": 0-1,
  "summary": "ملخص تنفيذي موجز"
}
[ملف القضية الكامل]: ${JSON.stringify(caseCtx, null, 2)}`;

  const { reply, modelUsed } = await callAI(LI_SYSTEM, prompt, [], "auto", officeId);
  const parsed = extractJSON<LitigationReport>(reply);
  if (!parsed?.strengths) throw new Error("Invalid AI response structure");
  return { report: parsed, modelUsed };
}

/* ── Deterministic fallback ─────────────────────────────────── */
function buildFallbackReport(caseCtx: any): LitigationReport {
  const docCount  = Number(caseCtx.document_count ?? 0);
  const tasksDone = Number(caseCtx.completed_tasks ?? 0);
  const taskTotal = Number(caseCtx.task_count ?? 0);
  const hearings  = Number(caseCtx.hearing_count ?? 0);
  const hasDesc   = Boolean(caseCtx.description?.length > 50);

  const strengths:   IntelItem[] = [];
  const weaknesses:  IntelItem[] = [];
  const missing:     IntelItem[] = [];
  const risks:       IntelItem[] = [];
  const actions:     ActionItem[] = [];

  if (docCount >= 5) strengths.push({ text: "ملف وثائق غني", impact:"high", detail:`${docCount} وثيقة مرفقة تعزز الموقف القانوني` });
  if (tasksDone > taskTotal * 0.7 && taskTotal > 0) strengths.push({ text: "تقدم جيد في تنفيذ المهام", impact:"medium", detail:`${tasksDone}/${taskTotal} مهام مكتملة` });
  if (hearings >= 3) strengths.push({ text: "تاريخ جلسات غني", impact:"medium", detail:`${hearings} جلسة توثّق مسار القضية` });
  if (hasDesc) strengths.push({ text: "توثيق جيد للقضية", impact:"low", detail:"وصف واضح ومفصّل للقضية" });

  if (docCount < 3) weaknesses.push({ text: "وثائق غير كافية", impact:"high", detail:"يجب تجميع الأدلة الداعمة فوراً" });
  if (taskTotal > 0 && tasksDone < taskTotal * 0.5) weaknesses.push({ text: "مهام متأخرة في التنفيذ", impact:"medium", detail:`${taskTotal - tasksDone} مهام لم تُكتمل بعد` });
  if (!caseCtx.next_hearing_date) weaknesses.push({ text: "لا يوجد موعد جلسة مجدول", impact:"medium", detail:"التأخر في الجلسات قد يؤثر سلباً على القضية" });

  if (docCount < 5) missing.push({ text: "مستندات داعمة إضافية", impact:"high", detail:"عقود، إيصالات، مراسلات" });
  missing.push({ text: "تقرير خبير متخصص", impact:"medium", detail:"شهادة خبير مستقل تعزز الموقف" });
  missing.push({ text: "شهادات شهود", impact:"medium", detail:"شهادات أطراف مطّلعة على الوقائع" });

  risks.push({ text: "مواعيد الطعن والاستئناف", impact:"high", detail:"تتبّع مواعيد الطعن القانونية بدقة" });
  if (!caseCtx.next_hearing_date) risks.push({ text: "التأخر في الجلسات", impact:"medium", detail:"التأخر المتكرر قد يُضعف الموقف" });
  risks.push({ text: "الإجراءات الشكلية", impact:"low", detail:"تأكد من استيفاء كل الإجراءات الشكلية المطلوبة" });

  if (docCount < 3) actions.push({ priority:"critical", action:"تجميع كافة الوثائق والأدلة الداعمة للقضية", deadline:"خلال 7 أيام" });
  actions.push({ priority:"high", action:"جدولة اجتماع شامل مع العميل لمراجعة القضية", deadline:"خلال 3 أيام" });
  actions.push({ priority:"medium", action:"إعداد مذكرة تفصيلية بالحجج القانونية", deadline:"خلال 2 أسبوع" });
  actions.push({ priority:"low", action:"متابعة ما قد تستجد من أحكام قضائية مشابهة", deadline:"شهرياً" });

  const score = Math.min(1, Math.max(0,
    0.3 + (docCount >= 5 ? 0.2 : docCount * 0.04) + (hearings * 0.05) + (hasDesc ? 0.1 : 0) + (taskTotal > 0 ? tasksDone / taskTotal * 0.2 : 0)
  ));

  return { strengths, weaknesses, missing_evidence: missing, procedural_risks: risks, recommended_actions: actions, overall_score: score, confidence: 0.55 };
}

/* ── Routes ──────────────────────────────────────────────────── */

/* POST /jlwm/litigation/:caseId/analyze */
router.post("/jlwm/litigation/:caseId/analyze", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { force = false } = req.body ?? {};

    /* Cache check */
    if (!force) {
      const { rows: cached } = await db.execute(sql`
        SELECT * FROM jlwm_litigation_intel
        WHERE office_id=${officeId} AND case_id=${caseId}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT 1
      `);
      if (cached.length) {
        const r = cached[0] as any;
        return res.json({
          cached: true,
          strengths:           r.strengths,
          weaknesses:          r.weaknesses,
          missing_evidence:    r.missing_evidence,
          procedural_risks:    r.procedural_risks,
          recommended_actions: r.recommended_actions,
          overall_score:       r.overall_score,
          confidence:          r.confidence,
          modelUsed:           r.model_used,
          createdAt:           r.created_at,
        });
      }
    }

    /* Gather comprehensive case context */
    const { rows: [caseCtx] } = await db.execute(sql`
      SELECT
        c.id, c.title, c.status, c.case_type, c.description,
        c.created_at, c.hearing_date, c.next_hearing_date,
        cl.name AS client_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId}) AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.status IN ('done','completed','مكتملة') AND t.office_id=${officeId}) AS completed_tasks,
        (SELECT COUNT(*) FROM events e WHERE e.case_id::text=c.id::text AND e.type IN ('hearing','جلسة') AND e.office_id=${officeId}) AS hearing_count,
        (SELECT COUNT(*) FROM documents d WHERE d.case_id::text=c.id::text AND d.office_id=${officeId}) AS document_count,
        (SELECT COALESCE(SUM(total_amount),0) FROM client_invoices i WHERE i.case_id::text=c.id::text AND i.office_id=${officeId}) AS invoiced_amount,
        (SELECT json_agg(json_build_object('title', t.title, 'status', t.status, 'due_date', t.due_date))
         FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId} LIMIT 10) AS recent_tasks
      FROM cases c LEFT JOIN clients cl ON cl.id::text=c.client_id::text
      WHERE c.id::text=${caseId} AND c.office_id=${officeId} LIMIT 1
    `).catch(() => ({ rows: [null] }));

    if (!caseCtx) return res.status(404).json({ error: "القضية غير موجودة" });

    let report: LitigationReport = buildFallbackReport(caseCtx);
    let modelUsed = "deterministic";

    try {
      const { report: aiReport, modelUsed: m } = await callLitigationAI(caseCtx, officeId);
      report = aiReport;
      modelUsed = m;
    } catch { /* use fallback */ }

    const expiresAt = new Date(Date.now() + 12 * 3600_000).toISOString();
    await db.execute(sql`
      INSERT INTO jlwm_litigation_intel
        (office_id, case_id, strengths, weaknesses, missing_evidence, procedural_risks,
         recommended_actions, overall_score, confidence, model_used, expires_at)
      VALUES
        (${officeId}, ${caseId},
         ${JSON.stringify(report.strengths)}::jsonb,
         ${JSON.stringify(report.weaknesses)}::jsonb,
         ${JSON.stringify(report.missing_evidence)}::jsonb,
         ${JSON.stringify(report.procedural_risks)}::jsonb,
         ${JSON.stringify(report.recommended_actions)}::jsonb,
         ${report.overall_score}, ${report.confidence}, ${modelUsed}, ${expiresAt})
    `).catch(() => {});

    res.json({ cached: false, ...report, modelUsed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/litigation/:caseId */
router.get("/jlwm/litigation/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_litigation_intel
      WHERE office_id=${officeId} AND case_id=${caseId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!rows.length) return res.json({ exists: false });
    const r = rows[0] as any;
    res.json({
      exists: true,
      strengths:           r.strengths,
      weaknesses:          r.weaknesses,
      missing_evidence:    r.missing_evidence,
      procedural_risks:    r.procedural_risks,
      recommended_actions: r.recommended_actions,
      overall_score:       r.overall_score,
      confidence:          r.confidence,
      modelUsed:           r.model_used,
      createdAt:           r.created_at,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/litigation/:caseId/history */
router.get("/jlwm/litigation/:caseId/history", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { rows } = await db.execute(sql`
      SELECT id, overall_score, confidence, model_used, created_at
      FROM   jlwm_litigation_intel
      WHERE  office_id=${officeId} AND case_id=${caseId}
      ORDER  BY created_at DESC LIMIT 5
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
