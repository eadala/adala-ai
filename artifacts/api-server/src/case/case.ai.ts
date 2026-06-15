/**
 * Case AI — Autonomous Legal Assistant Engine
 * ─────────────────────────────────────────────
 * Safe Semi-Autonomy: AI proposes, human approves.
 * AI is NEVER allowed to:
 *  - modify cases/status directly
 *  - touch financial data
 *  - execute without approval
 *  - bypass tenant isolation
 */

import { db }    from "@workspace/db";
import { sql }   from "drizzle-orm";
import { callAI } from "../routes/aiChat";

/* ── helpers ────────────────────────────────────── */
function sqlOne(r: any)  { return (r?.rows ?? r)?.[0] ?? null; }
function sqlAll(r: any)  { return r?.rows ?? r ?? [];          }

/* ── types ──────────────────────────────────────── */
export type AIActionType =
  | "CREATE_TASK"
  | "REQUEST_DOCUMENT"
  | "SCHEDULE_HEARING"
  | "SEND_MESSAGE"
  | "ALERT_ONLY";

export interface AIAutoTask {
  id:               string;
  type:             AIActionType;
  title:            string;
  description:      string;
  priority:         "high" | "medium" | "low";
  requiresApproval: true;
  status:           "pending_approval" | "approved" | "rejected";
}

export interface AIInsight {
  id:          string;
  case_id:     string;
  office_id:   string;
  risks:       string[];
  suggestions: string[];
  alerts:      string[];
  auto_tasks:  AIAutoTask[];
  created_at:  string;
}

/* ── DB bootstrap ────────────────────────────────── */
export async function ensureAIInsightsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS case_ai_insights (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      case_id     TEXT NOT NULL,
      office_id   TEXT NOT NULL,
      risks       JSONB DEFAULT '[]',
      suggestions JSONB DEFAULT '[]',
      alerts      JSONB DEFAULT '[]',
      auto_tasks  JSONB DEFAULT '[]',
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_case_ai_insights_case
    ON case_ai_insights(case_id, office_id, created_at DESC)
  `).catch(() => {});
}

/* ── Build context from DB ───────────────────────── */
async function buildCaseContext(caseId: string, officeId: string) {
  const caseRow = sqlOne(
    await db.execute(sql`
      SELECT * FROM cases WHERE id = ${caseId} AND office_id = ${officeId}
    `).catch(() => ({ rows: [] }))
  );
  if (!caseRow) return null;

  const tasks = sqlAll(
    await db.execute(sql`
      SELECT title, status, priority, due_date
      FROM tasks WHERE case_id = ${caseId} LIMIT 20
    `).catch(() => ({ rows: [] }))
  );

  const timeline = sqlAll(
    await db.execute(sql`
      SELECT entry_type, title, happened_at
      FROM case_timeline WHERE case_id = ${caseId}
      ORDER BY happened_at DESC LIMIT 10
    `).catch(() => ({ rows: [] }))
  );

  const docs = sqlAll(
    await db.execute(sql`
      SELECT file_name, created_at FROM storage_files
      WHERE office_id = ${officeId} LIMIT 5
    `).catch(() => ({ rows: [] }))
  );

  return {
    title:          caseRow.title,
    type:           caseRow.case_type,
    status:         caseRow.status,
    clientName:     caseRow.client_name,
    assignedLawyer: caseRow.assigned_to,
    description:    caseRow.description,
    createdAt:      caseRow.created_at,
    tasks:          tasks.map((t: any) => ({
      title:    t.title,
      status:   t.status,
      priority: t.priority,
      dueDate:  t.due_date,
    })),
    recentTimeline: timeline.map((e: any) => ({
      type:  e.entry_type,
      title: e.title,
      date:  e.happened_at,
    })),
    documents: docs.map((d: any) => d.file_name),
  };
}

/* ── Gemini prompt ───────────────────────────────── */
const SYSTEM_PROMPT = `أنت مستشار قانوني ذكي متخصص في تحليل القضايا القانونية العربية.
مهمتك: تحليل بيانات القضية واقتراح إجراءات محددة وقابلة للتنفيذ.

قواعد صارمة:
- لا تنفذ أي إجراء مباشرة
- لا تعدّل أي بيانات
- فقط قدّم التحليل والمقترحات المنظمة
- اكتب كل المحتوى باللغة العربية
- أجب بـ JSON صحيح فقط بدون أي نص إضافي`;

function buildPrompt(ctx: any): string {
  return `حلل هذه القضية القانونية وقدّم توصياتك:

${JSON.stringify(ctx, null, 2)}

أعد JSON دقيقاً بالتنسيق التالي فقط (بدون markdown، بدون أي نص خارج JSON):
{
  "risks": [
    "وصف خطر محدد 1",
    "وصف خطر محدد 2",
    "وصف خطر محدد 3"
  ],
  "suggestions": [
    "اقتراح إجراء قانوني 1",
    "اقتراح إجراء قانوني 2",
    "اقتراح إجراء قانوني 3"
  ],
  "alerts": [
    "تنبيه عاجل 1"
  ],
  "autoTasks": [
    {
      "id": "t1",
      "type": "CREATE_TASK",
      "title": "عنوان المهمة القانونية",
      "description": "وصف تفصيلي للمهمة",
      "priority": "high",
      "requiresApproval": true,
      "status": "pending_approval"
    }
  ]
}

أنواع المهام المتاحة: CREATE_TASK | REQUEST_DOCUMENT | SCHEDULE_HEARING | SEND_MESSAGE | ALERT_ONLY
الأولويات: high | medium | low`;
}

/* ── fallback when AI unavailable ───────────────── */
function fallbackInsight(caseType: string) {
  const byType: Record<string, any> = {
    criminal: {
      risks:       ["احتمال تقادم مدة الاعتراض", "نقص في الأدلة الجنائية", "تعارض شهادات الشهود"],
      suggestions: ["مراجعة ملف الأدلة بالكامل", "التقدم بطلب تأجيل الجلسة إذا لزم", "إعداد مذكرة دفاع شاملة"],
      alerts:      ["تأكد من مواعيد الجلسات القادمة"],
      autoTasks:   [
        { id: "ft1", type: "CREATE_TASK", title: "إعداد مذكرة الدفاع", description: "إعداد مذكرة دفاع شاملة للقضية الجنائية", priority: "high", requiresApproval: true, status: "pending_approval" },
        { id: "ft2", type: "REQUEST_DOCUMENT", title: "طلب نسخة من محضر الضبط", description: "طلب الحصول على نسخة رسمية من محضر الضبط", priority: "medium", requiresApproval: true, status: "pending_approval" },
      ],
    },
    commercial: {
      risks:       ["نزاع محتمل على بنود العقد", "تأخر في سداد المبالغ المتنازع عليها", "غياب وثائق داعمة للمطالبة"],
      suggestions: ["جمع جميع المستندات المالية الداعمة", "إعداد تقرير خبير مالي", "استكشاف التسوية الودية أولاً"],
      alerts:      ["مراجعة مواعيد التقادم التجارية"],
      autoTasks:   [
        { id: "ft1", type: "CREATE_TASK", title: "إعداد تقرير المطالبة المالية", description: "حساب وتوثيق كامل المبالغ المطالب بها مع الفوائد", priority: "high", requiresApproval: true, status: "pending_approval" },
      ],
    },
    civil: {
      risks:       ["احتمال عدم قبول الدعوى شكلاً", "نقص في الإثبات", "تعقيدات إجرائية"],
      suggestions: ["التحقق من اختصاص المحكمة", "مراجعة شروط قبول الدعوى", "إعداد حافظة مستندات متكاملة"],
      alerts:      ["تأكد من سريان مدة التقاضي"],
      autoTasks:   [
        { id: "ft1", type: "REQUEST_DOCUMENT", title: "تجميع المستندات الداعمة", description: "جمع وتصنيف جميع المستندات اللازمة للدعوى المدنية", priority: "high", requiresApproval: true, status: "pending_approval" },
      ],
    },
  };

  return byType[caseType] ?? {
    risks:       ["مراجعة مدة التقادم", "التأكد من اكتمال المستندات", "متابعة مواعيد الجلسات"],
    suggestions: ["إعداد ملخص القضية", "التواصل مع الموكل لتحديث المعلومات", "مراجعة الإجراءات المتبقية"],
    alerts:      ["تحقق من جدول الجلسات القادمة"],
    autoTasks:   [
      { id: "ft1", type: "CREATE_TASK", title: "مراجعة ملف القضية", description: "مراجعة شاملة لكافة وثائق وإجراءات القضية", priority: "medium", requiresApproval: true, status: "pending_approval" },
    ],
  };
}

/* ══════════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════════ */

/** Run AI analysis and persist result */
export async function runAIAnalysis(caseId: string, officeId: string): Promise<AIInsight | null> {
  await ensureAIInsightsTable();

  const ctx = await buildCaseContext(caseId, officeId);
  if (!ctx) return null;

  let parsed: any = null;
  try {
    const { reply } = await callAI(SYSTEM_PROMPT, buildPrompt(ctx), [], "gemini", officeId);
    const clean = reply
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    parsed = JSON.parse(clean);
  } catch {
    parsed = fallbackInsight(ctx.type ?? "civil");
  }

  const risks       = (parsed.risks       ?? []).slice(0, 5);
  const suggestions = (parsed.suggestions ?? []).slice(0, 5);
  const alerts      = (parsed.alerts      ?? []).slice(0, 3);
  const autoTasks   = (parsed.autoTasks   ?? []).slice(0, 4).map((t: any, i: number) => ({
    id:               t.id ?? `ai-${Date.now()}-${i}`,
    type:             t.type             ?? "CREATE_TASK",
    title:            t.title            ?? "مهمة مقترحة",
    description:      t.description      ?? "",
    priority:         t.priority         ?? "medium",
    requiresApproval: true,
    status:           "pending_approval",
  }));

  const row = sqlOne(await db.execute(sql`
    INSERT INTO case_ai_insights
      (case_id, office_id, risks, suggestions, alerts, auto_tasks)
    VALUES
      (${caseId}, ${officeId},
       ${JSON.stringify(risks)}::jsonb,
       ${JSON.stringify(suggestions)}::jsonb,
       ${JSON.stringify(alerts)}::jsonb,
       ${JSON.stringify(autoTasks)}::jsonb)
    RETURNING *
  `));

  return row as AIInsight;
}

/** Get latest cached insight for a case */
export async function getLatestInsight(caseId: string, officeId: string): Promise<AIInsight | null> {
  await ensureAIInsightsTable();
  const row = sqlOne(await db.execute(sql`
    SELECT * FROM case_ai_insights
    WHERE case_id = ${caseId} AND office_id = ${officeId}
    ORDER BY created_at DESC LIMIT 1
  `));
  return row as AIInsight | null;
}

/** Approve auto-task → create real task */
export async function approveAITask(
  insightId: string,
  taskId: string,
  caseId: string,
  officeId: string,
): Promise<any> {
  const insight = sqlOne(await db.execute(sql`
    SELECT * FROM case_ai_insights WHERE id = ${insightId} AND office_id = ${officeId}
  `));
  if (!insight) return null;

  const tasks   = (insight.auto_tasks ?? []) as AIAutoTask[];
  const target  = tasks.find(t => t.id === taskId);
  if (!target || target.status !== "pending_approval") return null;

  /* create real task */
  /* case_id is TEXT, office_id is UUID */
  const created = sqlOne(await db.execute(sql`
    INSERT INTO tasks (case_id, title, description, priority, status, office_id)
    VALUES (
      ${caseId},
      ${target.title},
      ${target.description ?? ""},
      ${target.priority ?? "medium"},
      'todo',
      ${officeId}::uuid
    )
    RETURNING *
  `));

  /* mark as approved in insight */
  const updated = tasks.map(t => t.id === taskId ? { ...t, status: "approved" as const } : t);
  await db.execute(sql`
    UPDATE case_ai_insights SET auto_tasks = ${JSON.stringify(updated)}::jsonb WHERE id = ${insightId}
  `);

  return created;
}

/** Reject auto-task */
export async function rejectAITask(
  insightId: string,
  taskId: string,
  officeId: string,
): Promise<{ ok: boolean }> {
  const insight = sqlOne(await db.execute(sql`
    SELECT * FROM case_ai_insights WHERE id = ${insightId} AND office_id = ${officeId}
  `));
  if (!insight) return { ok: false };

  const updated = ((insight.auto_tasks ?? []) as AIAutoTask[])
    .map(t => t.id === taskId ? { ...t, status: "rejected" as const } : t);
  await db.execute(sql`
    UPDATE case_ai_insights SET auto_tasks = ${JSON.stringify(updated)}::jsonb WHERE id = ${insightId}
  `);
  return { ok: true };
}
