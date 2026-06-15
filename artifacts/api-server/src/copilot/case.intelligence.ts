import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "../routes/aiChat";

export interface CaseIntelligence {
  caseId: string;
  caseTitle: string;
  probabilityOfWin: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  keyStrengths: string[];
  keyWeakPoints: string[];
  recommendedStrategy: string;
  estimatedDuration: string;
  analysisText: string;
  cached: boolean;
}

export async function analyzeCaseIntelligence(caseId: string): Promise<CaseIntelligence> {
  /* Check cache (6h) */
  try {
    const cached = await db.execute(sql`
      SELECT * FROM case_intelligence_cache
      WHERE case_id = ${caseId}
        AND generated_at > NOW() - INTERVAL '6 hours'
    `);
    const row = (cached.rows?.[0] ?? (cached as any)[0]) as any;
    if (row) {
      return {
        caseId,
        caseTitle: row.case_title ?? "",
        probabilityOfWin: row.probability_win,
        riskLevel: row.risk_level,
        riskScore: 100 - row.probability_win,
        keyStrengths: [],
        keyWeakPoints: row.weak_points ?? [],
        recommendedStrategy: row.strategy ?? "",
        estimatedDuration: "",
        analysisText: row.analysis_text ?? "",
        cached: true,
      };
    }
  } catch {}

  /* Fetch case data */
  const caseRows = await db.execute(sql`
    SELECT c.*, 
      COUNT(d.id) as doc_count,
      COUNT(ct.id) as timeline_count,
      COUNT(t.id) as task_count
    FROM cases c
    LEFT JOIN documents d ON d.case_id = c.id
    LEFT JOIN case_timeline ct ON ct.case_id = c.id
    LEFT JOIN tasks t ON t.case_id::text = c.id
    WHERE c.id = ${caseId}
    GROUP BY c.id
    LIMIT 1
  `);
  const caseData = (caseRows.rows?.[0] ?? (caseRows as any)[0]) as any;
  if (!caseData) throw new Error("القضية غير موجودة");

  const systemPrompt = `أنت محلل قانوني خبير. مهمتك: تحليل القضية وإرجاع JSON فقط — بدون أي نص خارج JSON.

أرجع هذا الشكل بالضبط:
{
  "probabilityOfWin": <0-100>,
  "riskLevel": "low|medium|high|critical",
  "keyStrengths": ["نقطة قوة 1", "نقطة قوة 2"],
  "keyWeakPoints": ["نقطة ضعف 1", "نقطة ضعف 2"],
  "recommendedStrategy": "وصف الاستراتيجية المقترحة",
  "estimatedDuration": "مثلاً: 3-6 أشهر",
  "analysisText": "تحليل مفصل من 3-4 جمل"
}`;

  const caseInfo = `
القضية: ${caseData.title}
النوع: ${caseData.case_type}
الحالة: ${caseData.status}
الموكّل: ${caseData.client_name ?? "غير محدد"}
الوصف: ${caseData.description ?? "لا يوجد وصف"}
المستندات: ${caseData.doc_count ?? 0}
الأحداث في الجدول الزمني: ${caseData.timeline_count ?? 0}
المهام: ${caseData.task_count ?? 0}
تاريخ الفتح: ${caseData.created_at ? new Date(caseData.created_at).toLocaleDateString("ar-SA") : "غير محدد"}
`;

  const { reply } = await callAI(systemPrompt, `حلل هذه القضية:\n${caseInfo}`, [], "gemini");
  let parsed: any = {};
  try {
    const clean = reply.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = {
      probabilityOfWin: 50,
      riskLevel: "medium",
      keyStrengths: ["البيانات غير كافية للتحليل"],
      keyWeakPoints: ["يلزم مزيد من المعلومات"],
      recommendedStrategy: "جمع المزيد من الأدلة والمستندات",
      estimatedDuration: "غير محدد",
      analysisText: reply.slice(0, 300),
    };
  }

  /* Cache result */
  try {
    await db.execute(sql`
      INSERT INTO case_intelligence_cache
        (case_id, probability_win, risk_level, weak_points, strategy, analysis_text)
      VALUES (
        ${caseId}, ${parsed.probabilityOfWin}, ${parsed.riskLevel},
        ${JSON.stringify(parsed.keyWeakPoints)}::text[],
        ${parsed.recommendedStrategy}, ${parsed.analysisText}
      )
      ON CONFLICT (case_id) DO UPDATE SET
        probability_win = ${parsed.probabilityOfWin},
        risk_level = ${parsed.riskLevel},
        weak_points = ${JSON.stringify(parsed.keyWeakPoints)}::text[],
        strategy = ${parsed.recommendedStrategy},
        analysis_text = ${parsed.analysisText},
        generated_at = NOW()
    `);
  } catch {}

  return {
    caseId,
    caseTitle: caseData.title,
    probabilityOfWin: parsed.probabilityOfWin ?? 50,
    riskLevel: parsed.riskLevel ?? "medium",
    riskScore: 100 - (parsed.probabilityOfWin ?? 50),
    keyStrengths: parsed.keyStrengths ?? [],
    keyWeakPoints: parsed.keyWeakPoints ?? [],
    recommendedStrategy: parsed.recommendedStrategy ?? "",
    estimatedDuration: parsed.estimatedDuration ?? "",
    analysisText: parsed.analysisText ?? "",
    cached: false,
  };
}
