import { Router } from "express";

const router = Router();

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY;

// ── shared LLM caller (Gemini → Anthropic → OpenAI → rule-based) ──────────
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  if (GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.6 },
          }),
        }
      );
      if (res.ok) {
        const d = await res.json() as any;
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch {}
  }

  if (ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (res.ok) {
        const d = await res.json() as any;
        const text = d.content?.[0]?.text;
        if (text) return text;
      }
    } catch {}
  }

  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 2048,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (res.ok) {
        const d = await res.json() as any;
        const text = d.choices?.[0]?.message?.content;
        if (text) return text;
      }
    } catch {}
  }

  return null as any; // fallback handled by caller
}

// ── smart rule-based fallback engine ─────────────────────────────────────
function ruleBasedAnalysis(caseData: any, type: string): string {
  const title      = caseData.title || "القضية";
  const caseType   = caseData.caseType || caseData.case_type || "مدنية";
  const status     = caseData.status || "open";
  const client     = caseData.clientName || caseData.client_name || "الموكل";
  const docs       = Number(caseData.documentsCount ?? 0);
  const invoices   = Number(caseData.invoicesCount ?? 0);
  const events     = Number(caseData.eventsCount ?? 0);
  const contracts  = Number(caseData.contractsCount ?? 0);

  const statusAr = { open: "مفتوحة", in_progress: "قيد التنفيذ", closed: "مغلقة" }[status] ?? status;
  const typeAr   = { criminal: "جنائية", civil: "مدنية", commercial: "تجارية", labor: "عمالية", real_estate: "عقارية" }[caseType] ?? caseType;

  switch (type) {
    case "summarize":
      return `**ملخص تنفيذي**\n\nالقضية "${title}" من النوع **${typeAr}** للموكل **${client}**، حالتها حالياً **${statusAr}**.\n\n` +
        `**الوضع الراهن:**\n` +
        `• التوثيق: ${docs === 0 ? "⚠️ لا توجد مستندات مرفقة — يُنصح برفع الأوراق الرسمية فوراً" : `${docs} مستنداً محفوظاً`}\n` +
        `• العقود: ${contracts === 0 ? "لا توجد عقود مسجّلة" : `${contracts} عقد نشط`}\n` +
        `• الجلسات: ${events === 0 ? "لا توجد جلسات مجدولة" : `${events} موعد مسجّل`}\n` +
        `• الفواتير: ${invoices === 0 ? "لا فواتير حتى الآن" : `${invoices} فاتورة`}\n\n` +
        `**توصية:** ${docs < 2 ? "يستوجب تعزيز ملف الإثبات بالمستندات الداعمة قبل الجلسة القادمة." : "الملف في وضع جيد — احرص على تحديث حالة القضية بعد كل جلسة."}`;

    case "risks":
      return `**تقرير تحليل المخاطر**\n\n` +
        `| المخاطر | المستوى | التوصية |\n|---|---|---|\n` +
        `| ضعف التوثيق | ${docs < 3 ? "🔴 مرتفع" : docs < 6 ? "🟡 متوسط" : "🟢 منخفض"} | ${docs < 3 ? "رفع المستندات الداعمة عاجلاً" : "مستوى التوثيق مقبول"} |\n` +
        `| غياب الجلسات | ${events === 0 ? "🔴 مرتفع" : "🟢 منخفض"} | ${events === 0 ? "جدولة جلسة قريبة" : "الجلسات منظّمة"} |\n` +
        `| المخاطر المالية | ${invoices > 0 ? "🟡 متوسط" : "🟢 منخفض"} | ${invoices > 0 ? "متابعة سداد الفواتير" : "لا مخاطر مالية ظاهرة"} |\n` +
        `| غياب العقود | ${contracts === 0 ? "🟡 متوسط" : "🟢 منخفض"} | ${contracts === 0 ? "توثيق الاتفاق بعقد رسمي" : "العلاقة موثّقة"} |\n\n` +
        `**المخاطرة الإجمالية:** ${docs < 2 && events === 0 ? "🔴 مرتفعة — تدخل فوري مطلوب" : docs < 4 ? "🟡 متوسطة — تحسينات موصى بها" : "🟢 منخفضة — الملف بوضع سليم"}`;

    case "defenses":
      return `**اقتراحات الدفوع (${typeAr})**\n\n` +
        `**دفوع شكلية:**\n` +
        `١. الدفع بعدم الاختصاص القضائي (المحلي أو النوعي)\n` +
        `٢. الدفع بعدم قبول الدعوى لرفعها قبل الأوان\n` +
        `٣. الدفع ببطلان صحيفة الدعوى لإغفال بيانات جوهرية\n\n` +
        `**دفوع موضوعية:**\n` +
        `٤. الدفع بانقضاء مدة التقادم\n` +
        `${caseType === "commercial" ? "٥. الدفع بعدم تنفيذ الطرف الآخر لالتزاماته التعاقدية\n٦. طلب التحكيم وفقاً لشرط التحكيم في العقد" :
          caseType === "labor" ? "٥. الدفع بعدم استيفاء الإجراءات الأولية أمام لجان العمل\n٦. الدفع بصحة الاتفاقية المبرمة مع العامل" :
          caseType === "criminal" ? "٥. الدفع بانتفاء الركن المادي للجريمة\n٦. الدفع بعدم صحة الاعتراف لوقوعه تحت الإكراه" :
          "٥. الدفع بعدم حضور الخصم للتحقيق\n٦. طلب وقف تنفيذ الحكم المستعجل"}\n\n` +
        `*ملاحظة: هذه اقتراحات أولية — التحليل النهائي يستلزم مراجعة كاملة للأوراق.*`;

    case "judge_questions":
      return `**توقع أسئلة القاضي (${typeAr})**\n\n` +
        `**أسئلة متوقعة حول الوقائع:**\n` +
        `• ما تاريخ نشوء النزاع بالتحديد؟\n` +
        `• هل جرت محاولة للتسوية الودية قبل اللجوء للقضاء؟\n` +
        `• ما الأضرار المادية الفعلية التي لحقت بالمدّعي؟\n\n` +
        `**أسئلة حول الإثبات:**\n` +
        `• هل المستندات المقدّمة موثّقة رسمياً؟\n` +
        `• هل هناك شهود على الواقعة؟\n` +
        `${docs < 2 ? "• ⚠️ القاضي على الأرجح سيسأل عن شُح المستندات\n" : ""}` +
        `\n**أسئلة حول الطلبات:**\n` +
        `• ما الطلبات التحديدية المقدّمة بالدعوى؟\n` +
        `• هل طلب التعويض مدعوم بتقييم خبير؟\n\n` +
        `*استعد بإجابات دقيقة مدعومة بالمستندات.*`;

    case "auto_brief":
      return `**الإفادة الذكية — ${title}**\n\n` +
        `نوع القضية: ${typeAr} | الموكل: ${client} | الحالة: ${statusAr}\n\n` +
        `**أبرز الملاحظات الآن:**\n` +
        `${docs === 0 ? "🔴 لا توجد مستندات مرفقة\n" : ""}` +
        `${events === 0 ? "🟡 لا جلسات مجدولة\n" : ""}` +
        `${contracts === 0 ? "🟡 لا عقود موثّقة\n" : ""}` +
        `${docs > 0 && events > 0 && contracts > 0 ? "✅ الملف في وضع منظّم جيد\n" : ""}` +
        `\n**توصية فورية:** ${
          docs === 0 ? "ابدأ بتحميل المستندات الأساسية (صحيفة الدعوى، التوكيل، الأدلة)." :
          events === 0 ? "جدوِل جلسة في التقويم لضمان متابعة القضية." :
          "واصل المتابعة وحدّث الحالة بعد كل إجراء."
        }`;

    default:
      return "لم يتم التعرف على نوع التحليل المطلوب.";
  }
}

// ── POST /ai/analyze-case ─────────────────────────────────────────────────
router.post("/ai/analyze-case", async (req, res) => {
  try {
    const { caseData, type = "summarize" } = req.body as {
      caseData: Record<string, any>;
      type: "summarize" | "risks" | "defenses" | "judge_questions" | "auto_brief";
    };
    if (!caseData) { res.status(400).json({ error: "caseData required" }); return; }

    const typeLabels: Record<string, string> = {
      summarize:       "الملخص التنفيذي",
      risks:           "تحليل المخاطر",
      defenses:        "اقتراح الدفوع",
      judge_questions: "توقع أسئلة القاضي",
      auto_brief:      "الإفادة الذكية",
    };

    const SYSTEM = `أنت محلل قانوني خبير متخصص في القانون السعودي. تحلل القضايا وتقدم تقارير احترافية باللغة العربية. كن دقيقاً، منهجياً، وعملياً. استخدم Markdown للتنسيق.`;

    const USER = `حلل القضية التالية وأعطني **${typeLabels[type] || type}**:

القضية: ${caseData.title || "غير محدد"}
النوع: ${caseData.caseType || caseData.case_type || "مدني"}
الموكل: ${caseData.clientName || caseData.client_name || "غير محدد"}
الحالة: ${caseData.status || "مفتوحة"}
الوصف: ${caseData.description || "لا يوجد وصف"}
عدد المستندات: ${caseData.documentsCount ?? 0}
عدد العقود: ${caseData.contractsCount ?? 0}
عدد الفواتير: ${caseData.invoicesCount ?? 0}
عدد الجلسات: ${caseData.eventsCount ?? 0}`;

    const llmResult = await callLLM(SYSTEM, USER);
    const result = llmResult || ruleBasedAnalysis(caseData, type);

    res.json({
      result,
      type,
      source: llmResult ? "ai" : "rule_engine",
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /ai/emit-event ── event bus with AI insight ─────────────────────
router.post("/ai/emit-event", async (req, res) => {
  try {
    const { type, payload, caseId, clientId } = req.body as {
      type: string;
      payload: Record<string, any>;
      caseId?: string;
      clientId?: string;
    };

    const insightMap: Record<string, { insight: string; action: string; icon: string }> = {
      DOCUMENT_UPLOADED:   { insight: "تم رفع مستند — يُنصح بمراجعته وربطه بملف الإثبات", action: "review_document", icon: "📄" },
      CASE_UPDATED:        { insight: "تم تحديث حالة القضية — تحقق من التأثير على تقييم المخاطر", action: "recalculate_risk", icon: "⚖️" },
      INVOICE_CREATED:     { insight: "تم إنشاء فاتورة جديدة — تأكد من ربطها بالقضية الصحيحة", action: "link_financial_model", icon: "🧾" },
      CONTRACT_CREATED:    { insight: "تم توثيق عقد جديد — راجع البنود الحساسة قبل التوقيع", action: "review_contract_terms", icon: "📋" },
      SESSION_SCHEDULED:   { insight: "تمت جدولة جلسة — احرص على تجهيز المستندات المطلوبة قبل الجلسة", action: "prepare_hearing", icon: "📅" },
      CLIENT_ADDED:        { insight: "عميل جديد — أنشئ ملفه القانوني الكامل وحدد محاميه", action: "setup_client_file", icon: "👤" },
      MESSAGE_SENT:        { insight: "تم إرسال مراسلة — وثّق محتواها في ملف القضية", action: "log_communication", icon: "✉️" },
    };

    const aiInsight = insightMap[type] ?? {
      insight: "حدث جديد تم تسجيله في النظام",
      action: "log_event",
      icon: "🔔",
    };

    res.json({
      event: { type, payload, caseId, clientId, timestamp: new Date().toISOString() },
      ai: aiInsight,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /ai/case-brief/:id ── quick brief for case detail auto-load ───────
router.get("/ai/case-brief/:id", async (req, res) => {
  try {
    const { sql } = await import("drizzle-orm");
    const { db } = await import("@workspace/db");
    const id = req.params.id;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const [caseRow, docsCount, invoicesCount, eventsCount] = await Promise.all([
      db.execute(sql`SELECT title, case_type, status, client_name, description FROM cases WHERE id = ${id} LIMIT 1`),
      db.execute(sql`SELECT COUNT(*) as c FROM documents WHERE case_id = ${id}`),
      db.execute(sql`SELECT COUNT(*) as c FROM client_invoices WHERE case_id = ${id}`),
      db.execute(sql`SELECT COUNT(*) as c FROM events WHERE case_id = ${id}`),
    ]);

    let contractsCount = 0;
    if (isUuid) {
      const cr = await db.execute(sql`SELECT COUNT(*) as c FROM contracts WHERE case_id = ${id}::uuid`);
      contractsCount = Number((cr.rows?.[0] as any)?.c ?? 0);
    }

    const caseData = caseRow.rows?.[0] as any;
    if (!caseData) { res.status(404).json({ error: "Not found" }); return; }

    const enriched = {
      ...caseData,
      documentsCount:  Number((docsCount.rows?.[0] as any)?.c ?? 0),
      contractsCount,
      invoicesCount:   Number((invoicesCount.rows?.[0] as any)?.c ?? 0),
      eventsCount:     Number((eventsCount.rows?.[0] as any)?.c ?? 0),
    };

    const brief = ruleBasedAnalysis(enriched, "auto_brief");

    const SYSTEM = `أنت محلل قانوني خبير. قدّم إفادة ذكية مختصرة (3-5 أسطر) باللغة العربية عن القضية. استخدم Markdown.`;
    const USER   = `القضية: ${enriched.title} | النوع: ${enriched.case_type || enriched.caseType} | الحالة: ${enriched.status} | المستندات: ${enriched.documentsCount} | الجلسات: ${enriched.eventsCount}\n\nأعطني إفادة ذكية مختصرة وتوصية فورية.`;

    const llmResult = await callLLM(SYSTEM, USER);
    const result = llmResult || brief;

    res.json({
      brief: result,
      caseData: enriched,
      source: llmResult ? "ai" : "rule_engine",
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
