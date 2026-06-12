import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "./aiChat";

const router = Router();

async function sqlAll(q: any): Promise<Record<string, any>[]> {
  const r = await db.execute(q) as any;
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

/* ── Document type definitions ── */

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  required?: boolean;
};

type TemplateConfig = {
  category: string;
  label: string;
  systemPrompt: string;
  buildPrompt: (vars: Record<string, string>) => string;
  fields: FieldDef[];
};

const TEMPLATES: Record<string, TemplateConfig> = {
  employment_contract: {
    category: "عقود",
    label: "عقد عمل",
    systemPrompt:
      "أنت محامٍ متخصص في نظام العمل السعودي. اكتب عقوداً رسمية كاملة باللغة العربية، منظمة بالبنود، جاهزة للتوقيع.",
    buildPrompt: (v) => `اكتب عقد عمل كامل وفق نظام العمل السعودي:
- صاحب العمل: ${v.employer_name || "[اسم المنشأة]"}
- الموظف: ${v.employee_name || "[اسم الموظف]"}
- المسمى الوظيفي: ${v.job_title || "[المسمى]"}
- الراتب الشهري: ${v.salary || "[الراتب]"} ريال
- تاريخ البدء: ${v.start_date || "[التاريخ]"}
- ساعات العمل: ${v.working_hours || "8 ساعات يومياً، 5 أيام أسبوعياً"}
- مكان العمل: ${v.location || "المملكة العربية السعودية"}
${v.extra ? `- شروط إضافية: ${v.extra}` : ""}`,
    fields: [
      { key: "employer_name", label: "صاحب العمل", placeholder: "اسم الشركة / المنشأة", required: true },
      { key: "employee_name", label: "اسم الموظف", placeholder: "الاسم الكامل", required: true },
      { key: "job_title", label: "المسمى الوظيفي", placeholder: "محاسب، مهندس..." },
      { key: "salary", label: "الراتب الشهري (ر.س)", placeholder: "5000" },
      { key: "start_date", label: "تاريخ البدء", placeholder: "1 يناير 2025" },
      { key: "working_hours", label: "ساعات العمل", placeholder: "8 ساعات، 5 أيام" },
      { key: "location", label: "مكان العمل", placeholder: "الرياض" },
      { key: "extra", label: "شروط إضافية", textarea: true, placeholder: "أي بنود خاصة..." },
    ],
  },

  lease_contract: {
    category: "عقود",
    label: "عقد إيجار",
    systemPrompt:
      "أنت محامٍ متخصص في عقود الإيجار السعودية. اكتب عقوداً رسمية كاملة باللغة العربية.",
    buildPrompt: (v) => `اكتب عقد إيجار كامل:
- المؤجر: ${v.landlord_name || "[المؤجر]"}
- المستأجر: ${v.tenant_name || "[المستأجر]"}
- العقار: ${v.property_desc || "[وصف العقار]"}
- الإيجار الشهري: ${v.rent_amount || "[المبلغ]"} ريال
- مدة العقد: ${v.duration || "سنة واحدة"}
- تاريخ البدء: ${v.start_date || "[التاريخ]"}
${v.extra ? `- شروط إضافية: ${v.extra}` : ""}`,
    fields: [
      { key: "landlord_name", label: "المؤجر", placeholder: "اسم مالك العقار", required: true },
      { key: "tenant_name", label: "المستأجر", placeholder: "اسم المستأجر", required: true },
      { key: "property_desc", label: "وصف العقار", placeholder: "شقة سكنية، 3 غرف، حي النزهة..." },
      { key: "rent_amount", label: "الإيجار الشهري (ر.س)", placeholder: "3000" },
      { key: "duration", label: "مدة العقد", placeholder: "سنة واحدة" },
      { key: "start_date", label: "تاريخ البدء", placeholder: "1 يناير 2025" },
      { key: "extra", label: "شروط إضافية", textarea: true },
    ],
  },

  service_contract: {
    category: "عقود",
    label: "عقد خدمات",
    systemPrompt:
      "أنت محامٍ متخصص في عقود الخدمات التجارية السعودية. اكتب عقوداً رسمية كاملة.",
    buildPrompt: (v) => `اكتب عقد خدمات مهنية كامل:
- مقدم الخدمة: ${v.provider_name || "[مقدم الخدمة]"}
- العميل: ${v.client_name || "[العميل]"}
- نوع الخدمة: ${v.service_type || "[الخدمة]"}
- قيمة العقد: ${v.amount || "[المبلغ]"} ريال
- مدة التنفيذ: ${v.duration || "[المدة]"}
${v.extra ? `- شروط إضافية: ${v.extra}` : ""}`,
    fields: [
      { key: "provider_name", label: "مقدم الخدمة", placeholder: "اسم الشركة / الفرد", required: true },
      { key: "client_name", label: "العميل", placeholder: "اسم العميل", required: true },
      { key: "service_type", label: "نوع الخدمة", placeholder: "خدمات استشارية، تطوير برمجيات..." },
      { key: "amount", label: "قيمة العقد (ر.س)", placeholder: "10000" },
      { key: "duration", label: "مدة التنفيذ", placeholder: "3 أشهر" },
      { key: "extra", label: "بنود إضافية", textarea: true },
    ],
  },

  defense_brief: {
    category: "مذكرات قانونية",
    label: "مذكرة دفاعية",
    systemPrompt:
      "أنت محامٍ خبير في الدفاع أمام المحاكم السعودية. اكتب مذكرات دفاعية احترافية تستخدم المصطلحات القانونية الصحيحة وتبني الحجج بشكل منطقي.",
    buildPrompt: (v) => `اكتب مذكرة دفاعية احترافية:
- رقم القضية: ${v.case_number || ""}
- المحكمة: ${v.court_name || ""}
- المدعي: ${v.plaintiff || ""}
- المدعى عليه (الموكل): ${v.defendant || ""}
- المحامي المرافع: ${v.lawyer_name || ""}
- موعد الجلسة: ${v.hearing_date || ""}
- وقائع القضية: ${v.facts || ""}
- نقاط الدفاع: ${v.defense_points || ""}
${v.extra ? `- معلومات إضافية: ${v.extra}` : ""}`,
    fields: [
      { key: "case_number", label: "رقم القضية", placeholder: "12345/1446" },
      { key: "court_name", label: "المحكمة", placeholder: "المحكمة التجارية بالرياض" },
      { key: "plaintiff", label: "المدعي", placeholder: "اسم المدعي" },
      { key: "defendant", label: "المدعى عليه (الموكل)", placeholder: "اسم الموكل", required: true },
      { key: "lawyer_name", label: "المحامي المرافع", placeholder: "الأستاذ / المستشار..." },
      { key: "hearing_date", label: "موعد الجلسة", placeholder: "15 رجب 1446" },
      { key: "facts", label: "وقائع القضية", textarea: true, required: true, placeholder: "ملخص الوقائع..." },
      { key: "defense_points", label: "نقاط الدفاع", textarea: true, required: true, placeholder: "أوجه الدفاع..." },
      { key: "extra", label: "معلومات إضافية", textarea: true },
    ],
  },

  appeal_brief: {
    category: "مذكرات قانونية",
    label: "مذكرة استئنافية",
    systemPrompt:
      "أنت محامٍ خبير في الاستئناف أمام محاكم الاستئناف السعودية. اكتب مذكرات استئنافية تعالج أوجه الخطأ في الحكم المستأنف.",
    buildPrompt: (v) => `اكتب مذكرة استئنافية:
- رقم الحكم المستأنف: ${v.judgment_number || ""}
- المحكمة المختصة: ${v.court_name || ""}
- المستأنف: ${v.appellant || ""}
- المستأنف ضده: ${v.appellee || ""}
- أسباب الاستئناف: ${v.appeal_reasons || ""}
- الطلبات: ${v.requests || ""}
${v.extra ? `- معلومات إضافية: ${v.extra}` : ""}`,
    fields: [
      { key: "judgment_number", label: "رقم الحكم المستأنف", placeholder: "789/1446" },
      { key: "court_name", label: "محكمة الاستئناف", placeholder: "محكمة استئناف الرياض" },
      { key: "appellant", label: "المستأنف", placeholder: "اسم المستأنف", required: true },
      { key: "appellee", label: "المستأنف ضده", placeholder: "اسم الطرف الآخر" },
      { key: "appeal_reasons", label: "أسباب الاستئناف", textarea: true, required: true },
      { key: "requests", label: "الطلبات", textarea: true, placeholder: "إلغاء الحكم / تعديله..." },
      { key: "extra", label: "معلومات إضافية", textarea: true },
    ],
  },

  lawsuit_response: {
    category: "ردود قانونية",
    label: "رد على دعوى",
    systemPrompt:
      "أنت محامٍ خبير في الرد على الدعاوى القضائية. اكتب ردوداً قانونية تدحض ادعاءات الطرف المقابل بأسلوب احترافي.",
    buildPrompt: (v) => `اكتب رداً قانونياً احترافياً على الدعوى:
- رقم الدعوى: ${v.case_number || ""}
- المحكمة: ${v.court_name || ""}
- المدعي: ${v.plaintiff || ""}
- المدعى عليه: ${v.defendant || ""}
- ادعاءات المدعي: ${v.claims || ""}
- نقاط الرد والدفع: ${v.response_points || ""}
${v.extra ? `- معلومات إضافية: ${v.extra}` : ""}`,
    fields: [
      { key: "case_number", label: "رقم الدعوى", placeholder: "12345/1446" },
      { key: "court_name", label: "المحكمة", placeholder: "المحكمة التجارية" },
      { key: "plaintiff", label: "المدعي", placeholder: "اسم المدعي" },
      { key: "defendant", label: "المدعى عليه", placeholder: "اسم الموكل", required: true },
      { key: "claims", label: "ادعاءات المدعي", textarea: true, required: true },
      { key: "response_points", label: "نقاط الرد", textarea: true, required: true },
      { key: "extra", label: "معلومات إضافية", textarea: true },
    ],
  },

  warning_letter: {
    category: "خطابات قانونية",
    label: "خطاب إنذار",
    systemPrompt:
      "أنت محامٍ خبير في الخطابات القانونية الرسمية. اكتب خطابات إنذار محكمة الصياغة تحقق الأثر القانوني المطلوب.",
    buildPrompt: (v) => `اكتب خطاب إنذار رسمي:
- المرسِل: ${v.sender_name || ""}
- المرسَل إليه: ${v.recipient_name || ""}
- موضوع الإنذار: ${v.subject || ""}
- المطالبة: ${v.demand || ""}
- المهلة الممنوحة: ${v.deadline || "15 يوماً"}
- عواقب عدم الامتثال: ${v.consequences || ""}
${v.extra ? `- تفاصيل: ${v.extra}` : ""}`,
    fields: [
      { key: "sender_name", label: "المرسِل", placeholder: "الاسم / المنشأة", required: true },
      { key: "recipient_name", label: "المرسَل إليه", placeholder: "اسم المستلم", required: true },
      { key: "subject", label: "موضوع الإنذار", placeholder: "مطالبة بالسداد / إخلاء العقار..." },
      { key: "demand", label: "المطالبة", textarea: true, required: true },
      { key: "deadline", label: "المهلة", placeholder: "15 يوماً من تاريخ الاستلام" },
      { key: "consequences", label: "عواقب عدم الامتثال", placeholder: "اللجوء للقضاء..." },
      { key: "extra", label: "تفاصيل إضافية", textarea: true },
    ],
  },

  demand_letter: {
    category: "خطابات قانونية",
    label: "خطاب مطالبة",
    systemPrompt:
      "أنت محامٍ خبير في خطابات المطالبة القانونية. اكتب خطابات تُلزم الطرف الآخر بتنفيذ التزاماته.",
    buildPrompt: (v) => `اكتب خطاب مطالبة قانوني:
- الدائن / المطالِب: ${v.creditor_name || ""}
- المدين / المطالَب منه: ${v.debtor_name || ""}
- المبلغ المطالَب به: ${v.amount || ""} ريال
- سبب المطالبة: ${v.reason || ""}
- المهلة للسداد: ${v.deadline || "30 يوماً"}
${v.extra ? `- تفاصيل: ${v.extra}` : ""}`,
    fields: [
      { key: "creditor_name", label: "المطالِب", placeholder: "اسم الدائن", required: true },
      { key: "debtor_name", label: "المطالَب منه", placeholder: "اسم المدين", required: true },
      { key: "amount", label: "المبلغ (ر.س)", placeholder: "50000" },
      { key: "reason", label: "سبب المطالبة", textarea: true, required: true },
      { key: "deadline", label: "مهلة السداد", placeholder: "30 يوماً" },
      { key: "extra", label: "تفاصيل إضافية", textarea: true },
    ],
  },

  power_of_attorney: {
    category: "وثائق رسمية",
    label: "وكالة شرعية",
    systemPrompt:
      "أنت محامٍ متخصص في الوكالات الشرعية وفق القانون السعودي. اكتب وكالات رسمية كاملة.",
    buildPrompt: (v) => `اكتب وكالة شرعية رسمية:
- الموكِّل: ${v.grantor_name || ""}
- رقم هوية الموكِّل: ${v.grantor_id || ""}
- الوكيل: ${v.agent_name || ""}
- رقم هوية الوكيل: ${v.agent_id || ""}
- غرض الوكالة: ${v.purpose || ""}
- حدود الصلاحيات: ${v.powers || "جميع الصلاحيات القانونية المتعلقة بالغرض"}
- مدة الوكالة: ${v.duration || "سنة واحدة"}
${v.extra ? `- ملاحظات: ${v.extra}` : ""}`,
    fields: [
      { key: "grantor_name", label: "الموكِّل", placeholder: "الاسم الكامل", required: true },
      { key: "grantor_id", label: "رقم هوية الموكِّل", placeholder: "10xxxxxxxxx" },
      { key: "agent_name", label: "الوكيل", placeholder: "الاسم الكامل", required: true },
      { key: "agent_id", label: "رقم هوية الوكيل", placeholder: "10xxxxxxxxx" },
      { key: "purpose", label: "غرض الوكالة", textarea: true, required: true },
      { key: "powers", label: "حدود الصلاحيات", textarea: true },
      { key: "duration", label: "مدة الوكالة", placeholder: "سنة واحدة" },
      { key: "extra", label: "ملاحظات", textarea: true },
    ],
  },

  declaration: {
    category: "وثائق رسمية",
    label: "إقرار",
    systemPrompt:
      "أنت محامٍ متخصص في الإقرارات القانونية. اكتب إقرارات واضحة ومحددة قانونياً.",
    buildPrompt: (v) => `اكتب إقراراً قانونياً رسمياً:
- المُقِرّ: ${v.declarant_name || ""}
- رقم الهوية: ${v.id_number || ""}
- موضوع الإقرار: ${v.subject || ""}
- تفاصيل الإقرار: ${v.details || ""}
${v.extra ? `- معلومات إضافية: ${v.extra}` : ""}`,
    fields: [
      { key: "declarant_name", label: "المُقِرّ", placeholder: "الاسم الكامل", required: true },
      { key: "id_number", label: "رقم الهوية", placeholder: "10xxxxxxxxx" },
      { key: "subject", label: "موضوع الإقرار", placeholder: "إقرار بالاستلام / بالسداد...", required: true },
      { key: "details", label: "تفاصيل الإقرار", textarea: true, required: true },
      { key: "extra", label: "معلومات إضافية", textarea: true },
    ],
  },

  custom: {
    category: "صياغة مخصصة",
    label: "صياغة مخصصة",
    systemPrompt:
      "أنت محامٍ متخصص في القانون السعودي. اكتب وثائق قانونية احترافية باللغة العربية بناءً على التعليمات.",
    buildPrompt: (v) => v.custom_prompt || "اكتب وثيقة قانونية احترافية",
    fields: [
      { key: "custom_prompt", label: "وصف الوثيقة المطلوبة", textarea: true, required: true, placeholder: "اكتب تفاصيل الوثيقة التي تريدها..." },
    ],
  },
};

/* ── Route: list templates ── */
router.get("/legal-ai/templates", (_req, res) => {
  const result: Record<string, { category: string; label: string; fields: FieldDef[] }> = {};
  for (const [key, t] of Object.entries(TEMPLATES)) {
    result[key] = { category: t.category, label: t.label, fields: t.fields };
  }
  res.json(result);
});

/* ── Route: generate document ── */
router.post("/legal-ai/generate", async (req, res) => {
  try {
    const { docType, variables = {}, caseId, clientId, model = "auto" } = req.body as {
      docType: string;
      variables: Record<string, string>;
      caseId?: string;
      clientId?: string;
      model?: string;
    };

    const template = TEMPLATES[docType];
    if (!template) {
      res.status(400).json({ error: "نوع الوثيقة غير معروف" });
      return;
    }

    let caseContext = "";
    if (caseId) {
      const rows = await sqlAll(sql`
        SELECT c.title, c.case_type, c.status,
               COALESCE(c.client_name, '') AS client_name
        FROM cases c WHERE c.id = ${caseId} LIMIT 1
      `);
      if (rows[0]) {
        const c = rows[0] as any;
        caseContext = `\n[سياق القضية: "${c.title}"، نوع: ${c.case_type}، العميل: ${c.client_name}]`;
      }
    }

    const userMessage = template.buildPrompt(variables) + caseContext;
    const { reply, modelUsed } = await callAI(template.systemPrompt, userMessage, [], model as any);

    const title = `${template.label} — ${new Date().toLocaleDateString("ar-SA")}`;
    await db.execute(sql`
      INSERT INTO legal_documents (id, doc_type, doc_category, title, content, case_id, client_id, variables, model_used)
      VALUES (
        gen_random_uuid()::text, ${docType}, ${template.category}, ${title}, ${reply},
        ${caseId ?? null}, ${clientId ?? null},
        ${JSON.stringify(variables)}::jsonb, ${modelUsed}
      )
    `);

    res.json({ content: reply, modelUsed, title, docType, category: template.category });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Route: refine existing document ── */
router.post("/legal-ai/:id/refine", async (req, res) => {
  try {
    const { instruction, model = "auto" } = req.body as { instruction: string; model?: string };
    const rows = await sqlAll(sql`SELECT * FROM legal_documents WHERE id = ${req.params.id} LIMIT 1`);
    if (!rows[0]) { res.status(404).json({ error: "الوثيقة غير موجودة" }); return; }

    const { reply } = await callAI(
      "أنت محامٍ خبير. عدّل الوثيقة القانونية بناءً على التعليمات مع الحفاظ على الطابع الرسمي.",
      `الوثيقة:\n${(rows[0] as any).content}\n\nالتعليمات: ${instruction}`,
      [], model as any
    );

    await db.execute(sql`UPDATE legal_documents SET content = ${reply} WHERE id = ${req.params.id}`);
    res.json({ content: reply });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Route: history ── */
router.get("/legal-ai/history", async (_req, res) => {
  try {
    const rows = await sqlAll(sql`
      SELECT id, doc_type, doc_category, title, model_used, created_at,
             LEFT(content, 250) AS preview
      FROM legal_documents ORDER BY created_at DESC LIMIT 30
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Route: get single document ── */
router.get("/legal-ai/:id", async (req, res) => {
  try {
    const rows = await sqlAll(sql`SELECT * FROM legal_documents WHERE id = ${req.params.id} LIMIT 1`);
    if (!rows[0]) { res.status(404).json({ error: "الوثيقة غير موجودة" }); return; }
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Route: delete document ── */
router.delete("/legal-ai/:id", async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM legal_documents WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
