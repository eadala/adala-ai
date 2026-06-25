/**
 * JLWM — Recommendations Engine + Radar Engine
 * Generates deterministic recommendations and radar alerts from live data.
 * No AI required for basic generation; AI used for enrichment when requested.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callJLWMAI }            from "./jlwmAI";

const router = Router();

/* ── Recommendation Generation ───────────────────────────────── */
export async function generateRecommendations(officeId: string): Promise<number> {
  let count = 0;

  /* 1 — Overdue tasks */
  const { rows: overdueTasks } = await db.execute(sql`
    SELECT t.id, t.title, t.due_date, c.title AS case_title
    FROM   tasks t LEFT JOIN cases c ON c.id = t.case_id::text
    WHERE  t.office_id = ${officeId}
      AND  t.due_date < NOW()
      AND  t.status NOT IN ('done','completed','مكتملة')
    LIMIT 10
  `).catch(() => ({ rows: [] as any[] }));

  for (const t of overdueTasks as any[]) {
    const daysLate = Math.floor((Date.now() - new Date(t.due_date).getTime()) / 86400000);
    await db.execute(sql`
      INSERT INTO jlwm_recommendations
        (office_id, target_type, target_id, category, priority, title, body, action_items, estimated_impact, expires_at)
      VALUES
        (${officeId}, 'case', ${String(t.case_id ?? "")}, 'action',
         ${daysLate > 7 ? "critical" : "high"},
         ${"مهمة متأخرة: " + (t.title ?? "")},
         ${"المهمة " + (t.title ?? "") + " متأخرة " + daysLate + " يوم" + (t.case_title ? " في قضية " + t.case_title : "")},
         ${JSON.stringify([{ step: "راجع المهمة وحدّد سبب التأخير", done: false }, { step: "أكمل المهمة أو فوّضها", done: false }])}::jsonb,
         'تجنب تأثير التأخير على مسار القضية',
         NOW() + INTERVAL '3 days')
      ON CONFLICT DO NOTHING
    `).then(() => count++).catch(() => {});
  }

  /* 2 — Critical cases */
  const { rows: critCases } = await db.execute(sql`
    SELECT id, title, status FROM cases
    WHERE  office_id=${officeId} AND status IN ('critical','عاجلة') LIMIT 5
  `).catch(() => ({ rows: [] as any[] }));

  for (const c of critCases as any[]) {
    await db.execute(sql`
      INSERT INTO jlwm_recommendations
        (office_id, target_type, target_id, category, priority, title, body, action_items, expires_at)
      VALUES
        (${officeId}, 'case', ${String(c.id)}, 'risk', 'critical',
         ${"قضية حرجة تحتاج متابعة فورية: " + (c.title ?? "")},
         ${"القضية " + (c.title ?? "") + " في حالة حرجة. يجب التدخل الفوري."},
         ${JSON.stringify([{ step: "اجتمع مع الفريق وناقش الوضع", done: false }, { step: "ضع خطة طوارئ", done: false }])}::jsonb,
         NOW() + INTERVAL '1 day')
      ON CONFLICT DO NOTHING
    `).then(() => count++).catch(() => {});
  }

  /* 3 — Unpaid invoices */
  const { rows: overdueInv } = await db.execute(sql`
    SELECT i.id, i.invoice_number, i.total_amount, c.name AS client_name
    FROM   client_invoices i LEFT JOIN clients c ON c.id = i.client_id
    WHERE  i.office_id = ${officeId} AND i.status IN ('overdue','متأخرة') LIMIT 5
  `).catch(() => ({ rows: [] as any[] }));

  for (const inv of overdueInv as any[]) {
    await db.execute(sql`
      INSERT INTO jlwm_recommendations
        (office_id, target_type, category, priority, title, body, action_items, expires_at)
      VALUES
        (${officeId}, 'firm', 'resource', 'high',
         ${"فاتورة متأخرة: " + (inv.invoice_number ?? "") + " - " + (inv.client_name ?? "")},
         ${"فاتورة بقيمة " + Number(inv.total_amount).toLocaleString() + " ريال لم تُسدَّد للعميل " + (inv.client_name ?? "")},
         ${JSON.stringify([{ step: "تواصل مع العميل وذكّره بالفاتورة", done: false }, { step: "أرسل إشعاراً رسمياً", done: false }])}::jsonb,
         NOW() + INTERVAL '5 days')
      ON CONFLICT DO NOTHING
    `).then(() => count++).catch(() => {});
  }

  /* 4 — Upcoming hearings (< 48h) */
  const { rows: hearings } = await db.execute(sql`
    SELECT e.id, e.title, e.date, c.title AS case_title
    FROM   events e LEFT JOIN cases c ON c.id::text = e.case_id::text
    WHERE  e.office_id=${officeId}
      AND  e.type IN ('hearing','جلسة')
      AND  e.date BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
    LIMIT 5
  `).catch(() => ({ rows: [] as any[] }));

  for (const h of hearings as any[]) {
    await db.execute(sql`
      INSERT INTO jlwm_recommendations
        (office_id, target_type, category, priority, title, body, action_items, expires_at)
      VALUES
        (${officeId}, 'case', 'deadline', 'high',
         ${"جلسة قادمة خلال 48 ساعة: " + (h.case_title ?? h.title ?? "")},
         ${"لديك جلسة مجدولة الآن. تأكد من الاستعداد الكامل."},
         ${JSON.stringify([{ step: "راجع ملف القضية كاملاً", done: false }, { step: "تحضّر الوثائق والحجج", done: false }])}::jsonb,
         ${h.date})
      ON CONFLICT DO NOTHING
    `).then(() => count++).catch(() => {});
  }

  return count;
}

/* ── Radar Alert Generation ──────────────────────────────────── */
export async function generateRadarAlerts(officeId: string): Promise<number> {
  let count = 0;

  /* 1 — Missed deadlines */
  const { rows: missed } = await db.execute(sql`
    SELECT t.id, t.title, t.due_date FROM tasks t
    WHERE  t.office_id=${officeId}
      AND  t.due_date < NOW() - INTERVAL '3 days'
      AND  t.status NOT IN ('done','completed','مكتملة')
    LIMIT 5
  `).catch(() => ({ rows: [] as any[] }));

  for (const t of missed as any[]) {
    await db.execute(sql`
      INSERT INTO jlwm_radar_alerts
        (office_id, alert_type, severity, subject_type, subject_id, title, body)
      VALUES
        (${officeId}, 'deadline', 'critical', 'task', ${String(t.id)},
         ${"موعد نهائي فُوِّت: " + (t.title ?? "")},
         ${"المهمة " + (t.title ?? "") + " تجاوزت موعدها بأكثر من 3 أيام"})
      ON CONFLICT DO NOTHING
    `).then(() => count++).catch(() => {});
  }

  /* 2 — High-risk cases (no activity > 7 days) */
  const { rows: staleC } = await db.execute(sql`
    SELECT id, title FROM cases
    WHERE  office_id=${officeId}
      AND  status IN ('active','جارية')
      AND  updated_at < NOW() - INTERVAL '7 days'
    LIMIT 5
  `).catch(() => ({ rows: [] as any[] }));

  for (const c of staleC as any[]) {
    await db.execute(sql`
      INSERT INTO jlwm_radar_alerts
        (office_id, alert_type, severity, subject_type, subject_id, title, body)
      VALUES
        (${officeId}, 'risk', 'warning', 'case', ${String(c.id)},
         ${"قضية بدون نشاط: " + (c.title ?? "")},
         ${"لم يُسجَّل أي نشاط على هذه القضية منذ أكثر من أسبوع"})
      ON CONFLICT DO NOTHING
    `).then(() => count++).catch(() => {});
  }

  /* 3 — Revenue anomaly: this month < 50% of last month */
  const { rows: revRows } = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW())),0)             AS this_m,
      COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW()-INTERVAL '1 month')
                                    AND date < DATE_TRUNC('month', NOW())),0)                AS last_m
    FROM revenues WHERE office_id=${officeId}
  `).catch(() => ({ rows: [{}] }));
  const rm = (revRows[0] ?? {}) as any;
  const thisM = Number(rm.this_m ?? 0);
  const lastM = Number(rm.last_m ?? 0);
  if (lastM > 0 && thisM < lastM * 0.5) {
    await db.execute(sql`
      INSERT INTO jlwm_radar_alerts
        (office_id, alert_type, severity, subject_type, title, body)
      VALUES
        (${officeId}, 'anomaly', 'warning', 'firm',
         'انخفاض حاد في الإيرادات',
         ${"إيرادات الشهر الحالي (" + thisM.toFixed(0) + ") أقل من 50% مقارنة بالشهر الماضي (" + lastM.toFixed(0) + ")"})
      ON CONFLICT DO NOTHING
    `).then(() => count++).catch(() => {});
  }

  return count;
}

/* ── Routes ──────────────────────────────────────────────────── */

/* GET /jlwm/recommendations */
router.get("/jlwm/recommendations", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { priority, category, limit = "30" } = req.query as any;

    /* Auto-generate if none exist */
    const { rows: existing } = await db.execute(sql`
      SELECT COUNT(*) AS c FROM jlwm_recommendations
      WHERE office_id=${officeId} AND dismissed=FALSE AND (expires_at IS NULL OR expires_at > NOW())
    `);
    if (Number((existing[0] as any)?.c ?? 0) === 0) {
      await generateRecommendations(officeId).catch(() => {});
    }

    let q = sql`
      SELECT * FROM jlwm_recommendations
      WHERE  office_id=${officeId} AND dismissed=FALSE
        AND  (expires_at IS NULL OR expires_at > NOW())
      ORDER  BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
               created_at DESC
      LIMIT  ${parseInt(limit, 10)}
    `;
    if (priority) {
      q = sql`
        SELECT * FROM jlwm_recommendations
        WHERE  office_id=${officeId} AND dismissed=FALSE AND priority=${priority}
          AND  (expires_at IS NULL OR expires_at > NOW())
        ORDER  BY created_at DESC LIMIT ${parseInt(limit, 10)}
      `;
    } else if (category) {
      q = sql`
        SELECT * FROM jlwm_recommendations
        WHERE  office_id=${officeId} AND dismissed=FALSE AND category=${category}
          AND  (expires_at IS NULL OR expires_at > NOW())
        ORDER  BY created_at DESC LIMIT ${parseInt(limit, 10)}
      `;
    }

    const { rows } = await db.execute(q);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/recommendations/generate */
router.post("/jlwm/recommendations/generate", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const generated = await generateRecommendations(officeId);
    res.json({ ok: true, generated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /jlwm/recommendations/:id — mark read, applied, or dismissed */
router.patch("/jlwm/recommendations/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { id }   = req.params as { id: string };
    const { action } = req.body ?? {};   // "read" | "apply" | "dismiss"

    const updates: Record<string, boolean> = {};
    if (action === "read")    updates["is_read"]   = true;
    if (action === "apply")   updates["is_applied"] = true;
    if (action === "dismiss") updates["dismissed"]  = true;

    if (action === "read") {
      await db.execute(sql`UPDATE jlwm_recommendations SET is_read=TRUE, updated_at=NOW() WHERE id=${id} AND office_id=${officeId}`);
    } else if (action === "apply") {
      await db.execute(sql`UPDATE jlwm_recommendations SET is_applied=TRUE, is_read=TRUE, updated_at=NOW() WHERE id=${id} AND office_id=${officeId}`);
    } else if (action === "dismiss") {
      await db.execute(sql`UPDATE jlwm_recommendations SET dismissed=TRUE, updated_at=NOW() WHERE id=${id} AND office_id=${officeId}`);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/radar */
router.get("/jlwm/radar", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { severity, limit = "30" } = req.query as { severity?: string; limit?: string };

    /* Auto-generate if none */
    const { rows: existing } = await db.execute(sql`
      SELECT COUNT(*) AS c FROM jlwm_radar_alerts
      WHERE office_id=${officeId} AND is_acknowledged=FALSE AND auto_resolved=FALSE
    `);
    if (Number((existing[0] as any)?.c ?? 0) === 0) {
      await generateRadarAlerts(officeId).catch(() => {});
    }

    const q = severity
      ? sql`
          SELECT * FROM jlwm_radar_alerts
          WHERE  office_id=${officeId} AND is_acknowledged=FALSE AND auto_resolved=FALSE
            AND  severity=${severity}
          ORDER  BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                   created_at DESC LIMIT ${parseInt(limit, 10)}
        `
      : sql`
          SELECT * FROM jlwm_radar_alerts
          WHERE  office_id=${officeId} AND is_acknowledged=FALSE AND auto_resolved=FALSE
          ORDER  BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                   created_at DESC LIMIT ${parseInt(limit, 10)}
        `;

    const { rows } = await db.execute(q);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /jlwm/radar/:id/ack */
router.patch("/jlwm/radar/:id/ack", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "system";
    const { id }   = req.params as { id: string };
    await db.execute(sql`
      UPDATE jlwm_radar_alerts
      SET is_acknowledged=TRUE, acknowledged_by=${userId}, acknowledged_at=NOW(), updated_at=NOW()
      WHERE id=${id} AND office_id=${officeId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/radar/generate */
router.post("/jlwm/radar/generate", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const generated = await generateRadarAlerts(officeId);
    res.json({ ok: true, generated });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/feedback */
router.post("/jlwm/feedback", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "unknown";
    const { sourceType, sourceId, rating, wasAccurate, wasUseful, userAction, notes } = req.body ?? {};

    if (!sourceType || !sourceId)
      return res.status(400).json({ error: "sourceType و sourceId مطلوبان" });

    const { rows } = await db.execute(sql`
      INSERT INTO jlwm_feedback
        (office_id, user_id, source_type, source_id, rating, was_accurate, was_useful, user_action, notes)
      VALUES
        (${officeId}, ${userId}, ${sourceType}, ${sourceId},
         ${rating ?? null}, ${wasAccurate ?? null}, ${wasUseful ?? null},
         ${userAction ?? null}, ${notes ?? null})
      RETURNING id
    `);
    res.status(201).json({ ok: true, id: (rows[0] as any)?.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
