/**
 * JLWM Phase 3 — Legal COO (Chief Operating Officer)
 * Monitors: deadlines, litigation risks, financial anomalies.
 * Generates proactive action plans with assignment/follow-up suggestions.
 * All actions REQUIRE user approval before execution (approval workflow).
 * Fully tenant-isolated via office_id.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI }                from "../ai/aiChat";
import { extractJSON }           from "./jlwmAI";

const router = Router();

const COO_SYSTEM = `أنت المدير التشغيلي القانوني JLWM (Legal COO).
مهمتك: اكتشاف المشكلات التشغيلية قبل أن تحدث، وإنشاء خطط عمل واضحة وقابلة للتنفيذ.
كن استباقياً ودقيقاً. اقترح إجراءات محددة وعملية. أعد JSON فقط بدون أي نص إضافي.`;

/* ── DB Bootstrap ────────────────────────────────────────────── */
export async function ensureCOOTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_coo_actions (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id        TEXT NOT NULL,
      action_type      TEXT NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT NOT NULL,
      priority         TEXT NOT NULL DEFAULT 'medium',
      status           TEXT NOT NULL DEFAULT 'pending_approval',
      target_ref       JSONB NOT NULL DEFAULT '{}',
      suggested_action JSONB NOT NULL DEFAULT '{}',
      ai_reasoning     TEXT,
      approved_by      TEXT,
      approved_at      TIMESTAMPTZ,
      rejected_by      TEXT,
      rejected_at      TIMESTAMPTZ,
      reject_reason    TEXT,
      executed_at      TIMESTAMPTZ,
      execution_result JSONB,
      expires_at       TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_jca_office ON jlwm_coo_actions(office_id)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_jca_status ON jlwm_coo_actions(office_id, status)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_jca_type ON jlwm_coo_actions(office_id, action_type)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_jca_priority ON jlwm_coo_actions(office_id, priority, created_at DESC)
  `).catch(() => {});
}

/* ── Scanners ─────────────────────────────────────────────────── */

async function scanDeadlines(officeId: string) {
  const { rows } = await db.execute(sql`
    SELECT
      c.id AS case_id, c.title AS case_title,
      c.hearing_date, c.next_hearing_date,
      t.id AS task_id, t.title AS task_title, t.due_date,
      cl.name AS client_name,
      EXTRACT(EPOCH FROM (COALESCE(t.due_date, c.hearing_date) - NOW()))/3600 AS hours_remaining
    FROM cases c
    LEFT JOIN tasks t ON t.case_id::text = c.id::text AND t.office_id = ${officeId}
              AND t.status NOT IN ('done','completed','مكتملة')
              AND t.due_date IS NOT NULL
    LEFT JOIN clients cl ON cl.id::text = c.client_id::text
    WHERE c.office_id = ${officeId}
      AND c.status NOT IN ('closed','منتهية')
      AND (
        t.due_date BETWEEN NOW() AND NOW()+INTERVAL '72 hours'
        OR c.hearing_date BETWEEN NOW() AND NOW()+INTERVAL '72 hours'
        OR c.next_hearing_date BETWEEN NOW() AND NOW()+INTERVAL '72 hours'
      )
    ORDER BY hours_remaining ASC
    LIMIT 20
  `).catch(() => ({ rows: [] }));
  return rows as any[];
}

async function scanLitigationRisks(officeId: string) {
  const { rows } = await db.execute(sql`
    SELECT
      c.id, c.title, c.case_type, c.status,
      c.hearing_date, c.next_hearing_date,
      EXTRACT(EPOCH FROM (NOW() - c.updated_at))/86400 AS days_since_update,
      (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId} AND t.status NOT IN ('done','completed','مكتملة') AND t.due_date < NOW())::int AS overdue_tasks,
      (SELECT COUNT(*) FROM documents d WHERE d.case_id::text=c.id::text AND d.office_id=${officeId})::int AS doc_count,
      cl.name AS client_name
    FROM cases c
    LEFT JOIN clients cl ON cl.id::text = c.client_id::text
    WHERE c.office_id = ${officeId}
      AND c.status NOT IN ('closed','منتهية','won','فاز')
      AND (
        EXTRACT(EPOCH FROM (NOW() - c.updated_at))/86400 > 14
        OR (SELECT COUNT(*) FROM tasks t WHERE t.case_id::text=c.id::text AND t.office_id=${officeId} AND t.status NOT IN ('done','completed','مكتملة') AND t.due_date < NOW()) > 0
      )
    ORDER BY days_since_update DESC, overdue_tasks DESC
    LIMIT 15
  `).catch(() => ({ rows: [] }));
  return rows as any[];
}

async function scanFinancialAnomalies(officeId: string) {
  const { rows } = await db.execute(sql`
    SELECT
      cl.id AS client_id, cl.name AS client_name,
      COUNT(DISTINCT ci.id)::int AS invoice_count,
      COALESCE(SUM(ci.total_amount) FILTER (WHERE ci.status='pending'),0)::float AS unpaid_amount,
      COALESCE(SUM(ci.total_amount) FILTER (WHERE ci.status='paid'),0)::float AS paid_amount,
      MAX(ci.due_date) AS latest_due_date,
      EXTRACT(EPOCH FROM (NOW() - MAX(ci.due_date FILTER (WHERE ci.status='pending'))))/86400 AS days_overdue
    FROM clients cl
    LEFT JOIN client_invoices ci ON ci.client_id::text = cl.id::text AND ci.office_id = ${officeId}
    WHERE cl.office_id = ${officeId}
    GROUP BY cl.id, cl.name
    HAVING COALESCE(SUM(ci.total_amount) FILTER (WHERE ci.status='pending'),0) > 0
    ORDER BY unpaid_amount DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));
  return rows as any[];
}

async function scanTeamWorkload(officeId: string) {
  const { rows } = await db.execute(sql`
    SELECT
      em.id, em.name,
      COUNT(DISTINCT c.id) FILTER (WHERE c.status NOT IN ('closed','منتهية'))::int AS active_cases,
      COUNT(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('done','completed','مكتملة'))::int AS pending_tasks,
      COUNT(DISTINCT t.id) FILTER (WHERE t.status NOT IN ('done','completed','مكتملة') AND t.due_date < NOW())::int AS overdue_tasks
    FROM employees em
    LEFT JOIN cases c ON c.responsible_id::text = em.id::text AND c.office_id = ${officeId}
    LEFT JOIN tasks t ON t.assigned_to::text = em.id::text AND t.office_id = ${officeId}
    WHERE em.office_id = ${officeId}
    GROUP BY em.id, em.name
    ORDER BY active_cases DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));
  return rows as any[];
}

/* ── AI Action Plan Builder ──────────────────────────────────── */
async function buildActionPlan(scanData: {
  deadlines: any[]; risks: any[]; anomalies: any[]; workload: any[];
}, officeId: string) {
  if (!scanData.deadlines.length && !scanData.risks.length && !scanData.anomalies.length) {
    return [];
  }

  const prompt = `حلّل بيانات المسح التشغيلي التالية وأنتج خطة عمل استباقية:

المواعيد النهائية الحرجة (خلال 72 ساعة): ${JSON.stringify(scanData.deadlines.slice(0, 5))}
قضايا في خطر (غير محدّثة/مهام متأخرة): ${JSON.stringify(scanData.risks.slice(0, 5))}
تحذيرات مالية (فواتير غير مدفوعة): ${JSON.stringify(scanData.anomalies.slice(0, 5))}
أعباء الفريق: ${JSON.stringify(scanData.workload.slice(0, 5))}

أعد JSON بالصيغة بدقة:
[
  {
    "action_type": "deadline_alert|litigation_risk|financial_anomaly|assignment|follow_up",
    "title": "عنوان واضح للإجراء",
    "description": "وصف تفصيلي للمشكلة والتأثير المتوقع",
    "priority": "critical|high|medium|low",
    "target_ref": { "entity_type": "case|client|task|employee", "entity_id": "id_or_null", "entity_name": "اسم" },
    "suggested_action": {
      "action": "ما يجب فعله",
      "assignee_suggestion": "من يجب أن ينفذ",
      "deadline": "متى يجب الإنجاز",
      "steps": ["خطوة1","خطوة2"]
    },
    "ai_reasoning": "تفسير قصير لسبب أهمية هذا الإجراء"
  }
]

أنتج فقط الإجراءات ذات الأولوية الحقيقية. لا تختلق مشاكل غير موجودة في البيانات.`;

  const result = await callAI(COO_SYSTEM, prompt, [], "auto", officeId, "coo_scan").catch(() => null);
  if (!result?.reply) return buildFallbackActions(scanData);

  const parsed = extractJSON(result.reply);
  if (!Array.isArray(parsed)) return buildFallbackActions(scanData);
  return parsed;
}

function buildFallbackActions(scanData: any): any[] {
  const actions: any[] = [];

  for (const d of (scanData.deadlines ?? []).slice(0, 3)) {
    actions.push({
      action_type: "deadline_alert",
      title: `موعد حرج: ${d.case_title ?? d.task_title ?? "مهمة"}`,
      description: `يوجد موعد حرج خلال ${Math.max(0, Math.round(Number(d.hours_remaining ?? 24)))} ساعة`,
      priority: Number(d.hours_remaining ?? 48) < 24 ? "critical" : "high",
      target_ref: { entity_type: "case", entity_id: d.case_id, entity_name: d.case_title },
      suggested_action: { action: "مراجعة القضية وإعداد ما يلزم", assignee_suggestion: "المحامي المسؤول", deadline: "فوري", steps: ["فتح ملف القضية", "مراجعة المستندات", "التحضير للموعد"] },
      ai_reasoning: "موعد قريب يتطلب تحضيراً فورياً",
    });
  }

  for (const r of (scanData.risks ?? []).slice(0, 2)) {
    if (Number(r.days_since_update ?? 0) > 14) {
      actions.push({
        action_type: "litigation_risk",
        title: `قضية غير محدّثة: ${r.title}`,
        description: `لم تُحدَّث القضية منذ ${Math.round(Number(r.days_since_update ?? 0))} يوماً`,
        priority: "medium",
        target_ref: { entity_type: "case", entity_id: r.id, entity_name: r.title },
        suggested_action: { action: "مراجعة القضية وتحديث حالتها", assignee_suggestion: "محامي القضية", deadline: "خلال 48 ساعة", steps: ["فتح القضية", "مراجعة آخر مستجدات", "تحديث الحالة"] },
        ai_reasoning: "القضايا غير المحدّثة قد تشير إلى إهمال يضر بالموكل",
      });
    }
  }

  for (const a of (scanData.anomalies ?? []).slice(0, 2)) {
    if (Number(a.unpaid_amount ?? 0) > 0) {
      actions.push({
        action_type: "financial_anomaly",
        title: `فاتورة متأخرة: ${a.client_name}`,
        description: `مبلغ غير مسدد: ${Number(a.unpaid_amount ?? 0).toLocaleString("ar")} ريال`,
        priority: Number(a.unpaid_amount ?? 0) > 10000 ? "high" : "medium",
        target_ref: { entity_type: "client", entity_id: a.client_id, entity_name: a.client_name },
        suggested_action: { action: "التواصل مع العميل لمتابعة السداد", assignee_suggestion: "المحاسب أو المسؤول المالي", deadline: "خلال أسبوع", steps: ["إرسال تذكير بالفاتورة", "جدولة مكالمة متابعة"] },
        ai_reasoning: "الفواتير المتأخرة تؤثر على التدفق النقدي للمكتب",
      });
    }
  }

  return actions;
}

/* ── Routes ──────────────────────────────────────────────────── */

/* COO Dashboard — summary of all active monitoring */
router.get("/jlwm/coo/dashboard", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;

  const [deadlines, risks, anomalies, workload, pendingActions] = await Promise.all([
    scanDeadlines(officeId),
    scanLitigationRisks(officeId),
    scanFinancialAnomalies(officeId),
    scanTeamWorkload(officeId),
    db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status='pending_approval')::int AS pending,
             COUNT(*) FILTER (WHERE status='approved')::int AS approved,
             COUNT(*) FILTER (WHERE status='executed')::int AS executed,
             COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
             COUNT(*) FILTER (WHERE priority='critical')::int AS critical
      FROM jlwm_coo_actions WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),
  ]);

  const stats = (pendingActions.rows[0] as any) ?? {};

  res.json({
    monitoring: {
      deadlines_72h: deadlines.length,
      litigation_risks: risks.length,
      financial_alerts: anomalies.length,
      team_overloaded: workload.filter((w: any) => Number(w.overdue_tasks ?? 0) > 0).length,
    },
    action_stats: {
      pending:  Number(stats.pending  ?? 0),
      approved: Number(stats.approved ?? 0),
      executed: Number(stats.executed ?? 0),
      rejected: Number(stats.rejected ?? 0),
      critical: Number(stats.critical ?? 0),
    },
    deadlines:  deadlines.slice(0, 5),
    risks:      risks.slice(0, 5),
    anomalies:  anomalies.slice(0, 5),
    workload:   workload.slice(0, 5),
  });
});

/* Run a full COO scan — generates action items */
router.post("/jlwm/coo/scan", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;

  const [deadlines, risks, anomalies, workload] = await Promise.all([
    scanDeadlines(officeId),
    scanLitigationRisks(officeId),
    scanFinancialAnomalies(officeId),
    scanTeamWorkload(officeId),
  ]);

  const actions = await buildActionPlan({ deadlines, risks, anomalies, workload }, officeId);
  if (!actions.length) return res.json({ ok: true, generated: 0, message: "لا توجد إجراءات مطلوبة حالياً — كل شيء طبيعي" });

  const expires = new Date(Date.now() + 7 * 86400_000);
  const inserted: any[] = [];

  for (const a of actions.slice(0, 10)) {
    const { rows } = await db.execute(sql`
      INSERT INTO jlwm_coo_actions
        (office_id, action_type, title, description, priority, status,
         target_ref, suggested_action, ai_reasoning, expires_at)
      VALUES
        (${officeId}, ${a.action_type ?? "follow_up"}, ${a.title ?? "إجراء JLWM"},
         ${a.description ?? ""}, ${a.priority ?? "medium"}, 'pending_approval',
         ${JSON.stringify(a.target_ref ?? {})}::jsonb,
         ${JSON.stringify(a.suggested_action ?? {})}::jsonb,
         ${a.ai_reasoning ?? null},
         ${expires.toISOString()}::timestamptz)
      RETURNING id, title, priority, action_type
    `).catch(() => ({ rows: [] }));
    if (rows.length) inserted.push(rows[0]);
  }

  res.json({ ok: true, generated: inserted.length, actions: inserted });
});

/* List all COO actions */
router.get("/jlwm/coo/actions", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const status   = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;
  const limit    = Math.min(Number(req.query.limit ?? 20), 100);

  const { rows } = await db.execute(sql`
    SELECT * FROM jlwm_coo_actions
    WHERE office_id = ${officeId}
      ${status   ? sql`AND status   = ${status}`   : sql``}
      ${priority ? sql`AND priority = ${priority}` : sql``}
    ORDER BY
      CASE priority
        WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4
      END,
      created_at DESC
    LIMIT ${limit}
  `).catch(() => ({ rows: [] }));

  res.json({ actions: rows });
});

/* Approve an action */
router.post("/jlwm/coo/actions/:id/approve", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const userId   = (req as any).auth?.userId as string | undefined;
  const id       = String(req.params.id);
  const { notes } = req.body as { notes?: string };

  const { rows } = await db.execute(sql`
    UPDATE jlwm_coo_actions
    SET status = 'approved', approved_by = ${userId ?? null},
        approved_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND office_id = ${officeId} AND status = 'pending_approval'
    RETURNING id, title, status
  `).catch((e: any) => { throw e; });

  if (!rows.length) return res.status(404).json({ error: "الإجراء غير موجود أو تمت معالجته بالفعل" });
  res.json({ ok: true, action: rows[0] });
});

/* Reject an action */
router.post("/jlwm/coo/actions/:id/reject", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const userId   = (req as any).auth?.userId as string | undefined;
  const id       = String(req.params.id);
  const { reason } = req.body as { reason?: string };

  const { rows } = await db.execute(sql`
    UPDATE jlwm_coo_actions
    SET status = 'rejected', rejected_by = ${userId ?? null},
        rejected_at = NOW(), reject_reason = ${reason ?? null}, updated_at = NOW()
    WHERE id = ${id} AND office_id = ${officeId} AND status IN ('pending_approval','approved')
    RETURNING id, title, status
  `).catch((e: any) => { throw e; });

  if (!rows.length) return res.status(404).json({ error: "الإجراء غير موجود أو تمت معالجته بالفعل" });
  res.json({ ok: true, action: rows[0] });
});

/* Mark an approved action as executed */
router.post("/jlwm/coo/actions/:id/execute", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const id       = String(req.params.id);
  const { result } = req.body as { result?: any };

  const { rows } = await db.execute(sql`
    UPDATE jlwm_coo_actions
    SET status = 'executed', executed_at = NOW(),
        execution_result = ${JSON.stringify(result ?? {})}::jsonb,
        updated_at = NOW()
    WHERE id = ${id} AND office_id = ${officeId} AND status = 'approved'
    RETURNING id, title, status, executed_at
  `).catch((e: any) => { throw e; });

  if (!rows.length) return res.status(400).json({ error: "الإجراء يجب أن يكون بحالة 'موافق عليه' للتنفيذ" });
  res.json({ ok: true, action: rows[0] });
});

/* Dismiss an action (soft delete it) */
router.post("/jlwm/coo/actions/:id/dismiss", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const id       = String(req.params.id);

  const { rows } = await db.execute(sql`
    UPDATE jlwm_coo_actions
    SET status = 'dismissed', updated_at = NOW()
    WHERE id = ${id} AND office_id = ${officeId}
    RETURNING id, title, status
  `).catch((e: any) => { throw e; });

  if (!rows.length) return res.status(404).json({ error: "الإجراء غير موجود" });
  res.json({ ok: true, action: rows[0] });
});

/* Platform-wide COO stats (for super-admin) */
router.get("/jlwm/coo/platform-stats", async (req, res) => {
  if (!(req as any).isSuperAdmin) return res.status(403).json({ error: "ممنوع" });

  const { rows } = await db.execute(sql`
    SELECT
      COUNT(DISTINCT office_id)::int AS total_offices,
      COUNT(*)::int AS total_actions,
      COUNT(*) FILTER (WHERE status='pending_approval')::int AS pending,
      COUNT(*) FILTER (WHERE status='approved')::int AS approved,
      COUNT(*) FILTER (WHERE status='executed')::int AS executed,
      COUNT(*) FILTER (WHERE priority='critical')::int AS critical,
      COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '24 hours')::int AS last_24h
    FROM jlwm_coo_actions
  `).catch(() => ({ rows: [{}] }));

  res.json(rows[0] ?? {});
});

export default router;
