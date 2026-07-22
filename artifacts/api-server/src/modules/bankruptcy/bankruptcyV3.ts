/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; schema authority */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callBkAI, saveReportToStorage } from "./bankruptcyIntegrations";
// V3: Pre-Bankruptcy Opening Requests Module

const router = Router();

function requireAuth(req: any, res: any, next: any) { requireAuthWithTenant(req, res, next); }
function sqlOne(r: any) { const rows = Array.isArray(r) ? r : (r?.rows ?? []); return rows[0] ?? null; }
function sqlAll(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(v: string) { return UUID_RE.test(v); }
function badId(res: any) { res.status(400).json({ error: "معرف غير صالح" }); return null; }
function genRequestNumber() { return `BK-REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; }

/* ══════════════════════════════════════════════════════════
   ENSURE TABLES — schema owned by migration 014
══════════════════════════════════════════════════════════ */
export async function ensureBankruptcyV3Tables() {
  /* Schema DDL removed — artifacts/api-server/migrations/014_bankruptcy_schema.sql owns bankruptcy V3 tables. */
}

/* ══════════════════════════════════════════════════════════
   STATUS LABEL HELPER
══════════════════════════════════════════════════════════ */
const STATUS_AR: Record<string, string> = {
  draft:                  "مسودة",
  under_assessment:       "تحت التقييم",
  documents_pending:      "في انتظار المستندات",
  ai_analysis:            "تحليل الذكاء الاصطناعي",
  ready_for_filing:       "جاهز للتقديم",
  under_legal_review:     "مراجعة قانونية",
  approved_for_submission:"معتمد للتقديم",
  submitted_to_court:     "مقدَّم للمحكمة",
  converted_to_case:      "تحوّل لملف إفلاس",
  closed:                 "مغلق",
  cancelled:              "ملغي",
};

/* ══════════════════════════════════════════════════════════
   LIST  GET /bankruptcy/opening-requests
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/opening-requests", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const { status, q } = req.query as Record<string, string>;
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT r.*,
        (SELECT COUNT(*) FROM bk_opening_request_documents d WHERE d.request_id = r.id) AS doc_count
      FROM bk_opening_requests r
      WHERE r.office_id = ${officeId}
        ${status ? sql`AND r.status = ${status}` : sql``}
        ${q ? sql`AND (r.company_name ILIKE ${"%" + q + "%"} OR r.request_number ILIKE ${"%" + q + "%"})` : sql``}
      ORDER BY r.created_at DESC
    `));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   CREATE  POST /bankruptcy/opening-requests
══════════════════════════════════════════════════════════ */
router.post("/bankruptcy/opening-requests", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const userId   = req.auth?.userId as string;
  const {
    company_name, commercial_registration, entity_type, industry,
    employee_count, annual_revenue, total_assets, total_liabilities,
    available_cash, due_debts, notes,
  } = req.body ?? {};
  if (!company_name?.trim()) return res.status(400).json({ error: "اسم الشركة مطلوب" });
  try {
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_opening_requests
        (office_id, request_number, company_name, commercial_registration, entity_type, industry,
         employee_count, annual_revenue, total_assets, total_liabilities, available_cash, due_debts,
         notes, created_by)
      VALUES (
        ${officeId}, ${genRequestNumber()}, ${company_name.trim()},
        ${commercial_registration ?? null}, ${entity_type ?? null}, ${industry ?? null},
        ${employee_count ? Number(employee_count) : null},
        ${annual_revenue ? Number(annual_revenue) : null},
        ${total_assets ? Number(total_assets) : null},
        ${total_liabilities ? Number(total_liabilities) : null},
        ${available_cash ? Number(available_cash) : null},
        ${due_debts ? Number(due_debts) : null},
        ${notes ?? null}, ${userId ?? null}
      )
      RETURNING *
    `));
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   GET ONE  GET /bankruptcy/opening-requests/:id
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/opening-requests/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const [row, docs] = await Promise.all([
      db.execute(sql`SELECT * FROM bk_opening_requests WHERE id=${id}::uuid AND office_id=${officeId}`).then(sqlOne),
      db.execute(sql`SELECT * FROM bk_opening_request_documents WHERE request_id=${id}::uuid ORDER BY uploaded_at`).then(sqlAll),
    ]);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json({ ...row, documents: docs });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   UPDATE  PATCH /bankruptcy/opening-requests/:id
══════════════════════════════════════════════════════════ */
router.patch("/bankruptcy/opening-requests/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  const {
    company_name, commercial_registration, entity_type, industry,
    employee_count, annual_revenue, total_assets, total_liabilities,
    available_cash, due_debts, status, notes,
  } = req.body ?? {};
  try {
    const row = sqlOne(await db.execute(sql`
      UPDATE bk_opening_requests SET
        company_name             = COALESCE(${company_name ?? null}, company_name),
        commercial_registration  = COALESCE(${commercial_registration ?? null}, commercial_registration),
        entity_type              = COALESCE(${entity_type ?? null}, entity_type),
        industry                 = COALESCE(${industry ?? null}, industry),
        employee_count           = COALESCE(${employee_count != null ? Number(employee_count) : null}, employee_count),
        annual_revenue           = COALESCE(${annual_revenue != null ? Number(annual_revenue) : null}, annual_revenue),
        total_assets             = COALESCE(${total_assets != null ? Number(total_assets) : null}, total_assets),
        total_liabilities        = COALESCE(${total_liabilities != null ? Number(total_liabilities) : null}, total_liabilities),
        available_cash           = COALESCE(${available_cash != null ? Number(available_cash) : null}, available_cash),
        due_debts                = COALESCE(${due_debts != null ? Number(due_debts) : null}, due_debts),
        status                   = COALESCE(${status ?? null}, status),
        notes                    = COALESCE(${notes ?? null}, notes),
        updated_at               = NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   DELETE  DELETE /bankruptcy/opening-requests/:id
══════════════════════════════════════════════════════════ */
router.delete("/bankruptcy/opening-requests/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    await db.execute(sql`DELETE FROM bk_opening_requests WHERE id=${id}::uuid AND office_id=${officeId}`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   AI ELIGIBILITY ENGINE
   POST /bankruptcy/opening-requests/:id/ai-analysis
══════════════════════════════════════════════════════════ */
router.post("/bankruptcy/opening-requests/:id/ai-analysis", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const row = sqlOne(await db.execute(sql`
      SELECT * FROM bk_opening_requests WHERE id=${id}::uuid AND office_id=${officeId}
    `));
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });

    await db.execute(sql`UPDATE bk_opening_requests SET status='ai_analysis', updated_at=NOW() WHERE id=${id}::uuid`);

    const assets      = Number(row.total_assets) || 0;
    const liabilities = Number(row.total_liabilities) || 0;
    const cash        = Number(row.available_cash) || 0;
    const revenue     = Number(row.annual_revenue) || 0;
    const duDebts     = Number(row.due_debts) || 0;
    const employees   = Number(row.employee_count) || 0;

    const netWorth    = assets - liabilities;
    const debtRatio   = assets > 0 ? liabilities / assets : 1;
    const cashCoverage= duDebts > 0 ? cash / duDebts : 1;

    const prompt = `أنت خبير قانوني متخصص في قانون الإفلاس السعودي ونظام الإفلاس الصادر بالمرسوم الملكي.
قم بتحليل الوضع المالي التالي وتقديم تقرير تقييم الأهلية:

**بيانات الشركة:**
- الاسم: ${row.company_name}
- النوع: ${row.entity_type ?? "غير محدد"}
- القطاع: ${row.industry ?? "غير محدد"}
- عدد الموظفين: ${employees}

**البيانات المالية:**
- إجمالي الأصول: ${assets.toLocaleString("ar-SA")} ريال
- إجمالي الخصوم: ${liabilities.toLocaleString("ar-SA")} ريال
- صافي الأصول: ${netWorth.toLocaleString("ar-SA")} ريال
- نسبة المديونية: ${(debtRatio * 100).toFixed(1)}%
- السيولة المتاحة: ${cash.toLocaleString("ar-SA")} ريال
- الإيرادات السنوية: ${revenue.toLocaleString("ar-SA")} ريال
- الديون المستحقة فوراً: ${duDebts.toLocaleString("ar-SA")} ريال
- نسبة تغطية السيولة للديون المستحقة: ${(cashCoverage * 100).toFixed(1)}%

أجب بـ JSON فقط بالتنسيق التالي (بدون أي نص خارج JSON):
{
  "eligibility_score": [0-100، حيث 100 = مؤهل تماماً],
  "financial_distress_score": [0-100، حيث 100 = ضائقة شديدة],
  "liquidity_risk_score": [0-100، حيث 100 = خطر سيولة حرج],
  "recovery_potential_score": [0-100، حيث 100 = إمكانية استرداد ممتازة],
  "confidence_level": [0-100],
  "procedure_recommendation": "preventive_settlement | financial_reorganization | liquidation | administrative_liquidation | not_eligible",
  "procedure_name_ar": "اسم الإجراء الموصى به بالعربية",
  "procedure_reasoning": "شرح مفصل لسبب التوصية بهذا الإجراء",
  "executive_summary": "ملخص تنفيذي في 3-4 جمل",
  "financial_health_assessment": "تقييم الصحة المالية",
  "risk_assessment": "تقييم المخاطر",
  "recommended_actions": ["إجراء 1", "إجراء 2", "إجراء 3"],
  "required_documents": ["مستند 1", "مستند 2", "مستند 3"],
  "missing_information": ["معلومة ناقصة 1", "معلومة ناقصة 2"],
  "legal_observations": "ملاحظات قانونية",
  "priority_actions": ["أولوية 1", "أولوية 2", "أولوية 3"]
}`;

    let analysis: any = {};
    try {
      const rawReply = await callBkAI(prompt, `تحليل أهلية الإفلاس - ${row.company_name}`, officeId, "bankruptcy_eligibility");
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0]); // rawReply is now a plain string
    } catch {
      analysis = {
        eligibility_score: debtRatio > 1 ? 75 : 40,
        financial_distress_score: Math.min(100, Math.round(debtRatio * 60)),
        liquidity_risk_score: cashCoverage < 0.5 ? 80 : cashCoverage < 1 ? 55 : 25,
        recovery_potential_score: assets > liabilities ? 60 : 30,
        confidence_level: 55,
        procedure_recommendation: debtRatio > 1.5 ? "liquidation" : debtRatio > 1 ? "financial_reorganization" : "preventive_settlement",
        procedure_name_ar: debtRatio > 1.5 ? "التصفية" : debtRatio > 1 ? "إعادة التنظيم المالي" : "التسوية الوقائية",
        procedure_reasoning: "بناءً على التحليل المالي الأولي — يُنصح بمراجعة قانونية متخصصة.",
        executive_summary: `شركة ${row.company_name} تُظهر مؤشرات ضائقة مالية بنسبة مديونية ${(debtRatio * 100).toFixed(0)}%.`,
        financial_health_assessment: "الوضع المالي يستدعي تدخلاً عاجلاً.",
        risk_assessment: "مخاطر متوسطة إلى مرتفعة.",
        recommended_actions: ["إعداد قوائم مالية محدثة", "مراجعة قانونية متخصصة", "تحديد الدائنين الرئيسيين"],
        required_documents: ["القوائم المالية المدققة", "سجل الأصول", "سجل الدائنين", "العقود الرئيسية"],
        missing_information: ["بيانات مالية تفصيلية"],
        legal_observations: "يخضع الطلب لأحكام نظام الإفلاس السعودي.",
        priority_actions: ["التحقق من الأهلية الرسمية", "استشارة قانونية فورية"],
      };
    }

    const readiness = calcReadiness(row, analysis);

    await db.execute(sql`
      UPDATE bk_opening_requests SET
        eligibility_score        = ${analysis.eligibility_score ?? null},
        financial_distress_score = ${analysis.financial_distress_score ?? null},
        liquidity_risk_score     = ${analysis.liquidity_risk_score ?? null},
        recovery_potential_score = ${analysis.recovery_potential_score ?? null},
        confidence_level         = ${analysis.confidence_level ?? null},
        procedure_recommendation = ${analysis.procedure_recommendation ?? null},
        ai_analysis              = ${JSON.stringify(analysis)}::jsonb,
        readiness_score          = ${readiness.score},
        readiness_details        = ${JSON.stringify(readiness)}::jsonb,
        status                   = 'ready_for_filing',
        updated_at               = NOW()
      WHERE id=${id}::uuid
    `);

    res.json({ ok: true, analysis, readiness });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   READINESS SCORE
   GET /bankruptcy/opening-requests/:id/readiness
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/opening-requests/:id/readiness", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const [row, docs] = await Promise.all([
      db.execute(sql`SELECT * FROM bk_opening_requests WHERE id=${id}::uuid AND office_id=${officeId}`).then(sqlOne),
      db.execute(sql`SELECT * FROM bk_opening_request_documents WHERE request_id=${id}::uuid`).then(sqlAll),
    ]);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    const readiness = calcReadiness({ ...row, documents: docs }, row.ai_analysis);
    res.json(readiness);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

function calcReadiness(row: any, analysis: any): any {
  const checks = [
    { id: "company_name",    label: "اسم الشركة",              done: !!row.company_name },
    { id: "cr",              label: "السجل التجاري",           done: !!row.commercial_registration },
    { id: "entity_type",     label: "نوع الكيان",              done: !!row.entity_type },
    { id: "financials",      label: "البيانات المالية الأساسية", done: !!(row.total_assets && row.total_liabilities) },
    { id: "cash",            label: "بيانات السيولة",           done: !!row.available_cash },
    { id: "due_debts",       label: "الديون المستحقة",         done: !!row.due_debts },
    { id: "ai_analysis",     label: "تحليل الذكاء الاصطناعي",  done: !!analysis?.eligibility_score },
    { id: "recommendation",  label: "التوصية الإجرائية",       done: !!analysis?.procedure_recommendation },
    { id: "docs_attached",   label: "وثائق مرفقة",             done: Array.isArray(row.documents) ? row.documents.length > 0 : false },
  ];
  const done  = checks.filter(c => c.done).length;
  const total = checks.length;
  const score = Math.round((done / total) * 100);
  const missing = checks.filter(c => !c.done).map(c => c.label);
  return { score, done, total, checks, missing };
}

/* ══════════════════════════════════════════════════════════
   COURT FILING PACKAGE
   POST /bankruptcy/opening-requests/:id/court-package
══════════════════════════════════════════════════════════ */
router.post("/bankruptcy/opening-requests/:id/court-package", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const row = sqlOne(await db.execute(sql`
      SELECT * FROM bk_opening_requests WHERE id=${id}::uuid AND office_id=${officeId}
    `));
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });

    const ai: any = row.ai_analysis ?? {};
    const assets      = Number(row.total_assets) || 0;
    const liabilities = Number(row.total_liabilities) || 0;

    const prompt = `أنت محامٍ متخصص في إجراءات الإفلاس أمام المحاكم السعودية.
أنشئ حزمة وثائق التقديم القضائي الشاملة للشركة التالية:

**معلومات الشركة:**
- الاسم: ${row.company_name}
- السجل التجاري: ${row.commercial_registration ?? "غير محدد"}
- نوع الكيان: ${row.entity_type ?? "غير محدد"}
- القطاع: ${row.industry ?? "غير محدد"}
- الإجراء الموصى به: ${ai.procedure_name_ar ?? "إعادة التنظيم المالي"}

**البيانات المالية:**
- إجمالي الأصول: ${assets.toLocaleString("ar-SA")} ريال
- إجمالي الخصوم: ${liabilities.toLocaleString("ar-SA")} ريال
- السيولة المتاحة: ${Number(row.available_cash || 0).toLocaleString("ar-SA")} ريال
- الإيرادات السنوية: ${Number(row.annual_revenue || 0).toLocaleString("ar-SA")} ريال

أنشئ الوثائق التالية بصيغة مهنية جاهزة للمحكمة:

═══════════════════════════════
[١] عريضة الإفلاس
═══════════════════════════════
[اكتب عريضة رسمية موجهة للمحكمة التجارية]

═══════════════════════════════
[٢] طلب افتتاح إجراءات الإفلاس
═══════════════════════════════
[اكتب الطلب الرسمي مستنداً للمواد القانونية ذات الصلة من نظام الإفلاس السعودي]

═══════════════════════════════
[٣] الملخص المالي التنفيذي
═══════════════════════════════
[ملخص مالي شامل مع جداول الأصول والخصوم]

═══════════════════════════════
[٤] سجل الأصول
═══════════════════════════════
[قائمة الأصول المعروفة مع التقييم]

═══════════════════════════════
[٥] سجل الخصوم والدائنين
═══════════════════════════════
[قائمة الخصوم مصنفة حسب الأولوية]

═══════════════════════════════
[٦] تقرير تقييم الذكاء الاصطناعي
═══════════════════════════════
${ai.executive_summary ?? ""}
${ai.procedure_reasoning ?? ""}
${ai.legal_observations ?? ""}

═══════════════════════════════
[٧] فهرس المستندات المطلوبة
═══════════════════════════════
[قائمة بجميع المستندات المطلوبة للتقديم]

═══════════════════════════════
[٨] الجدول الزمني للإجراءات
═══════════════════════════════
[الجدول الزمني المتوقع للإجراءات القانونية]`;

    let content = "";
    try {
      const reply = await callBkAI(prompt, "توليد حزمة التقديم القضائي", officeId, "bankruptcy_court_package");
      content = reply || generateFallbackPackage(row, ai);
    } catch {
      content = generateFallbackPackage(row, ai);
    }

    await db.execute(sql`
      UPDATE bk_opening_requests SET
        court_package_content    = ${content},
        court_package_generated_at = NOW(),
        updated_at               = NOW()
      WHERE id=${id}::uuid
    `);

    /* ③ Storage: save court package as a file */
    void saveReportToStorage({
      officeId,
      caseId: id,
      title: `حزمة المحكمة — ${row.company_name}`,
      content,
      reportId: id + "-court",
      reportType: "court_package",
    });

    res.json({ ok: true, content, generatedAt: new Date().toISOString() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

function generateFallbackPackage(row: any, ai: any): string {
  return `حزمة التقديم القضائي — ${row.company_name}
رقم الطلب: ${row.request_number}
التاريخ: ${new Date().toLocaleDateString("ar-SA")}

═══ [١] عريضة الإفلاس ═══
بسم الله الرحمن الرحيم
إلى المحكمة التجارية المختصة

يتشرف المدين / ${row.company_name}
السجل التجاري: ${row.commercial_registration ?? "—"}
بتقديم هذه العريضة طالباً افتتاح إجراءات ${ai.procedure_name_ar ?? "الإفلاس"}
وفقاً لنظام الإفلاس السعودي الصادر بالمرسوم الملكي.

═══ [٢] الملخص المالي ═══
إجمالي الأصول:  ${Number(row.total_assets || 0).toLocaleString("ar-SA")} ريال
إجمالي الخصوم: ${Number(row.total_liabilities || 0).toLocaleString("ar-SA")} ريال
السيولة:         ${Number(row.available_cash || 0).toLocaleString("ar-SA")} ريال

═══ [٣] التوصية الإجرائية ═══
${ai.procedure_reasoning ?? "يُوصى بالتشاور مع مستشار قانوني متخصص."}

═══ [٤] المستندات المطلوبة ═══
${(ai.required_documents ?? ["القوائم المالية المدققة", "سجل الأصول", "سجل الدائنين"]).map((d: string, i: number) => `${i + 1}. ${d}`).join("\n")}`;
}

/* ══════════════════════════════════════════════════════════
   DOCUMENTS — ADD
   POST /bankruptcy/opening-requests/:id/documents
══════════════════════════════════════════════════════════ */
router.post("/bankruptcy/opening-requests/:id/documents", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  const { document_type, file_name, file_url, notes } = req.body ?? {};
  if (!document_type || !file_name) return res.status(400).json({ error: "نوع الوثيقة والاسم مطلوبان" });
  try {
    const exists = sqlOne(await db.execute(sql`SELECT id FROM bk_opening_requests WHERE id=${id}::uuid AND office_id=${officeId}`));
    if (!exists) return res.status(404).json({ error: "الطلب غير موجود" });
    const doc = sqlOne(await db.execute(sql`
      INSERT INTO bk_opening_request_documents (office_id, request_id, document_type, file_name, file_url, notes)
      VALUES (${officeId}, ${id}::uuid, ${document_type}, ${file_name}, ${file_url ?? null}, ${notes ?? null})
      RETURNING *
    `));
    res.status(201).json(doc);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   DOCUMENTS — DELETE
   DELETE /bankruptcy/opening-requests/:id/documents/:docId
══════════════════════════════════════════════════════════ */
router.delete("/bankruptcy/opening-requests/:id/documents/:docId", requireAuth, async (req: any, res) => {
  const { id: reqId, docId } = req.params as Record<string, string>;
  if (!isUUID(reqId) || !isUUID(docId)) return badId(res);
  try {
    await db.execute(sql`DELETE FROM bk_opening_request_documents WHERE id=${docId}::uuid AND request_id=${reqId}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   CONVERT TO BANKRUPTCY CASE
   POST /bankruptcy/opening-requests/:id/convert
══════════════════════════════════════════════════════════ */
router.post("/bankruptcy/opening-requests/:id/convert", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const row = sqlOne(await db.execute(sql`
      SELECT * FROM bk_opening_requests WHERE id=${id}::uuid AND office_id=${officeId}
    `));
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    if (row.status === "converted_to_case") return res.status(400).json({ error: "تم تحويل هذا الطلب مسبقاً" });

    const ai: any = row.ai_analysis ?? {};
    const caseNum = `BK-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const newCase = sqlOne(await db.execute(sql`
      INSERT INTO bankruptcy_cases
        (office_id, case_number, debtor_name, debtor_commercial_reg, debtor_type,
         total_assets, total_liabilities, status, notes)
      VALUES (
        ${officeId},
        ${caseNum},
        ${row.company_name},
        ${row.commercial_registration ?? null},
        ${row.entity_type ?? "company"},
        ${row.total_assets ?? 0},
        ${row.total_liabilities ?? 0},
        'open',
        ${"محوَّل من طلب الافتتاح: " + row.request_number + (ai.executive_summary ? "\n" + ai.executive_summary : "")}
      )
      RETURNING *
    `));

    await db.execute(sql`
      UPDATE bk_opening_requests SET
        status             = 'converted_to_case',
        converted_case_id  = ${newCase.id}::uuid,
        updated_at         = NOW()
      WHERE id=${id}::uuid
    `);

    res.json({ ok: true, caseId: newCase.id, caseNumber: caseNum, case: newCase });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   DASHBOARD KPIs
   GET /bankruptcy/opening-requests-stats
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/opening-requests-stats", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    const [counts, avg] = await Promise.all([
      db.execute(sql`
        SELECT status, COUNT(*) as cnt
        FROM bk_opening_requests WHERE office_id=${officeId}
        GROUP BY status
      `).then(sqlAll),
      db.execute(sql`
        SELECT
          AVG(readiness_score)::INT    AS avg_readiness,
          AVG(eligibility_score)::INT  AS avg_eligibility,
          COUNT(*) FILTER (WHERE status='ready_for_filing') AS ready,
          COUNT(*) FILTER (WHERE status='submitted_to_court') AS submitted,
          COUNT(*) FILTER (WHERE status='converted_to_case') AS converted,
          COUNT(*) AS total
        FROM bk_opening_requests WHERE office_id=${officeId}
      `).then(sqlOne),
      db.execute(sql`
        SELECT procedure_recommendation, COUNT(*) as cnt
        FROM bk_opening_requests WHERE office_id=${officeId} AND procedure_recommendation IS NOT NULL
        GROUP BY procedure_recommendation
      `).then(sqlAll),
    ]);
    res.json({ counts, ...avg });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
