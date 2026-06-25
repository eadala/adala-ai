/**
 * JLWM Reliability & Trust Layer
 * 9 components:
 *  1. Prediction Accuracy Center      — jlwm_prediction_results + metrics
 *  2. Confidence Validation Engine    — per-prediction confidence metadata
 *  3. Explainable AI Layer            — structured reasoning for every output
 *  4. Recommendation Validation       — track recommendation outcomes
 *  5. Data Quality Engine             — office data quality score 0-100
 *  6. Trust Score Engine              — composite JLWM Trust Score
 *  7. AI Audit Trail                  — immutable log of every AI decision
 *  8. Executive Reliability Dashboard — aggregate view
 *  9. Continuous Learning Loop        — update weights on real outcomes
 *
 * All data is tenant-isolated via office_id.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI }                from "../ai/aiChat";
import { extractJSON }           from "./jlwmAI";

const router = Router();

/* ── DB Bootstrap ────────────────────────────────────────────── */
export async function ensureReliabilitySchema(): Promise<void> {
  /* AI Audit Trail — immutable log of every significant AI call */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_ai_audit (
      id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id      TEXT NOT NULL,
      user_id        TEXT,
      query_type     TEXT NOT NULL,
      model_used     TEXT NOT NULL,
      prompt_hash    TEXT,
      input_summary  TEXT,
      output_summary TEXT,
      confidence     FLOAT,
      evidence_count INT  DEFAULT 0,
      data_quality   FLOAT,
      duration_ms    INT,
      tier           TEXT,
      tokens_est     INT,
      viewed_by      TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jaa_office ON jlwm_ai_audit(office_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jaa_type  ON jlwm_ai_audit(office_id, query_type, created_at DESC)`).catch(() => {});

  /* Trust Score Snapshots — computed periodically */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_trust_scores (
      id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id            TEXT NOT NULL,
      trust_score          FLOAT NOT NULL DEFAULT 0,
      prediction_accuracy  FLOAT NOT NULL DEFAULT 0,
      data_quality         FLOAT NOT NULL DEFAULT 0,
      recommendation_success FLOAT NOT NULL DEFAULT 0,
      stability_score      FLOAT NOT NULL DEFAULT 0,
      audit_completeness   FLOAT NOT NULL DEFAULT 0,
      label                TEXT NOT NULL DEFAULT 'غير محدد',
      breakdown            JSONB NOT NULL DEFAULT '{}',
      computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jts_office ON jlwm_trust_scores(office_id, computed_at DESC)`).catch(() => {});

  /* Recommendation Tracking — follow up on JLWM recommendations */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_recommendation_tracking (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id       TEXT NOT NULL,
      recommendation_id TEXT,
      title           TEXT NOT NULL,
      category        TEXT,
      was_applied     BOOLEAN,
      outcome_improved BOOLEAN,
      risk_reduced    BOOLEAN,
      success_score   FLOAT,
      notes           TEXT,
      applied_at      TIMESTAMPTZ,
      measured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jrt_office ON jlwm_recommendation_tracking(office_id)`).catch(() => {});

  /* Data Quality Snapshots — periodic scans */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_data_quality (
      id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id            TEXT NOT NULL,
      overall_score        FLOAT NOT NULL DEFAULT 0,
      cases_score          FLOAT NOT NULL DEFAULT 0,
      clients_score        FLOAT NOT NULL DEFAULT 0,
      documents_score      FLOAT NOT NULL DEFAULT 0,
      tasks_score          FLOAT NOT NULL DEFAULT 0,
      sessions_score       FLOAT NOT NULL DEFAULT 0,
      breakdown            JSONB NOT NULL DEFAULT '{}',
      issues               JSONB NOT NULL DEFAULT '[]',
      computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jdq_office ON jlwm_data_quality(office_id, computed_at DESC)`).catch(() => {});

  /* Learning Events — record what was learned from closed cases */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_learning_events (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id    TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      source_id    TEXT,
      source_type  TEXT,
      pattern_key  TEXT,
      old_weight   FLOAT,
      new_weight   FLOAT,
      delta        FLOAT,
      evidence     JSONB NOT NULL DEFAULT '{}',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_jle_office ON jlwm_learning_events(office_id, created_at DESC)`).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════ */
/* COMPONENT 5 — Data Quality Engine                              */
/* ═══════════════════════════════════════════════════════════════ */
async function computeDataQuality(officeId: string): Promise<{
  overall: number; cases: number; clients: number; documents: number;
  tasks: number; sessions: number; breakdown: any; issues: any[];
}> {
  const [caseData, clientData, taskData, docData, sessionData] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE description IS NULL OR description = '')::int AS missing_desc,
        COUNT(*) FILTER (WHERE client_id IS NULL)::int AS missing_client,
        COUNT(*) FILTER (WHERE case_type IS NULL OR case_type = '')::int AS missing_type,
        COUNT(*) FILTER (WHERE status NOT IN ('closed','منتهية','won','فاز') AND updated_at < NOW()-INTERVAL '30 days')::int AS stale
      FROM cases WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE phone IS NULL OR phone = '')::int AS missing_phone,
        COUNT(*) FILTER (WHERE email IS NULL OR email = '')::int AS missing_email,
        COUNT(*) FILTER (WHERE name IS NULL OR name = '')::int AS missing_name
      FROM clients WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE due_date IS NULL)::int AS missing_due,
        COUNT(*) FILTER (WHERE status NOT IN ('done','completed','مكتملة') AND due_date < NOW())::int AS overdue,
        COUNT(*) FILTER (WHERE assigned_to IS NULL)::int AS unassigned
      FROM tasks WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total_docs,
        COUNT(DISTINCT case_id)::int AS cases_with_docs,
        (SELECT COUNT(*)::int FROM cases WHERE office_id = ${officeId} AND status NOT IN ('closed','منتهية')) AS open_cases
      FROM documents WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('closed','done') AND date < NOW()-INTERVAL '30 days')::int AS stale_sessions
      FROM events
      WHERE office_id = ${officeId} AND type IN ('hearing','جلسة','session')
    `).catch(() => ({ rows: [{}] })),
  ]);

  const c  = (caseData.rows[0] as any) ?? {};
  const cl = (clientData.rows[0] as any) ?? {};
  const t  = (taskData.rows[0] as any) ?? {};
  const d  = (docData.rows[0] as any) ?? {};
  const s  = (sessionData.rows[0] as any) ?? {};

  const issues: any[] = [];

  /* Cases score */
  const cTotal = Number(c.total ?? 0);
  let casesScore = 100;
  if (cTotal > 0) {
    const descPenalty   = (Number(c.missing_desc ?? 0)   / cTotal) * 25;
    const clientPenalty = (Number(c.missing_client ?? 0) / cTotal) * 25;
    const typePenalty   = (Number(c.missing_type ?? 0)   / cTotal) * 15;
    const stalePenalty  = (Number(c.stale ?? 0)          / cTotal) * 20;
    casesScore = Math.max(0, 100 - descPenalty - clientPenalty - typePenalty - stalePenalty);
    if (Number(c.missing_desc ?? 0) > 0)   issues.push({ category: "cases", severity: "medium", message: `${c.missing_desc} قضية بدون وصف` });
    if (Number(c.missing_client ?? 0) > 0) issues.push({ category: "cases", severity: "high",   message: `${c.missing_client} قضية بدون عميل مرتبط` });
    if (Number(c.stale ?? 0) > 0)          issues.push({ category: "cases", severity: "medium", message: `${c.stale} قضية لم تُحدَّث منذ 30 يوماً` });
  }

  /* Clients score */
  const clTotal = Number(cl.total ?? 0);
  let clientsScore = 100;
  if (clTotal > 0) {
    const phonePenalty = (Number(cl.missing_phone ?? 0) / clTotal) * 30;
    const namePenalty  = (Number(cl.missing_name ?? 0)  / clTotal) * 50;
    clientsScore = Math.max(0, 100 - phonePenalty - namePenalty);
    if (Number(cl.missing_phone ?? 0) > 0) issues.push({ category: "clients", severity: "low",  message: `${cl.missing_phone} عميل بدون رقم هاتف` });
  }

  /* Documents score */
  const openCases    = Number(d.open_cases ?? 0);
  const casesWithDoc = Number(d.cases_with_docs ?? 0);
  const docsScore    = openCases > 0 ? Math.min(100, (casesWithDoc / openCases) * 100) : 100;
  if (openCases > 0 && casesWithDoc < openCases) {
    issues.push({ category: "documents", severity: "medium", message: `${openCases - casesWithDoc} قضية بدون مستندات مرفقة` });
  }

  /* Tasks score */
  const tTotal = Number(t.total ?? 0);
  let tasksScore = 100;
  if (tTotal > 0) {
    const missingDue  = (Number(t.missing_due ?? 0)  / tTotal) * 30;
    const overdue     = (Number(t.overdue ?? 0)       / tTotal) * 40;
    const unassigned  = (Number(t.unassigned ?? 0)    / tTotal) * 20;
    tasksScore = Math.max(0, 100 - missingDue - overdue - unassigned);
    if (Number(t.overdue ?? 0) > 0)    issues.push({ category: "tasks", severity: "high",   message: `${t.overdue} مهمة متأخرة عن موعدها` });
    if (Number(t.unassigned ?? 0) > 0) issues.push({ category: "tasks", severity: "medium", message: `${t.unassigned} مهمة بدون مسؤول` });
  }

  /* Sessions score */
  const sTotal = Number(s.total ?? 0);
  const sessionsScore = sTotal > 0
    ? Math.max(0, 100 - (Number(s.stale_sessions ?? 0) / sTotal) * 50)
    : 100;
  if (Number(s.stale_sessions ?? 0) > 0) {
    issues.push({ category: "sessions", severity: "medium", message: `${s.stale_sessions} جلسة غير محدثة منذ 30 يوماً` });
  }

  const overall = Math.round(
    (casesScore * 0.35 + clientsScore * 0.20 + docsScore * 0.20 + tasksScore * 0.15 + sessionsScore * 0.10)
  );

  return {
    overall, cases: Math.round(casesScore), clients: Math.round(clientsScore),
    documents: Math.round(docsScore), tasks: Math.round(tasksScore),
    sessions: Math.round(sessionsScore),
    breakdown: { cases: c, clients: cl, tasks: t, documents: d, sessions: s },
    issues,
  };
}

/* ═══════════════════════════════════════════════════════════════ */
/* COMPONENT 6 — Trust Score Engine                               */
/* ═══════════════════════════════════════════════════════════════ */
async function computeTrustScore(officeId: string): Promise<{
  score: number; label: string; prediction_accuracy: number;
  data_quality: number; recommendation_success: number;
  stability: number; audit_completeness: number; breakdown: any;
}> {
  const [accRow, recRow, auditRow, dq] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(AVG(accuracy_score),0)::float AS avg_accuracy,
        COALESCE(STDDEV(accuracy_score),0)::float AS std_dev,
        COUNT(*)::int AS total
      FROM jlwm_accuracy_records WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{ avg_accuracy: 0, std_dev: 0, total: 0 }] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE was_applied = true)::int AS applied,
        COUNT(*) FILTER (WHERE outcome_improved = true)::int AS improved,
        COALESCE(AVG(success_score),0)::float AS avg_success
      FROM jlwm_recommendation_tracking WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{ total: 0, applied: 0, improved: 0, avg_success: 0 }] })),

    db.execute(sql`
      SELECT COUNT(*)::int AS audit_count FROM jlwm_ai_audit WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{ audit_count: 0 }] })),

    computeDataQuality(officeId),
  ]);

  const acc = (accRow.rows[0] as any) ?? {};
  const rec = (recRow.rows[0] as any) ?? {};
  const aud = (auditRow.rows[0] as any) ?? {};

  const predAcc = Math.round(Number(acc.avg_accuracy ?? 0) * 100);
  const stdDev  = Number(acc.std_dev ?? 0);
  const stability = Math.round(Math.max(0, 100 - stdDev * 200));

  const recTotal = Number(rec.total ?? 0);
  const recSuccess = recTotal > 0
    ? Math.round(Number(rec.avg_success ?? 0) * 100)
    : 50;

  const auditCompleteness = Math.min(100, Number(aud.audit_count ?? 0) * 2);

  /* Weighted composite */
  const score = Math.round(
    predAcc        * 0.35 +
    dq.overall     * 0.25 +
    recSuccess     * 0.20 +
    stability      * 0.10 +
    auditCompleteness * 0.10
  );

  const label = score >= 85 ? "موثوق جداً"
    : score >= 70 ? "موثوق"
    : score >= 55 ? "قيد التحسين"
    : "يحتاج مراجعة";

  return {
    score, label,
    prediction_accuracy: predAcc,
    data_quality: dq.overall,
    recommendation_success: recSuccess,
    stability,
    audit_completeness: auditCompleteness,
    breakdown: {
      accuracy_records: Number(acc.total ?? 0),
      recommendation_records: recTotal,
      audit_records: Number(aud.audit_count ?? 0),
      accuracy_std_dev: Math.round(stdDev * 100) / 100,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════ */
/* COMPONENT 3 — Explainable AI                                   */
/* ═══════════════════════════════════════════════════════════════ */
async function buildExplanation(officeId: string, type: string, entityId: string) {
  const pred = await db.execute(sql`
    SELECT predictions, supporting_data, computed_at
    FROM jlwm_predictions
    WHERE office_id = ${officeId} AND case_id = ${entityId}
    ORDER BY computed_at DESC LIMIT 1
  `).catch(() => ({ rows: [] }));

  const caseCtx = await db.execute(sql`
    SELECT c.title, c.status, c.case_type, c.description,
      (SELECT COUNT(*) FROM documents d WHERE d.case_id::text=c.id::text AND d.office_id=${officeId})::int AS doc_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId} AND t.status NOT IN ('done','completed','مكتملة') AND t.due_date < NOW())::int AS overdue_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId})::int AS task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId} AND t.status IN ('done','completed','مكتملة'))::int AS done_tasks
    FROM cases c
    WHERE c.id::text = ${entityId} AND c.office_id = ${officeId}
    LIMIT 1
  `).catch(() => ({ rows: [] }));

  const ctx = (caseCtx.rows[0] as any) ?? {};
  const p   = (pred.rows[0] as any) ?? {};
  const predictions = typeof p.predictions === "object" ? p.predictions : {};

  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  if (Number(ctx.doc_count ?? 0) >= 5)       positiveFactors.push("وثائق كافية مرفقة بالقضية");
  else if (Number(ctx.doc_count ?? 0) === 0)  negativeFactors.push("لا توجد مستندات مرفقة بالقضية");
  else                                          negativeFactors.push("نقص في المستندات الداعمة");

  if (Number(ctx.task_count ?? 0) > 0) {
    const completionRate = Number(ctx.done_tasks ?? 0) / Number(ctx.task_count);
    if (completionRate >= 0.8)        positiveFactors.push("نسبة إنجاز المهام مرتفعة");
    else if (completionRate < 0.4)    negativeFactors.push("نسبة إنجاز المهام منخفضة");
  }

  if (Number(ctx.overdue_tasks ?? 0) > 0) {
    negativeFactors.push(`${ctx.overdue_tasks} مهمة متأخرة تؤثر سلباً على تقييم القضية`);
  }

  if (ctx.case_type) positiveFactors.push(`نوع القضية "${ctx.case_type}" مصنّف في النظام`);
  if (!ctx.description || ctx.description.length < 50) {
    negativeFactors.push("وصف القضية غير كافٍ لتحليل دقيق");
  }

  const winProb = predictions?.outcome?.win_probability ?? null;
  const confidence = positiveFactors.length > negativeFactors.length ? "مرتفعة"
    : positiveFactors.length === negativeFactors.length ? "متوسطة" : "منخفضة";

  return {
    entity_id: entityId,
    entity_title: ctx.title ?? entityId,
    prediction_type: type,
    win_probability: winProb,
    confidence_level: confidence,
    evidence_count: (positiveFactors.length + negativeFactors.length),
    data_quality_pct: Math.min(100, Number(ctx.doc_count ?? 0) * 10 + 30),
    positive_factors: positiveFactors,
    negative_factors: negativeFactors,
    summary: positiveFactors.length >= negativeFactors.length
      ? "ملف القضية يدعم توقعات إيجابية بشكل عام"
      : "الملف يحتاج تحسيناً قبل الوثوق الكامل بالتوقعات",
  };
}

/* ═══════════════════════════════════════════════════════════════ */
/* COMPONENT 9 — Continuous Learning Loop                         */
/* ═══════════════════════════════════════════════════════════════ */
async function runLearningLoop(officeId: string): Promise<{ updated: number; events: any[] }> {
  /* Find closed cases with accuracy records */
  const { rows: closedWithAcc } = await db.execute(sql`
    SELECT
      c.id AS case_id, c.status, c.case_type,
      ar.prediction_type, ar.accuracy_score, ar.actual_value
    FROM cases c
    JOIN jlwm_accuracy_records ar ON ar.case_id = c.id::text AND ar.office_id = ${officeId}
    WHERE c.office_id = ${officeId}
      AND c.status IN ('closed','منتهية','won','فاز','lost','خاسرة')
      AND ar.created_at >= NOW()-INTERVAL '90 days'
    ORDER BY ar.created_at DESC
    LIMIT 30
  `).catch(() => ({ rows: [] }));

  if (!closedWithAcc.length) return { updated: 0, events: [] };

  /* Aggregate learning patterns by case_type + prediction_type */
  const patterns: Record<string, { sum: number; count: number; type: string; ptype: string }> = {};
  for (const r of closedWithAcc as any[]) {
    const key = `${r.case_type ?? "general"}::${r.prediction_type}`;
    if (!patterns[key]) patterns[key] = { sum: 0, count: 0, type: r.case_type ?? "general", ptype: r.prediction_type };
    patterns[key].sum += Number(r.accuracy_score ?? 0);
    patterns[key].count += 1;
  }

  const events: any[] = [];
  for (const [key, p] of Object.entries(patterns)) {
    const newWeight = p.sum / p.count;
    const { rows: existing } = await db.execute(sql`
      SELECT new_weight FROM jlwm_learning_events
      WHERE office_id = ${officeId} AND pattern_key = ${key}
      ORDER BY created_at DESC LIMIT 1
    `).catch(() => ({ rows: [] }));
    const oldWeight = (existing[0] as any)?.new_weight ?? 0.5;
    const delta = newWeight - oldWeight;

    if (Math.abs(delta) > 0.01) {
      await db.execute(sql`
        INSERT INTO jlwm_learning_events
          (office_id, event_type, pattern_key, old_weight, new_weight, delta, evidence)
        VALUES
          (${officeId}, 'accuracy_update', ${key}, ${oldWeight}, ${newWeight}, ${delta},
           ${JSON.stringify({ case_type: p.type, prediction_type: p.ptype, sample_size: p.count })}::jsonb)
      `).catch(() => {});
      events.push({ key, old: Math.round(oldWeight * 100), new: Math.round(newWeight * 100), delta: Math.round(delta * 100) });
    }
  }

  return { updated: events.length, events };
}

/* ═══════════════════════════════════════════════════════════════ */
/* ROUTES                                                          */
/* ═══════════════════════════════════════════════════════════════ */

/* 7 — AI Audit Trail: log a decision */
router.post("/jlwm/reliability/audit", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const userId   = (req as any).auth?.userId as string | undefined;
  const {
    queryType, modelUsed, inputSummary, outputSummary,
    confidence, evidenceCount, dataQuality, durationMs, tier,
  } = req.body as any;

  if (!queryType || !modelUsed) return res.status(400).json({ error: "queryType, modelUsed مطلوبان" });

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_ai_audit
      (office_id, user_id, query_type, model_used, input_summary, output_summary,
       confidence, evidence_count, data_quality, duration_ms, tier, viewed_by)
    VALUES
      (${officeId}, ${userId ?? null}, ${queryType}, ${modelUsed},
       ${inputSummary ?? null}, ${outputSummary ?? null},
       ${confidence ?? null}, ${evidenceCount ?? 0},
       ${dataQuality ?? null}, ${durationMs ?? null}, ${tier ?? null}, ${userId ?? null})
    RETURNING id, created_at
  `).catch((e: any) => { throw e; });

  res.json({ ok: true, id: (rows[0] as any)?.id });
});

/* 7 — AI Audit Trail: list */
router.get("/jlwm/reliability/audit", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const limit    = Math.min(Number(req.query.limit ?? 30), 100);
  const type     = req.query.type as string | undefined;

  const { rows } = await db.execute(sql`
    SELECT id, query_type, model_used, input_summary, output_summary,
           confidence, evidence_count, data_quality, duration_ms, tier, created_at
    FROM jlwm_ai_audit
    WHERE office_id = ${officeId}
      ${type ? sql`AND query_type = ${type}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `).catch(() => ({ rows: [] }));

  const { rows: stats } = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      ROUND(AVG(duration_ms)::numeric) AS avg_duration_ms,
      ROUND(AVG(confidence)::numeric, 2) AS avg_confidence,
      COUNT(DISTINCT model_used)::int AS models_used,
      COUNT(DISTINCT query_type)::int AS query_types,
      model_used AS top_model
    FROM jlwm_ai_audit WHERE office_id = ${officeId}
    GROUP BY model_used ORDER BY COUNT(*) DESC LIMIT 1
  `).catch(() => ({ rows: [{}] }));

  res.json({ audit: rows, stats: stats[0] ?? {} });
});

/* 5 — Data Quality */
router.get("/jlwm/reliability/data-quality", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const refresh  = req.query.refresh === "1";

  if (!refresh) {
    const { rows: cached } = await db.execute(sql`
      SELECT * FROM jlwm_data_quality
      WHERE office_id = ${officeId}
        AND computed_at >= NOW()-INTERVAL '6 hours'
      ORDER BY computed_at DESC LIMIT 1
    `).catch(() => ({ rows: [] }));
    if (cached.length) return res.json(cached[0]);
  }

  const dq = await computeDataQuality(officeId);

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_data_quality
      (office_id, overall_score, cases_score, clients_score, documents_score,
       tasks_score, sessions_score, breakdown, issues)
    VALUES
      (${officeId}, ${dq.overall}, ${dq.cases}, ${dq.clients}, ${dq.documents},
       ${dq.tasks}, ${dq.sessions},
       ${JSON.stringify(dq.breakdown)}::jsonb, ${JSON.stringify(dq.issues)}::jsonb)
    RETURNING *
  `).catch(() => ({ rows: [dq] }));

  res.json(rows[0] ?? dq);
});

/* 6 — Trust Score */
router.get("/jlwm/reliability/trust-score", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const refresh  = req.query.refresh === "1";

  if (!refresh) {
    const { rows: cached } = await db.execute(sql`
      SELECT * FROM jlwm_trust_scores
      WHERE office_id = ${officeId}
        AND computed_at >= NOW()-INTERVAL '2 hours'
      ORDER BY computed_at DESC LIMIT 1
    `).catch(() => ({ rows: [] }));
    if (cached.length) return res.json(cached[0]);
  }

  const ts = await computeTrustScore(officeId);

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_trust_scores
      (office_id, trust_score, prediction_accuracy, data_quality, recommendation_success,
       stability_score, audit_completeness, label, breakdown)
    VALUES
      (${officeId}, ${ts.score}, ${ts.prediction_accuracy}, ${ts.data_quality},
       ${ts.recommendation_success}, ${ts.stability}, ${ts.audit_completeness},
       ${ts.label}, ${JSON.stringify(ts.breakdown)}::jsonb)
    RETURNING *
  `).catch(() => ({ rows: [ts] }));

  res.json(rows[0] ?? ts);
});

/* Trust score history */
router.get("/jlwm/reliability/trust-score/history", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const { rows } = await db.execute(sql`
    SELECT trust_score, label, prediction_accuracy, data_quality,
           recommendation_success, stability_score, computed_at
    FROM jlwm_trust_scores
    WHERE office_id = ${officeId}
    ORDER BY computed_at DESC
    LIMIT 30
  `).catch(() => ({ rows: [] }));
  res.json({ history: rows });
});

/* 3 — Explainability */
router.get("/jlwm/reliability/explain/:type/:entityId", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const type     = String(req.params.type);
  const entityId = String(req.params.entityId);
  const explanation = await buildExplanation(officeId, type, entityId);
  res.json(explanation);
});

/* 2 — Confidence Validation: get rich metadata for a prediction */
router.get("/jlwm/reliability/confidence/:caseId", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const caseId   = String(req.params.caseId);

  const [predRow, docCount, taskStats, hearingCount] = await Promise.all([
    db.execute(sql`
      SELECT predictions, computed_at FROM jlwm_predictions
      WHERE office_id = ${officeId} AND case_id = ${caseId}
      ORDER BY computed_at DESC LIMIT 1
    `).catch(() => ({ rows: [] })),

    db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM documents
      WHERE office_id = ${officeId} AND case_id::text = ${caseId}
    `).catch(() => ({ rows: [{ cnt: 0 }] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('done','completed','مكتملة'))::int AS done
      FROM tasks WHERE office_id = ${officeId} AND case_id::text = ${caseId}
    `).catch(() => ({ rows: [{ total: 0, done: 0 }] })),

    db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM events
      WHERE office_id = ${officeId} AND case_id::text = ${caseId}
        AND type IN ('hearing','جلسة')
    `).catch(() => ({ rows: [{ cnt: 0 }] })),
  ]);

  const pred    = (predRow.rows[0] as any) ?? {};
  const docs    = Number((docCount.rows[0] as any)?.cnt ?? 0);
  const tasks   = (taskStats.rows[0] as any) ?? {};
  const hearings = Number((hearingCount.rows[0] as any)?.cnt ?? 0);

  const evidence = docs + Number(tasks.total ?? 0) + hearings;
  const dataQuality = Math.min(100, docs * 8 + Number(tasks.done ?? 0) * 5 + hearings * 10 + 20);
  const confidence_level = dataQuality >= 80 ? "مرتفعة" : dataQuality >= 50 ? "متوسطة" : "منخفضة";

  const predictions = typeof pred.predictions === "object" ? pred.predictions : {};

  res.json({
    case_id: caseId,
    predictions,
    confidence_level,
    confidence_pct: dataQuality,
    data_quality_pct: dataQuality,
    evidence_count: evidence,
    breakdown: {
      documents: docs,
      tasks_total: Number(tasks.total ?? 0),
      tasks_done: Number(tasks.done ?? 0),
      hearings,
    },
    last_computed: pred.computed_at ?? null,
  });
});

/* 4 — Recommendation Tracking: record outcome */
router.post("/jlwm/reliability/track-recommendation", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const {
    recommendationId, title, category,
    wasApplied, outcomeImproved, riskReduced, notes,
  } = req.body as any;

  const successScore = wasApplied
    ? (outcomeImproved ? 1 : 0.5) * (riskReduced ? 1 : 0.8)
    : 0;

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_recommendation_tracking
      (office_id, recommendation_id, title, category, was_applied,
       outcome_improved, risk_reduced, success_score, notes, applied_at)
    VALUES
      (${officeId}, ${recommendationId ?? null}, ${title ?? "توصية"},
       ${category ?? null}, ${wasApplied ?? false},
       ${outcomeImproved ?? false}, ${riskReduced ?? false},
       ${successScore}, ${notes ?? null},
       ${wasApplied ? new Date().toISOString() + "::timestamptz" : null})
    RETURNING id, success_score
  `).catch((e: any) => { throw e; });

  res.json({ ok: true, record: rows[0] });
});

/* 4 — Recommendation Tracking: list & stats */
router.get("/jlwm/reliability/recommendations", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const { rows: records } = await db.execute(sql`
    SELECT * FROM jlwm_recommendation_tracking
    WHERE office_id = ${officeId}
    ORDER BY created_at DESC LIMIT 30
  `).catch(() => ({ rows: [] }));

  const { rows: stats } = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE was_applied)::int AS applied,
      COUNT(*) FILTER (WHERE outcome_improved)::int AS improved,
      COUNT(*) FILTER (WHERE risk_reduced)::int AS risk_reduced,
      COALESCE(AVG(success_score),0)::float AS avg_success
    FROM jlwm_recommendation_tracking WHERE office_id = ${officeId}
  `).catch(() => ({ rows: [{}] }));

  res.json({ records, stats: stats[0] ?? {} });
});

/* 9 — Continuous Learning Loop */
router.post("/jlwm/reliability/learn", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const result   = await runLearningLoop(officeId);
  res.json({ ok: true, ...result });
});

/* Learning events history */
router.get("/jlwm/reliability/learning-events", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const { rows } = await db.execute(sql`
    SELECT pattern_key, old_weight, new_weight, delta, evidence, created_at
    FROM jlwm_learning_events
    WHERE office_id = ${officeId}
    ORDER BY created_at DESC LIMIT 50
  `).catch(() => ({ rows: [] }));
  res.json({ events: rows });
});

/* 8 — Executive Reliability Dashboard */
router.get("/jlwm/reliability/dashboard", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;

  const [trustScore, dqResult, accStats, auditStats, recStats, learningStats, modelUsage] = await Promise.all([
    computeTrustScore(officeId),
    computeDataQuality(officeId),
    db.execute(sql`
      SELECT prediction_type,
        ROUND(AVG(accuracy_score)::numeric, 3) AS avg_accuracy,
        COUNT(*)::int AS count
      FROM jlwm_accuracy_records WHERE office_id = ${officeId}
      GROUP BY prediction_type
      ORDER BY avg_accuracy DESC
    `).catch(() => ({ rows: [] })),
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
        COUNT(DISTINCT model_used)::int AS models,
        ROUND(AVG(confidence)::numeric, 2) AS avg_confidence,
        ROUND(AVG(duration_ms)::numeric) AS avg_duration_ms
      FROM jlwm_ai_audit WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
        COALESCE(AVG(success_score),0)::float AS avg_success,
        COUNT(*) FILTER (WHERE was_applied)::int AS applied
      FROM jlwm_recommendation_tracking WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),
    db.execute(sql`
      SELECT COUNT(*)::int AS events,
        ROUND(AVG(ABS(delta))::numeric, 3) AS avg_delta
      FROM jlwm_learning_events WHERE office_id = ${officeId}
        AND created_at >= NOW()-INTERVAL '30 days'
    `).catch(() => ({ rows: [{}] })),
    db.execute(sql`
      SELECT model_used,
        COUNT(*)::int AS calls,
        ROUND(AVG(duration_ms)::numeric) AS avg_ms
      FROM jlwm_ai_audit WHERE office_id = ${officeId}
      GROUP BY model_used ORDER BY calls DESC LIMIT 5
    `).catch(() => ({ rows: [] })),
  ]);

  res.json({
    trust_score:   trustScore,
    data_quality:  { overall: dqResult.overall, cases: dqResult.cases, clients: dqResult.clients, documents: dqResult.documents, tasks: dqResult.tasks, sessions: dqResult.sessions, issues: dqResult.issues },
    accuracy:      { by_type: accStats.rows },
    audit:         auditStats.rows[0] ?? {},
    recommendations: recStats.rows[0] ?? {},
    learning:      learningStats.rows[0] ?? {},
    model_usage:   modelUsage.rows,
  });
});

export default router;
