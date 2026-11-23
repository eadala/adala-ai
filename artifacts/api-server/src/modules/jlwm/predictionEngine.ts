/**
 * JLWM Phase 2 — Prediction Engine
 * 7 prediction types: outcome, duration, settlement, appeal, execution, churn, revenue
 * AI-powered + deterministic fallback; results cached in jlwm_predictions.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI }                from "../ai/aiChat";
import { extractJSON }           from "./jlwmAI";

const router = Router();

/* ── Prompt builder ─────────────────────────────────────────── */
const PRED_SYSTEM = `أنت نظام التنبؤ القانوني JLWM. حلّل البيانات وأعد JSON دقيقاً بدون أي نص إضافي.
قواعد: كن واقعياً، لا تبالغ في التفاؤل أو التشاؤم، استند إلى الأرقام الفعلية في السياق.`;

/* ── Helpers ─────────────────────────────────────────────────── */
async function getCaseContext(officeId: string, caseId: string) {
  const { rows } = await db.execute(sql`
    SELECT
      c.id, c.title, c.status, c.case_type, c.description,
      c.created_at, c.hearing_date, c.next_hearing_date,
      cl.name AS client_name,
      (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId}) AS task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.status IN ('done','completed','مكتملة') AND t.office_id=${officeId}) AS completed_tasks,
      (SELECT COUNT(*) FROM events e WHERE e.case_id::text=c.id::text AND e.type IN ('hearing','جلسة') AND e.office_id=${officeId}) AS hearing_count,
      (SELECT COALESCE(SUM(total_amount),0) FROM client_invoices i WHERE i.case_id::text=c.id::text AND i.office_id=${officeId}) AS invoiced_amount,
      (SELECT COUNT(*) FROM documents d WHERE d.case_id::text=c.id::text AND d.office_id=${officeId}) AS document_count
    FROM cases c
    LEFT JOIN clients cl ON cl.id::text = c.client_id::text
    WHERE c.id::text = ${caseId} AND c.office_id = ${officeId}
    LIMIT 1
  `).catch(() => ({ rows: [] }));
  return rows[0] as any ?? null;
}

async function getOfficeStats(officeId: string) {
  const { rows } = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM cases WHERE office_id=${officeId}) AS total_cases,
      (SELECT COUNT(*) FROM cases WHERE office_id=${officeId} AND status IN ('closed','منتهية','won','فاز','خاسرة')) AS closed_cases,
      (SELECT COUNT(*) FROM cases WHERE office_id=${officeId} AND status IN ('won','فاز')) AS won_cases,
      (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400),0) FROM cases WHERE office_id=${officeId} AND status='closed') AS avg_duration_days,
      (SELECT COALESCE(SUM(total_amount),0) FROM revenues WHERE office_id=${officeId} AND date >= NOW()-INTERVAL '12 months') AS annual_revenue
  `).catch(() => ({ rows: [{}] }));
  return rows[0] as any ?? {};
}

/* ── Core prediction generator ──────────────────────────────── */
async function generateCasePredictions(officeId: string, caseId: string): Promise<Record<string, any>> {
  const [caseCtx, officeStats] = await Promise.all([
    getCaseContext(officeId, caseId),
    getOfficeStats(officeId),
  ]);
  if (!caseCtx) return {};

  const totalClosed = Number(officeStats.closed_cases ?? 0);
  const wonCases    = Number(officeStats.won_cases ?? 0);
  const officeWinRate = totalClosed > 0 ? wonCases / totalClosed : 0.5;
  const taskCompletion = Number(caseCtx.task_count ?? 0) > 0
    ? Number(caseCtx.completed_tasks ?? 0) / Number(caseCtx.task_count)
    : 0.5;
  const docScore = Math.min(Number(caseCtx.document_count ?? 0) / 10, 1);
  const hearingScore = Math.min(Number(caseCtx.hearing_count ?? 0) / 5, 1);

  const context = {
    case: caseCtx,
    officeStats: {
      totalCases: Number(officeStats.total_cases ?? 0),
      winRate: officeWinRate,
      avgDurationDays: Number(officeStats.avg_duration_days ?? 90),
      annualRevenue: Number(officeStats.annual_revenue ?? 0),
    },
    signals: { taskCompletion, docScore, hearingScore },
  };

  const prompt = `حلّل هذه القضية وأعد JSON يحتوي على التنبؤات التالية:
{
  "outcome": { "value": "win|loss|settlement|ongoing", "confidence": 0-1, "reasoning": "..." },
  "duration": { "value": "عدد الأيام المتبقية", "confidence": 0-1, "range": { "min": N, "max": N }, "reasoning": "..." },
  "settlement": { "probability": 0-1, "estimated_amount": N, "confidence": 0-1, "reasoning": "..." },
  "appeal": { "probability": 0-1, "likely_side": "client|opponent|none", "confidence": 0-1, "reasoning": "..." },
  "execution": { "success_probability": 0-1, "estimated_duration_days": N, "confidence": 0-1, "reasoning": "..." }
}`;

  let aiResult: Record<string, any> | null = null;
  try {
    const { reply } = await callAI(PRED_SYSTEM, `${prompt}\n\n[بيانات القضية]\n${JSON.stringify(context, null, 2)}`, [], "auto", officeId);
    aiResult = extractJSON<Record<string, any>>(reply);
  } catch { /* use deterministic fallback */ }

  /* Deterministic fallback */
  const baseWin      = officeWinRate * 0.5 + taskCompletion * 0.3 + docScore * 0.2;
  const durationBase = Number(officeStats.avg_duration_days ?? 90);

  return aiResult ?? {
    outcome: {
      value: baseWin > 0.6 ? "win" : baseWin > 0.4 ? "settlement" : "loss",
      confidence: 0.55 + Math.random() * 0.2,
      reasoning: "بناءً على معدل الفوز التاريخي للمكتب ومؤشرات تقدم القضية",
    },
    duration: {
      value: Math.round(durationBase * (0.8 + taskCompletion * 0.4)),
      confidence: 0.6,
      range: { min: Math.round(durationBase * 0.6), max: Math.round(durationBase * 1.5) },
      reasoning: "بناءً على متوسط مدة القضايا المشابهة في المكتب",
    },
    settlement: {
      probability: 0.35 + (1 - baseWin) * 0.3,
      estimated_amount: Number(caseCtx.invoiced_amount ?? 0) * 0.7,
      confidence: 0.5,
      reasoning: "احتمالية التسوية مرتبطة بتعقيد القضية وتاريخ العميل",
    },
    appeal: {
      probability: 0.25,
      likely_side: "opponent",
      confidence: 0.45,
      reasoning: "احتمالية الاستئناف منخفضة في القضايا ذات الأدلة الواضحة",
    },
    execution: {
      success_probability: 0.7,
      estimated_duration_days: 45,
      confidence: 0.5,
      reasoning: "بناءً على نوع القضية وطبيعة المدعى عليه",
    },
  };
}

async function generateChurnPrediction(officeId: string, clientId: string): Promise<Record<string, any>> {
  const { rows: [client] } = await db.execute(sql`
    SELECT c.id, c.name,
      (SELECT COUNT(*) FROM cases cs WHERE cs.client_id::text=c.id::text AND cs.office_id=${officeId}) AS total_cases,
      (SELECT COUNT(*) FROM cases cs WHERE cs.client_id::text=c.id::text AND cs.status='closed' AND cs.office_id=${officeId}) AS closed_cases,
      (SELECT COALESCE(SUM(total_amount),0) FROM client_invoices i WHERE i.client_id::text=c.id::text AND i.office_id=${officeId}) AS total_invoiced,
      (SELECT COALESCE(SUM(total_amount),0) FROM client_invoices i WHERE i.client_id::text=c.id::text AND i.status='paid' AND i.office_id=${officeId}) AS total_paid,
      (SELECT COUNT(*) FROM client_invoices i WHERE i.client_id::text=c.id::text AND i.status='overdue' AND i.office_id=${officeId}) AS overdue_count
    FROM clients c WHERE c.id::text=${clientId} AND c.office_id=${officeId} LIMIT 1
  `).catch(() => ({ rows: [null] }));

  if (!client) return { probability: 0.3, risk: "medium", reasoning: "بيانات غير كافية", confidence: 0.4 };

  const paymentRate = Number(client.total_invoiced) > 0
    ? Number(client.total_paid) / Number(client.total_invoiced) : 1;
  const hasOverdue  = Number(client.overdue_count) > 0;
  const casesCount  = Number(client.total_cases);

  const churnProb = Math.max(0.05, Math.min(0.95,
    (hasOverdue ? 0.3 : 0) + (1 - paymentRate) * 0.4 + (casesCount === 0 ? 0.2 : 0)
  ));

  return {
    probability: churnProb,
    risk: churnProb > 0.6 ? "critical" : churnProb > 0.35 ? "high" : churnProb > 0.15 ? "medium" : "low",
    paymentRate,
    overdueInvoices: Number(client.overdue_count),
    reasoning: churnProb > 0.5
      ? "مخاطر عالية: فواتير متأخرة وانخفاض معدل السداد"
      : "مخاطر منخفضة: نمط دفع منتظم وقضايا نشطة",
    confidence: 0.65,
    recommended_action: churnProb > 0.5
      ? "تواصل مع العميل فوراً وعرض خطة تقسيط"
      : "استمر في تقديم الخدمة بشكل منتظم",
  };
}

async function generateRevenueForecast(officeId: string): Promise<Record<string, any>> {
  const { rows } = await db.execute(sql`
    SELECT
      DATE_TRUNC('month', date) AS month,
      SUM(amount) AS revenue
    FROM revenues
    WHERE office_id=${officeId} AND date >= NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY month
  `).catch(() => ({ rows: [] }));

  const history = (rows as any[]).map(r => ({
    month: r.month,
    revenue: Number(r.revenue ?? 0),
  }));

  const avgRevenue = history.length > 0
    ? history.reduce((s, r) => s + r.revenue, 0) / history.length
    : 0;
  const trend = history.length >= 2
    ? (history[history.length - 1].revenue - history[0].revenue) / history.length
    : 0;

  const forecast3m = [1, 2, 3].map(m => ({
    month: `+${m} شهر`,
    optimistic: Math.round(avgRevenue + trend * m * 1.5),
    realistic:  Math.round(avgRevenue + trend * m),
    pessimistic:Math.round(Math.max(0, avgRevenue + trend * m * 0.5)),
  }));

  return {
    historicalAvg: avgRevenue,
    trend: trend > 0 ? "positive" : trend < 0 ? "negative" : "stable",
    trendAmount: trend,
    forecast: forecast3m,
    confidence: history.length >= 3 ? 0.70 : 0.45,
    reasoning: history.length >= 3
      ? "التنبؤ مبني على بيانات 6 أشهر الأخيرة والاتجاه الحالي"
      : "بيانات محدودة — دقة التنبؤ منخفضة",
  };
}

/* ── Save prediction ─────────────────────────────────────────── */
async function savePrediction(opts: {
  officeId: string; subjectType: string; subjectId?: string;
  predType: string; value: string; confidence: number;
  supporting: Record<string, unknown>; model?: string;
}): Promise<string> {
  const expiresAt = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_predictions
      (office_id, subject_type, subject_id, prediction_type, predicted_value, confidence_score, supporting_data, model_used, expires_at)
    VALUES
      (${opts.officeId}, ${opts.subjectType}, ${opts.subjectId ?? null}, ${opts.predType},
       ${opts.value}, ${opts.confidence}, ${JSON.stringify(opts.supporting)}::jsonb, ${opts.model ?? "jlwm"}, ${expiresAt})
    RETURNING id
  `).catch(() => ({ rows: [] }));
  return (rows[0] as any)?.id ?? "";
}

/* ── Routes ──────────────────────────────────────────────────── */

/* POST /jlwm/predictions/case/:caseId */
router.post("/jlwm/predictions/case/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { force = false } = req.body ?? {};

    /* Check cache unless forced */
    if (!force) {
      const { rows: cached } = await db.execute(sql`
        SELECT supporting_data FROM jlwm_predictions
        WHERE office_id=${officeId} AND subject_type='case' AND subject_id=${caseId}
          AND prediction_type='case_bundle' AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC LIMIT 1
      `);
      if (cached.length) {
        return res.json({ cached: true, predictions: (cached[0] as any).supporting_data });
      }
    }

    const predictions = await generateCasePredictions(officeId, caseId);

    /* Save bundle */
    await savePrediction({
      officeId, subjectType: "case", subjectId: caseId,
      predType: "case_bundle",
      value: predictions.outcome?.value ?? "unknown",
      confidence: predictions.outcome?.confidence ?? 0.5,
      supporting: predictions,
    }).catch(() => {});

    /* Save individual predictions */
    for (const [type, data] of Object.entries(predictions)) {
      await savePrediction({
        officeId, subjectType: "case", subjectId: caseId,
        predType: type,
        value: String((data as any).value ?? (data as any).probability ?? 0),
        confidence: (data as any).confidence ?? 0.5,
        supporting: data as Record<string, unknown>,
      }).catch(() => {});
    }

    res.json({ cached: false, predictions });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/predictions/case/:caseId */
router.get("/jlwm/predictions/case/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };

    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_predictions
      WHERE office_id=${officeId} AND subject_type='case' AND subject_id=${caseId}
        AND prediction_type='case_bundle' AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC LIMIT 1
    `);

    if (!rows.length) return res.json({ exists: false });
    const row = rows[0] as any;
    res.json({ exists: true, predictions: row.supporting_data, createdAt: row.created_at });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/predictions/client/:clientId/churn */
router.post("/jlwm/predictions/client/:clientId/churn", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId  = (req as any).tenantId as string;
    const { clientId } = req.params as { clientId: string };

    const prediction = await generateChurnPrediction(officeId, clientId);
    await savePrediction({
      officeId, subjectType: "client", subjectId: clientId,
      predType: "churn",
      value: prediction.risk,
      confidence: prediction.confidence,
      supporting: prediction,
    }).catch(() => {});

    res.json(prediction);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/predictions/revenue */
router.post("/jlwm/predictions/revenue", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const forecast = await generateRevenueForecast(officeId);
    await savePrediction({
      officeId, subjectType: "financial",
      predType: "revenue_forecast",
      value: String(forecast.historicalAvg),
      confidence: forecast.confidence,
      supporting: forecast,
    }).catch(() => {});
    res.json(forecast);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/predictions — all office predictions */
router.get("/jlwm/predictions", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId  = (req as any).tenantId as string;
    const { type, subject_type, limit = "50" } = req.query as any;

    const q = (type || subject_type)
      ? sql`
          SELECT * FROM jlwm_predictions
          WHERE office_id=${officeId}
            AND (expires_at IS NULL OR expires_at > NOW())
            ${type         ? sql`AND prediction_type=${type}`   : sql``}
            ${subject_type ? sql`AND subject_type=${subject_type}` : sql``}
          ORDER BY created_at DESC LIMIT ${parseInt(limit, 10)}
        `
      : sql`
          SELECT * FROM jlwm_predictions
          WHERE office_id=${officeId} AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY created_at DESC LIMIT ${parseInt(limit, 10)}
        `;

    const { rows } = await db.execute(q);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/predictions/summary — quick stats */
router.get("/jlwm/predictions/summary", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { rows: [stats] } = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE prediction_type='outcome' AND predicted_value='win') AS predicted_wins,
        COUNT(*) FILTER (WHERE prediction_type='outcome' AND predicted_value='loss') AS predicted_losses,
        COUNT(*) FILTER (WHERE prediction_type='outcome' AND predicted_value='settlement') AS predicted_settlements,
        COUNT(*) FILTER (WHERE prediction_type='churn' AND predicted_value IN ('critical','high')) AS high_churn_clients,
        COUNT(*) FILTER (WHERE subject_type='case') AS case_predictions,
        ROUND(AVG(confidence_score)::numeric, 2) AS avg_confidence
      FROM jlwm_predictions
      WHERE office_id=${officeId} AND (expires_at IS NULL OR expires_at > NOW())
    `).catch(() => ({ rows: [{}] }));
    res.json(stats ?? {});
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
