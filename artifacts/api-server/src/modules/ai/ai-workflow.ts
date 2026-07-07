import { requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { Router, type Request, type Response } from "express";
import { db, casesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const AI_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.GEMINI_API_KEY ?? "";

async function callAI(prompt: string, systemPrompt: string): Promise<string> {
  // Try Anthropic first
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d: any = await r.json();
    return d.content?.[0]?.text ?? "تعذّر توليد التحليل";
  }

  // Try Gemini
  if (process.env.GEMINI_API_KEY) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    });
    const d: any = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "تعذّر توليد التحليل";
  }

  return `[يتطلب تفعيل مفتاح Anthropic أو Gemini API]\n\n${prompt.slice(0, 100)}...`;
}

// ─── POST /ai-workflow/run ────────────────────────────────────────────────────
router.post("/ai-workflow/run", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const { caseId, userId } = req.body;
    if (!caseId) { res.status(400).json({ error: "caseId مطلوب" }); return; }

    const tenantId = (req as any).tenantId as string;

    /* SECURITY: scope case fetch to authenticated tenant */
    const caseRows = await db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} AND office_id = ${tenantId} LIMIT 1`);
    const caseData = caseRows.rows?.[0] as any;
    if (!caseData) { res.status(404).json({ error: "القضية غير موجودة" }); return; }
    const wfId = randomUUID();
    await db.execute(sql`
      INSERT INTO ai_workflows (id, case_id, user_id, office_id, status, steps, started_at, created_at)
      VALUES (${wfId}, ${caseId}, ${userId ?? (req as any).userId ?? null}, ${tenantId}, 'running', '[]'::jsonb, NOW(), NOW())
    `);

    const caseInfo = `
عنوان القضية: ${caseData.title}
نوع القضية: ${caseData.case_type ?? caseData.caseType ?? "غير محدد"}
اسم الموكل: ${caseData.client_name ?? caseData.clientName ?? "غير محدد"}
وصف القضية: ${caseData.description ?? "لا يوجد وصف"}
حالة القضية: ${caseData.status ?? "مفتوحة"}
    `.trim();

    const systemBase = "أنت محامٍ خبير في القانون السعودي. أجب بالعربية باختصار واحترافية في 3-5 فقرات.";

    const steps = [
      {
        id: "case_analysis",
        title: "تحليل القضية",
        prompt: `قم بتحليل القضية التالية:\n\n${caseInfo}\n\nقدّم:\n1. تقييم أولي لموقف الموكّل\n2. نقاط القوة والضعف\n3. الاستراتيجية المقترحة`,
        system: systemBase,
      },
      {
        id: "legal_research",
        title: "البحث في الأنظمة",
        prompt: `قضية من نوع "${caseData.case_type ?? caseData.caseType ?? "مدنية"}" في المملكة العربية السعودية.\n\nاذكر:\n1. النصوص النظامية ذات الصلة\n2. الأنظمة والمراسيم المنطبقة\n3. توجهات المحاكم في مثل هذه القضايا`,
        system: systemBase,
      },
      {
        id: "opponent_simulation",
        title: "محاكاة الخصم",
        prompt: `محامي الخصم في قضية "${caseData.title}"\n\nتوقّع:\n1. الحجج المضادة التي سيطرحها\n2. نقاط ضعف موكّلك التي سيستغلها\n3. الأدلة التي قد يقدمها`,
        system: systemBase,
      },
      {
        id: "judge_questions",
        title: "توقع أسئلة القاضي",
        prompt: `قضية: "${caseData.title}"\nنوع القضية: ${caseData.case_type ?? "مدنية"}\n\nتوقّع:\n1. الأسئلة التي سيطرحها القاضي على موكّلك\n2. كيفية الإجابة على كل سؤال\n3. الأمور التي قد تقلق القاضي`,
        system: systemBase,
      },
    ];

    const results: any[] = [];
    for (const step of steps) {
      const result = await callAI(step.prompt, step.system);
      results.push({ id: step.id, title: step.title, result, completedAt: new Date().toISOString() });
    }

    // Generate final report
    const finalReport = await callAI(
      `بناءً على التحليلات التالية للقضية "${caseData.title}":\n\n` +
      results.map(r => `## ${r.title}\n${r.result}`).join("\n\n---\n\n") +
      "\n\n---\n\n## المطلوب\nأنشئ تقريراً موحداً شاملاً يتضمن:\n1. ملخص تنفيذي\n2. الاستراتيجية النهائية\n3. الخطوات العملية المقترحة\n4. تقدير نسبة النجاح",
      "أنت كبير المستشارين القانونيين. اكتب تقريراً مهنياً احترافياً شاملاً بالعربية."
    );

    await db.execute(sql`
      UPDATE ai_workflows SET
        status = 'completed',
        steps = ${JSON.stringify(results)}::jsonb,
        result = ${finalReport},
        completed_at = NOW()
      WHERE id = ${wfId} AND office_id = ${tenantId}
    `);

    res.json({
      workflowId: wfId,
      caseTitle: caseData.title,
      steps: results,
      finalReport,
      completedAt: new Date().toISOString(),
    });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

// ─── GET /ai-workflow/:caseId ─────────────────────────────────────────────────
router.get("/ai-workflow/:caseId", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params as Record<string, string>;
    const rows = await db.execute(sql`
      SELECT * FROM ai_workflows WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 10
    `);
    res.json(rows.rows ?? []);
  } catch (e: any) {
    res.json([]);
  }
});

export default router;
