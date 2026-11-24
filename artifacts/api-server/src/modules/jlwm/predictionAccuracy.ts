/**
 * JLWM Phase 3 — Prediction Accuracy Center
 * Tracks actual outcomes vs AI predictions, calculates accuracy metrics,
 * stores historical accuracy, and provides confidence calibration data.
 * All data is tenant-isolated via office_id.
 *
 * Schema authority: Migration 035 (Stage 4C).
 * ensureAccuracyTable is SELECT-only readiness (no CREATE/INDEX).
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";

const router = Router();

/* ── SELECT-only readiness (Migration 035) ───────────────────── */
export async function ensureAccuracyTable(): Promise<void> {
  const { rows } = await db.execute(sql`
    SELECT to_regclass('public.jlwm_accuracy_records') IS NOT NULL AS ok
  `).catch(() => ({ rows: [{}] }));
  if (!(rows[0] as { ok?: boolean } | undefined)?.ok) {
    console.error(
      "[JLWM] Migration 035 satellite schema not ready — missing jlwm_accuracy_records",
      "(apply artifacts/api-server/migrations/035_jlwm_satellites_schema_authority.sql)",
    );
  }
}

/* ── Helpers ─────────────────────────────────────────────────── */
function calcAccuracyScore(predicted: any, actual: any, type: string): number {
  try {
    if (type === "outcome") {
      const pWin = Number(predicted.win_probability ?? predicted.probability ?? 0.5);
      const aWon = actual.won === true || actual.result === "won" ? 1 : 0;
      return 1 - Math.abs(pWin - aWon);
    }
    if (type === "duration") {
      const pDays = Number(predicted.estimated_days ?? predicted.days ?? 90);
      const aDays = Number(actual.actual_days ?? actual.days ?? 90);
      const diff = Math.abs(pDays - aDays);
      return Math.max(0, 1 - diff / Math.max(pDays, aDays, 1));
    }
    if (type === "settlement") {
      const pProb = Number(predicted.settlement_probability ?? predicted.probability ?? 0.5);
      const aSettled = actual.settled === true ? 1 : 0;
      return 1 - Math.abs(pProb - aSettled);
    }
    if (type === "revenue") {
      const pAmt = Number(predicted.expected_revenue ?? predicted.amount ?? 0);
      const aAmt = Number(actual.actual_revenue ?? actual.amount ?? 0);
      if (pAmt === 0 && aAmt === 0) return 1;
      const diff = Math.abs(pAmt - aAmt);
      return Math.max(0, 1 - diff / Math.max(pAmt, aAmt, 1));
    }
    return 0.5;
  } catch {
    return 0.5;
  }
}

/* ── Routes ──────────────────────────────────────────────────── */

/* Record an actual outcome against a prediction */
router.post("/jlwm/accuracy/record", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const userId   = (req as any).auth?.userId as string | undefined;
  const { caseId, predictionType, predictedValue, actualValue, predictionId, notes } = req.body as {
    caseId: string; predictionType: string; predictedValue: any; actualValue: any;
    predictionId?: string; notes?: string;
  };
  if (!caseId || !predictionType || !actualValue) {
    return res.status(400).json({ error: "caseId, predictionType, actualValue مطلوبة" });
  }

  const score = calcAccuracyScore(predictedValue ?? {}, actualValue, predictionType);
  const pv    = predictedValue ?? {};
  const pWin  = Number(pv.win_probability ?? pv.probability ?? pv.settlement_probability ?? 0);
  const aVal  = actualValue;
  const aWon  = aVal.won === true || aVal.result === "won" || aVal.settled === true ? 1 : 0;
  const deviation = Math.abs(pWin - aWon);

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_accuracy_records
      (office_id, prediction_id, case_id, prediction_type, predicted_value, actual_value,
       accuracy_score, deviation, notes, recorded_by)
    VALUES
      (${officeId}, ${predictionId ?? null}, ${caseId}, ${predictionType},
       ${JSON.stringify(predictedValue ?? {})}::jsonb, ${JSON.stringify(actualValue)}::jsonb,
       ${score}, ${deviation}, ${notes ?? null}, ${userId ?? null})
    RETURNING id, accuracy_score, deviation
  `).catch((e: any) => { throw e; });

  res.json({ ok: true, record: rows[0], score });
});

/* Accuracy statistics by prediction type */
router.get("/jlwm/accuracy/stats", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const { rows } = await db.execute(sql`
    SELECT
      prediction_type,
      COUNT(*)::int                              AS total_records,
      ROUND(AVG(accuracy_score)::numeric, 3)    AS avg_accuracy,
      ROUND(MIN(accuracy_score)::numeric, 3)    AS min_accuracy,
      ROUND(MAX(accuracy_score)::numeric, 3)    AS max_accuracy,
      ROUND(AVG(deviation)::numeric, 3)         AS avg_deviation,
      ROUND(STDDEV(accuracy_score)::numeric, 3) AS std_dev,
      MAX(recorded_at)                          AS last_recorded_at
    FROM jlwm_accuracy_records
    WHERE office_id = ${officeId}
    GROUP BY prediction_type
    ORDER BY avg_accuracy DESC
  `).catch(() => ({ rows: [] }));

  const total = rows.length;
  const overall = total > 0
    ? (rows as any[]).reduce((s: number, r: any) => s + Number(r.avg_accuracy ?? 0), 0) / total
    : 0;

  res.json({ stats: rows, overall_accuracy: Math.round(overall * 1000) / 1000, total_records_types: total });
});

/* Confidence calibration: how often confidence bands were correct */
router.get("/jlwm/accuracy/calibration", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const { rows } = await db.execute(sql`
    SELECT
      CASE
        WHEN accuracy_score >= 0.9 THEN '90-100%'
        WHEN accuracy_score >= 0.7 THEN '70-89%'
        WHEN accuracy_score >= 0.5 THEN '50-69%'
        ELSE 'أقل من 50%'
      END AS accuracy_band,
      COUNT(*)::int          AS count,
      prediction_type,
      ROUND(AVG(accuracy_score)::numeric, 3) AS band_avg
    FROM jlwm_accuracy_records
    WHERE office_id = ${officeId}
    GROUP BY accuracy_band, prediction_type
    ORDER BY prediction_type, accuracy_band DESC
  `).catch(() => ({ rows: [] }));

  const summary: Record<string, any> = {};
  for (const r of rows as any[]) {
    const key = String(r.prediction_type);
    if (!summary[key]) summary[key] = [];
    summary[key].push({ band: r.accuracy_band, count: r.count, avg: r.band_avg });
  }

  res.json({ calibration: summary });
});

/* History list with pagination */
router.get("/jlwm/accuracy/history", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const limit    = Math.min(Number(req.query.limit ?? 20), 100);
  const offset   = Number(req.query.offset ?? 0);
  const type     = req.query.type as string | undefined;

  const { rows } = await db.execute(sql`
    SELECT
      a.id, a.case_id, a.prediction_type, a.predicted_value,
      a.actual_value, a.accuracy_score, a.deviation, a.notes,
      a.recorded_at,
      c.title AS case_title
    FROM jlwm_accuracy_records a
    LEFT JOIN cases c ON c.id::text = a.case_id AND c.office_id = ${officeId}
    WHERE a.office_id = ${officeId}
      ${type ? sql`AND a.prediction_type = ${type}` : sql``}
    ORDER BY a.recorded_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).catch(() => ({ rows: [] }));

  const { rows: cnt } = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM jlwm_accuracy_records
    WHERE office_id = ${officeId}
    ${type ? sql`AND prediction_type = ${type}` : sql``}
  `).catch(() => ({ rows: [{ total: 0 }] }));

  res.json({ records: rows, total: (cnt[0] as any)?.total ?? 0, limit, offset });
});

/* Trend: accuracy over time (last 30 records per type) */
router.get("/jlwm/accuracy/trend", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const { rows } = await db.execute(sql`
    SELECT
      DATE_TRUNC('week', recorded_at) AS week,
      prediction_type,
      ROUND(AVG(accuracy_score)::numeric, 3) AS avg_accuracy,
      COUNT(*)::int AS count
    FROM jlwm_accuracy_records
    WHERE office_id = ${officeId}
      AND recorded_at >= NOW() - INTERVAL '90 days'
    GROUP BY week, prediction_type
    ORDER BY week DESC, prediction_type
  `).catch(() => ({ rows: [] }));

  res.json({ trend: rows });
});

export default router;
