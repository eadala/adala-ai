/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
/**
 * عدالة AI — Case Autopilot Engine
 *
 * يحلل القضية تلقائياً عند إنشائها أو عند الطلب:
 * - يقيّم اكتمال ملف القضية (Health Score 0-100)
 * - يكتشف نقاط الخطر القانوني
 * - يُنشئ مهام عمل محددة تلقائياً
 * - يتوقع احتمالية النجاح بالذكاء الاصطناعي
 *
 * Stage 15.2d — task creation returns a structured result (never silent success).
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "../modules/ai/aiChat";
import {
  createAutopilotTasks as createAutopilotTasksWithDb,
  type AutopilotTaskCreateResult,
  type AutopilotTaskDb,
  type AutopilotCaseContext,
} from "./autopilotTaskCreation";

export {
  classifyAutopilotInsertOutcome,
  httpStatusForAutopilotTaskCreation,
  planAutopilotTasks,
  resolveAutopilotOfficeId,
  type AutopilotTaskCreateError,
  type AutopilotTaskCreateResult,
  type AutopilotTaskCreateStatus,
  type AutopilotTaskDb,
  type PlannedAutopilotTask,
} from "./autopilotTaskCreation";

/* ── Types ─────────────────────────────────────────────── */

export interface CaseHealthReport {
  caseId:          string;
  healthScore:     number;          // 0-100
  grade:           "A" | "B" | "C" | "D" | "F";
  risks:           string[];
  missingData:     string[];
  nextSteps:       string[];
  /** Actual rows inserted (never planned count). */
  tasksCreated:    number;
  /** Full task-creation contract for callers. */
  taskCreation:    AutopilotTaskCreateResult;
  outcomePrediction: {
    successProbability: number;     // 0-100
    label:              string;
    confidence:         "high" | "medium" | "low";
  };
  aiSummary:       string;
  runAt:           string;
}

interface CaseContext extends AutopilotCaseContext {
  case:      any;
  documents: any[];
  events:    any[];
  contracts: any[];
  invoices:  any[];
  tasks:     any[];
}

/* ── Helpers ────────────────────────────────────────────── */

async function rows(q: any): Promise<any[]> {
  const r = await db.execute(q);
  return (r as any)?.rows ?? (Array.isArray(r) ? r : []);
}

function defaultAutopilotDb(): AutopilotTaskDb {
  return {
    execute: (q) => db.execute(q as any),
    transaction: (fn) => db.transaction(async (tx: any) => fn({ execute: (q) => tx.execute(q) })),
  };
}

/** Production entry — uses the shared DB pool in one atomic transaction. */
export async function createAutopilotTasks(
  ctx: CaseContext,
  missing: string[],
  tenantId: string | null | undefined,
  deps: AutopilotTaskDb = defaultAutopilotDb(),
): Promise<AutopilotTaskCreateResult> {
  return createAutopilotTasksWithDb(ctx, missing, tenantId, deps);
}

/* ── Fetch full case context ────────────────────────────── */

async function fetchCaseContext(caseId: string, tenantId: string): Promise<CaseContext | null> {
  const [caseRows, docs, events, contracts, invoices, tasks] = await Promise.all([
    rows(sql`SELECT * FROM cases WHERE id = ${caseId} AND office_id = ${tenantId} LIMIT 1`),
    rows(sql`SELECT id, file_name, file_type FROM documents WHERE case_id = ${caseId} AND office_id = ${tenantId}`),
    rows(sql`SELECT id, title, event_type, start_at, status FROM events WHERE case_id = ${caseId} ORDER BY start_at DESC LIMIT 10`),
    rows(sql`SELECT id, title, status FROM contracts WHERE CAST(case_id AS TEXT) = ${caseId} AND office_id = ${tenantId} LIMIT 5`).catch(() => []),
    rows(sql`SELECT id, total, status FROM client_invoices WHERE case_id = ${caseId} AND office_id = ${tenantId} LIMIT 5`),
    rows(sql`SELECT id, title, status FROM tasks WHERE case_title ILIKE ${"%" + caseId + "%"} OR case_title IS NOT NULL LIMIT 10`).catch(() => []),
  ]);

  const caseRow = caseRows[0];
  if (!caseRow) return null;

  return { case: caseRow, documents: docs, events, contracts, invoices, tasks };
}

/* ── Health Score Algorithm ─────────────────────────────── */

function scoreCase(ctx: CaseContext): { score: number; missing: string[]; risks: string[] } {
  let score = 0;
  const missing: string[] = [];
  const risks:   string[] = [];
  const c = ctx.case;

  /* Client info — 20 pts */
  if (c.client_name) {
    score += 20;
  } else {
    missing.push("بيانات العميل غير مكتملة");
    risks.push("لا يمكن المتابعة القانونية بدون هوية العميل");
  }

  /* Description — 15 pts */
  if (c.description && c.description.trim().length > 20) {
    score += 15;
  } else {
    missing.push("وصف القضية مختصر أو غير موجود");
  }

  /* Documents — 20 pts */
  if (ctx.documents.length > 0) {
    score += Math.min(20, ctx.documents.length * 7);
  } else {
    missing.push("لا توجد مستندات مرفوعة");
    risks.push("غياب المستندات يضعف الموقف القانوني");
  }

  /* Upcoming hearing — 20 pts */
  const upcoming = ctx.events.filter(e => e.start_at && new Date(e.start_at) > new Date());
  if (upcoming.length > 0) {
    score += 20;
  } else if (ctx.case.status === "open" || ctx.case.status === "in_progress") {
    missing.push("لم يُحدَّد موعد للجلسة القادمة");
    risks.push("عدم تحديد الجلسات يُعرّض القضية للتأخير");
  }

  /* Contract — 15 pts */
  if (ctx.contracts.length > 0) {
    score += 15;
  } else {
    missing.push("لا يوجد عقد قانوني مرتبط");
    risks.push("غياب العقد يزيد مخاطر النزاع مع العميل");
  }

  /* Assigned lawyer — 10 pts */
  if (c.assigned_to) {
    score += 10;
  } else {
    missing.push("لم يُسنَد المحامي المسؤول");
  }

  return { score: Math.min(100, score), missing, risks };
}

/* ── Grade ──────────────────────────────────────────────── */

function grade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/* ── AI Outcome Prediction ──────────────────────────────── */

async function predictOutcome(
  ctx:   CaseContext,
  score: number
): Promise<CaseHealthReport["outcomePrediction"]> {
  const docsCount = ctx.documents.length;
  const hasContract = ctx.contracts.length > 0;
  const hasHearing = ctx.events.some(e => e.start_at && new Date(e.start_at) > new Date());

  let prob = 35 + Math.round(score * 0.45);
  if (docsCount >= 3) prob = Math.min(prob + 15, 92);
  if (hasContract)    prob = Math.min(prob + 10, 92);
  if (hasHearing)     prob = Math.min(prob + 5, 92);

  const confidence: "high" | "medium" | "low" =
    score >= 75 ? "high" : score >= 50 ? "medium" : "low";

  const label =
    prob >= 75 ? "احتمالية نجاح عالية" :
    prob >= 55 ? "احتمالية نجاح متوسطة" :
    prob >= 35 ? "يحتاج تعزيزاً" : "خطر — ملف غير مكتمل";

  return { successProbability: prob, label, confidence };
}

/* ── AI Summary via Gemini ──────────────────────────────── */

async function generateAISummary(ctx: CaseContext, score: number, risks: string[]): Promise<string> {
  const c = ctx.case;
  const prompt = `أنت مساعد قانوني ذكي. حلّل هذه القضية وأعطِ تقييماً موجزاً بـ 2-3 جمل باللغة العربية.

معلومات القضية:
- العنوان: ${c.title ?? "غير محدد"}
- النوع: ${c.case_type ?? "غير محدد"}
- الحالة: ${c.status ?? "غير محدد"}
- العميل: ${c.client_name ?? "غير مسجل"}
- عدد المستندات: ${ctx.documents.length}
- عدد الجلسات: ${ctx.events.length}
- عدد العقود: ${ctx.contracts.length}
- درجة الصحة: ${score}/100
- المخاطر المكتشفة: ${risks.join("، ") || "لا مخاطر"}

التقييم يجب أن يكون مختصراً، دقيقاً، ومفيداً للمحامي.`;

  try {
    const summary = await callAI(prompt, "gemini");
    return (typeof summary === "string" ? summary : summary.reply).slice(0, 500);
  } catch {
    const statusMap: Record<string, string> = {
      open:        "مفتوحة",
      in_progress: "قيد المعالجة",
      closed:      "مغلقة",
    };
    return `القضية "${c.title}" ${statusMap[c.status] ?? c.status} — درجة اكتمال الملف ${score}/100. ${risks.length > 0 ? "تتطلب اهتماماً عاجلاً بالنقاط المحددة." : "الملف في حالة جيدة."}`;
  }
}

/* ── Main Autopilot Runner ──────────────────────────────── */

export async function runCaseAutopilot(
  caseId:       string,
  tenantId:     string,
  createTasks = true
): Promise<CaseHealthReport | null> {
  const ctx = await fetchCaseContext(caseId, tenantId);
  if (!ctx) return null;

  const { score, missing, risks } = scoreCase(ctx);
  const [prediction, aiSummary] = await Promise.all([
    predictOutcome(ctx, score),
    generateAISummary(ctx, score, risks),
  ]);

  const taskCreation: AutopilotTaskCreateResult = createTasks
    ? await createAutopilotTasks(ctx, missing, tenantId)
    : {
        status: "skipped",
        planned: 0,
        created: 0,
        failed: 0,
        skipped: 0,
        reason: "create_tasks_disabled",
      };

  const tasksCreated = taskCreation.created;

  const report: CaseHealthReport = {
    caseId,
    healthScore:       score,
    grade:             grade(score),
    risks,
    missingData:       missing,
    nextSteps:         missing.map(m => `معالجة: ${m}`),
    tasksCreated,
    taskCreation,
    outcomePrediction: prediction,
    aiSummary,
    runAt:             new Date().toISOString(),
  };

  /* Persist analysis snapshot — failures are logged, never presented as task success */
  try {
    await db.execute(sql`
      INSERT INTO case_autopilot_reports
        (case_id, office_id, health_score, grade, risks, missing_data, next_steps,
         tasks_created, outcome_prediction, ai_summary, run_at)
      VALUES (
        ${caseId}, ${tenantId}, ${score}, ${grade(score)},
        ${JSON.stringify(risks)}::jsonb,
        ${JSON.stringify(missing)}::jsonb,
        ${JSON.stringify(report.nextSteps)}::jsonb,
        ${tasksCreated},
        ${JSON.stringify(prediction)}::jsonb,
        ${aiSummary},
        NOW()
      )
      ON CONFLICT (case_id) DO UPDATE SET
        health_score       = EXCLUDED.health_score,
        grade              = EXCLUDED.grade,
        risks              = EXCLUDED.risks,
        missing_data       = EXCLUDED.missing_data,
        next_steps         = EXCLUDED.next_steps,
        tasks_created      = EXCLUDED.tasks_created,
        outcome_prediction = EXCLUDED.outcome_prediction,
        ai_summary         = EXCLUDED.ai_summary,
        run_at             = NOW()
    `);
  } catch (e: any) {
    console.error("[Autopilot] failed to persist case_autopilot_reports:", e?.message ?? e);
  }

  return report;
}

/* ── Ensure Table ───────────────────────────────────────── */

export async function ensureAutopilotTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS case_autopilot_reports (
        case_id            TEXT PRIMARY KEY,
        office_id          TEXT NOT NULL,
        health_score       INTEGER NOT NULL DEFAULT 0,
        grade              TEXT NOT NULL DEFAULT 'F',
        risks              JSONB NOT NULL DEFAULT '[]',
        missing_data       JSONB NOT NULL DEFAULT '[]',
        next_steps         JSONB NOT NULL DEFAULT '[]',
        tasks_created      INTEGER NOT NULL DEFAULT 0,
        outcome_prediction JSONB NOT NULL DEFAULT '{}',
        ai_summary         TEXT,
        run_at             TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_autopilot_office ON case_autopilot_reports(office_id)
    `);
  } catch (e: any) {
    console.error("[Autopilot] ensureAutopilotTable failed:", e?.message ?? e);
    throw e;
  }
}
