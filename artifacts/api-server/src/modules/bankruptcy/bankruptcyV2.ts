import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callBkAI, tgBkAlert, saveReportToStorage } from "./bankruptcyIntegrations";

const router = Router();

function requireAuth(req: any, res: any, next: any) { requireAuthWithTenant(req, res, next); }
function sqlOne(r: any) { const rows = Array.isArray(r) ? r : (r?.rows ?? []); return rows[0] ?? null; }
function sqlAll(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(v: string) { return UUID_RE.test(v); }
function badId(res: any, msg = "معرف غير صالح") { res.status(400).json({ error: msg }); return null; }

/* ══════════════════════════════════════════════════════════
   TABLES
══════════════════════════════════════════════════════════ */
export async function ensureBankruptcyV2Tables() {

  /* ── Phase 1: Workflow Engine ── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_workflows (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id    TEXT NOT NULL,
      case_id      UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      current_step INT NOT NULL DEFAULT 0,
      status       TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','completed','suspended','cancelled')),
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(case_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_workflow_steps (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id    UUID NOT NULL REFERENCES bk_workflows(id) ON DELETE CASCADE,
      office_id      TEXT NOT NULL,
      step_order     INT NOT NULL,
      step_key       TEXT NOT NULL,
      step_label     TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','in_progress','completed','skipped','blocked')),
      assigned_to    TEXT,
      due_date       DATE,
      completed_at   TIMESTAMPTZ,
      notes          TEXT,
      required_docs  TEXT[],
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_workflow_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID NOT NULL REFERENCES bk_workflows(id) ON DELETE CASCADE,
      office_id   TEXT NOT NULL,
      step_key    TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      description TEXT,
      performed_by TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_workflows_case   ON bk_workflows(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_workflows_office ON bk_workflows(office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_wf_steps_wf     ON bk_workflow_steps(workflow_id, step_order)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_wf_events_wf    ON bk_workflow_events(workflow_id, created_at DESC)`);

  /* ── Phase 4: Smart Task Engine ── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_tasks (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id     TEXT NOT NULL,
      case_id       UUID REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      description   TEXT,
      task_type     TEXT NOT NULL DEFAULT 'manual'
                      CHECK (task_type IN ('manual','auto','ai_suggested')),
      priority      TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low','medium','high','critical')),
      status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','in_progress','completed','cancelled','overdue')),
      assigned_to   TEXT,
      due_date      DATE,
      completed_at  TIMESTAMPTZ,
      escalated     BOOLEAN NOT NULL DEFAULT false,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_task_comments (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id    UUID NOT NULL REFERENCES bk_tasks(id) ON DELETE CASCADE,
      office_id  TEXT NOT NULL,
      user_id    TEXT,
      comment    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_task_assignments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id     UUID NOT NULL REFERENCES bk_tasks(id) ON DELETE CASCADE,
      office_id   TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      assigned_by TEXT,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_tasks_case    ON bk_tasks(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_tasks_office  ON bk_tasks(office_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_tasks_due     ON bk_tasks(due_date) WHERE status NOT IN ('completed','cancelled')`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_task_comments ON bk_task_comments(task_id, created_at DESC)`);

  /* ── Phase 5: Templates Engine ── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_templates (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id       TEXT NOT NULL,
      template_type   TEXT NOT NULL
                        CHECK (template_type IN (
                          'opening_petition','trustee_report','meeting_minutes',
                          'distribution_report','claim_review','asset_evaluation',
                          'court_correspondence','executive_summary','creditors_register'
                        )),
      title           TEXT NOT NULL,
      content         TEXT NOT NULL,
      ai_generated    BOOLEAN NOT NULL DEFAULT false,
      approved        BOOLEAN NOT NULL DEFAULT false,
      approved_by     TEXT,
      approved_at     TIMESTAMPTZ,
      variables       JSONB DEFAULT '[]',
      usage_count     INT NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_templates_office ON bk_templates(office_id, template_type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_templates_approved ON bk_templates(office_id, approved)`);

  /* ── Phase 6: Alerts System ── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_alerts (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id    TEXT NOT NULL,
      case_id      UUID REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      alert_type   TEXT NOT NULL
                     CHECK (alert_type IN (
                       'high_risk_case','large_claim_dispute','missing_documents',
                       'asset_valuation_delay','distribution_delay','court_deadline',
                       'cash_flow_risk','ai_risk_detection','overdue_task'
                     )),
      severity     TEXT NOT NULL DEFAULT 'info'
                     CHECK (severity IN ('info','warning','high','critical')),
      title        TEXT NOT NULL,
      message      TEXT,
      status       TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','acknowledged','resolved','dismissed')),
      acknowledged_by  TEXT,
      acknowledged_at  TIMESTAMPTZ,
      resolved_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_alerts_office  ON bk_alerts(office_id, status, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_alerts_case    ON bk_alerts(case_id, severity)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_alerts_active  ON bk_alerts(office_id, severity) WHERE status='active'`);

  /* ── Phase 2: Court Packages (extend bk_reports) ── */
  await db.execute(sql`ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'`);
  await db.execute(sql`ALTER TABLE bk_reports ADD COLUMN IF NOT EXISTS metadata JSONB`);
}

/* ── Default Workflow Steps ── */
const DEFAULT_STEPS = [
  { order: 0,  key: "draft",             label: "المسودة",                     docs: ["صحيفة دعوى الإفلاس"] },
  { order: 1,  key: "preparation",       label: "الإعداد والتحضير",             docs: ["المستندات المالية","قائمة الديون"] },
  { order: 2,  key: "court_submission",  label: "تقديم الطلب للمحكمة",         docs: ["عريضة الإفلاس","القوائم المالية"] },
  { order: 3,  key: "court_review",      label: "قيد المراجعة القضائية",       docs: [] },
  { order: 4,  key: "case_opened",       label: "فتح القضية رسمياً",            docs: ["قرار المحكمة"] },
  { order: 5,  key: "claims_collection", label: "جمع المطالبات",               docs: ["نماذج المطالبات"] },
  { order: 6,  key: "claims_verification","label": "التحقق من المطالبات",      docs: ["تقرير المراجعة"] },
  { order: 7,  key: "assets_management", label: "إدارة الأصول",               docs: ["تقرير الأصول","تقييمات"] },
  { order: 8,  key: "meetings",          label: "اجتماعات الدائنين",            docs: ["جدول الأعمال"] },
  { order: 9,  key: "voting",            label: "التصويت والقرارات",            docs: ["محضر التصويت"] },
  { order: 10, key: "distribution",      label: "التوزيع على الدائنين",        docs: ["خطة التوزيع"] },
  { order: 11, key: "closure",           label: "إغلاق القضية",                docs: ["التقرير الختامي"] },
];

/* ══════════════════════════════════════════════════════════
   PHASE 1: WORKFLOW ENGINE
══════════════════════════════════════════════════════════ */

/* GET /bankruptcy/cases/:id/workflow */
router.get("/bankruptcy/cases/:id/workflow", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const wf = sqlOne(await db.execute(sql`
      SELECT w.*,
        (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=w.id AND status='completed') AS completed_steps,
        (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=w.id) AS total_steps
      FROM bk_workflows w WHERE w.case_id=${caseId}::uuid AND w.office_id=${officeId}
    `));
    if (!wf) return res.json({ workflow: null, steps: [], completionPct: 0 });

    const steps = sqlAll(await db.execute(sql`
      SELECT * FROM bk_workflow_steps WHERE workflow_id=${wf.id}::uuid ORDER BY step_order
    `));
    const total = Number(wf.total_steps ?? steps.length);
    const done  = Number(wf.completed_steps ?? 0);
    res.json({
      workflow: wf,
      steps,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /bankruptcy/cases/:id/workflow — initialize workflow */
router.post("/bankruptcy/cases/:id/workflow", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const bkCase = sqlOne(await db.execute(sql`
      SELECT id FROM bankruptcy_cases WHERE id=${caseId}::uuid AND office_id=${officeId}
    `));
    if (!bkCase) return res.status(404).json({ error: "الملف غير موجود" });

    const existing = sqlOne(await db.execute(sql`
      SELECT id FROM bk_workflows WHERE case_id=${caseId}::uuid
    `));
    if (existing) return res.status(409).json({ error: "سير العمل موجود بالفعل", workflowId: existing.id });

    const wf = sqlOne(await db.execute(sql`
      INSERT INTO bk_workflows (office_id, case_id) VALUES (${officeId}, ${caseId}::uuid) RETURNING *
    `));

    for (const s of DEFAULT_STEPS) {
      await db.execute(sql`
        INSERT INTO bk_workflow_steps (workflow_id, office_id, step_order, step_key, step_label, required_docs)
        VALUES (${wf.id}::uuid, ${officeId}, ${s.order}, ${s.key}, ${s.label}, ${`{${s.docs.map(d => `"${d}"`).join(",")}}`})
      `);
    }

    res.status(201).json({ workflow: wf, stepsCreated: DEFAULT_STEPS.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* PATCH /bankruptcy/workflow-steps/:stepId — update step status */
router.patch("/bankruptcy/workflow-steps/:stepId", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const stepId   = String(req.params.stepId);
  if (!isUUID(stepId)) return badId(res);
  try {
    const { status, assigned_to, due_date, notes } = req.body;
    const allowed = ["pending","in_progress","completed","skipped","blocked"];
    if (status && !allowed.includes(status)) return res.status(400).json({ error: "حالة غير صالحة" });

    const step = sqlOne(await db.execute(sql`
      SELECT s.*, w.office_id FROM bk_workflow_steps s
      JOIN bk_workflows w ON w.id=s.workflow_id
      WHERE s.id=${stepId}::uuid AND w.office_id=${officeId}
    `));
    if (!step) return res.status(404).json({ error: "الخطوة غير موجودة" });

    const updated = sqlOne(await db.execute(sql`
      UPDATE bk_workflow_steps SET
        status      = COALESCE(${status ?? null}, status),
        assigned_to = COALESCE(${assigned_to ?? null}, assigned_to),
        due_date    = COALESCE(${due_date ?? null}::date, due_date),
        notes       = COALESCE(${notes ?? null}, notes),
        completed_at = CASE WHEN ${status ?? ""} = 'completed' THEN NOW() ELSE completed_at END,
        updated_at  = NOW()
      WHERE id=${stepId}::uuid
      RETURNING *
    `));

    if (status === "completed") {
      await db.execute(sql`
        UPDATE bk_workflows SET
          current_step = current_step + 1,
          updated_at = NOW()
        WHERE id=${step.workflow_id}::uuid
      `);
      await db.execute(sql`
        INSERT INTO bk_workflow_events (workflow_id, office_id, step_key, event_type, description, performed_by)
        VALUES (${step.workflow_id}::uuid, ${officeId}, ${step.step_key}, 'step_completed',
                ${'اكتملت الخطوة: ' + step.step_label}, ${req.auth?.userId ?? null})
      `);
    }

    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /bankruptcy/workflow-widget — dashboard widget data */
router.get("/bankruptcy/workflow-widget", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT w.id, w.case_id, w.current_step, w.status,
        bc.debtor_name, bc.case_number,
        (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=w.id AND status='completed') AS done,
        (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=w.id) AS total,
        (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=w.id AND status='blocked') AS blocked,
        (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=w.id AND due_date < CURRENT_DATE AND status NOT IN ('completed','skipped')) AS overdue,
        (SELECT step_label FROM bk_workflow_steps WHERE workflow_id=w.id AND status='in_progress' LIMIT 1) AS current_label
      FROM bk_workflows w
      JOIN bankruptcy_cases bc ON bc.id=w.case_id
      WHERE w.office_id=${officeId} AND w.status='active'
      ORDER BY w.updated_at DESC LIMIT 10
    `));
    res.json(rows.map((r: any) => ({
      ...r,
      completionPct: Number(r.total) > 0 ? Math.round((Number(r.done) / Number(r.total)) * 100) : 0,
    })));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 2: COURT PACKAGE GENERATOR
══════════════════════════════════════════════════════════ */
router.post("/bankruptcy/cases/:id/court-package", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const [bkCase, creditorRows, claimRows, assetRows] = await Promise.all([
      db.execute(sql`
        SELECT bc.*,
          (SELECT COUNT(*) FROM bk_creditors WHERE case_id=bc.id) AS creditor_count,
          (SELECT COALESCE(SUM(amount),0) FROM bk_claims WHERE case_id=bc.id) AS total_claims,
          (SELECT COALESCE(SUM(estimated_value),0) FROM bk_assets WHERE case_id=bc.id) AS total_assets,
          (SELECT COALESCE(SUM(total_amount),0) FROM bk_distributions WHERE case_id=bc.id AND status='executed') AS total_distributed
        FROM bankruptcy_cases bc WHERE bc.id=${caseId}::uuid AND bc.office_id=${officeId}
      `),
      db.execute(sql`SELECT * FROM bk_creditors WHERE case_id=${caseId}::uuid AND office_id=${officeId} LIMIT 50`),
      db.execute(sql`
        SELECT cl.*, cr.name AS creditor_name FROM bk_claims cl
        LEFT JOIN bk_creditors cr ON cr.id=cl.creditor_id
        WHERE cl.case_id=${caseId}::uuid AND cl.office_id=${officeId} LIMIT 100
      `),
      db.execute(sql`SELECT * FROM bk_assets WHERE case_id=${caseId}::uuid AND office_id=${officeId} LIMIT 50`),
    ]);

    const c = sqlOne(bkCase);
    if (!c) return res.status(404).json({ error: "الملف غير موجود" });
    const creditors = sqlAll(creditorRows);
    const claims    = sqlAll(claimRows);
    const assets    = sqlAll(assetRows);

    const approvedClaims  = claims.filter((cl: any) => cl.status === "approved");
    const rejectedClaims  = claims.filter((cl: any) => cl.status === "rejected");
    const disputedClaims  = claims.filter((cl: any) => cl.status === "disputed");
    const totalClaimAmt   = claims.reduce((s: number, cl: any) => s + Number(cl.amount), 0);
    const approvedAmt     = approvedClaims.reduce((s: number, cl: any) => s + Number(cl.amount), 0);
    const totalAssetVal   = assets.reduce((s: number, a: any) => s + Number(a.estimated_value), 0);
    const recoveryRate    = totalClaimAmt > 0 ? Math.round((Number(c.total_distributed) / totalClaimAmt) * 100) : 0;

    const systemPrompt = `أنت خبير قانوني في نظام الإفلاس السعودي (نظام الإفلاس 1439هـ وتعديلاته). مهمتك إنتاج حزمة وثائق قضائية متكاملة بأسلوب رسمي ومهني باللغة العربية.`;

    const userPrompt = `أنشئ حزمة مستندات قضائية شاملة لملف الإفلاس التالي:

**بيانات الملف:**
- رقم الملف: ${c.case_number}
- المدين: ${c.debtor_name} (${c.debtor_type === 'company' ? 'شركة' : c.debtor_type === 'individual' ? 'فرد' : 'شراكة'})
- نوع الإجراء: ${c.procedure_type}
- المحكمة: ${c.court_name ?? 'غير محدد'}
- أمين الإفلاس: ${c.trustee_name ?? 'غير محدد'}
- حالة القضية: ${c.status}
- تاريخ البدء: ${c.start_date ?? 'غير محدد'}

**الإحصاءات المالية:**
- إجمالي الدائنين: ${creditors.length}
- إجمالي المطالبات: ${claims.length} مطالبة بقيمة ${totalClaimAmt.toLocaleString('ar-SA')} ريال
- المطالبات المقبولة: ${approvedClaims.length} بقيمة ${approvedAmt.toLocaleString('ar-SA')} ريال
- المطالبات المرفوضة: ${rejectedClaims.length}
- المطالبات المتنازع عليها: ${disputedClaims.length}
- إجمالي الأصول: ${assets.length} أصل بقيمة ${totalAssetVal.toLocaleString('ar-SA')} ريال
- إجمالي الموزَّع: ${Number(c.total_distributed).toLocaleString('ar-SA')} ريال
- نسبة الاسترداد: ${recoveryRate}%

أنتج الوثائق التالية بتنسيق واضح ومرقم:

## 1. عريضة الإفلاس (Opening Petition)
## 2. طلب تقديم الإفلاس
## 3. الملخص المالي
## 4. سجل الأصول
## 5. سجل الالتزامات
## 6. سجل الدائنين
## 7. الجدول الزمني للقضية
## 8. الملخص التنفيذي
## 9. فهرس المستندات الداعمة

استخدم أسلوباً قانونياً رسمياً مع الإشارة إلى المواد القانونية ذات الصلة من نظام الإفلاس السعودي.`;

    const content = await callBkAI(systemPrompt, userPrompt, officeId, "bankruptcy_court_package", req.auth?.userId ?? "system");

    const report = sqlOne(await db.execute(sql`
      INSERT INTO bk_reports (case_id, office_id, report_type, report_title, content, generated_by, category)
      VALUES (${caseId}::uuid, ${officeId}, 'court', ${'حزمة المستندات القضائية — ' + c.case_number}, ${content}, ${req.auth?.userId ?? 'system'}, 'court_package')
      RETURNING *
    `));
    void saveReportToStorage({ officeId, caseId, title: 'حزمة المستندات القضائية — ' + c.case_number, content, reportId: report.id, reportType: 'court_package' });

    res.json({
      reportId: report.id,
      caseNumber: c.case_number,
      debtorName: c.debtor_name,
      content,
      stats: { creditors: creditors.length, claims: claims.length, assets: assets.length, approvedClaims: approvedClaims.length, recoveryRate },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 4: SMART TASK ENGINE
══════════════════════════════════════════════════════════ */

/* GET /bankruptcy/tasks */
router.get("/bankruptcy/tasks", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = req.query.case_id as string | undefined;
  const status   = req.query.status   as string | undefined;
  const limit    = Math.min(Number(req.query.limit ?? 50), 200);
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT t.*, bc.debtor_name, bc.case_number
      FROM bk_tasks t
      LEFT JOIN bankruptcy_cases bc ON bc.id=t.case_id
      WHERE t.office_id=${officeId}
        ${caseId ? sql`AND t.case_id=${caseId}::uuid` : sql``}
        ${status ? sql`AND t.status=${status}` : sql``}
      ORDER BY
        CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT ${limit}
    `));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /bankruptcy/tasks */
router.post("/bankruptcy/tasks", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const { case_id, title, description, priority, due_date, assigned_to, task_type } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "عنوان المهمة مطلوب" });
  try {
    if (case_id && !isUUID(case_id)) return badId(res, "معرف الملف غير صالح");
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_tasks (office_id, case_id, title, description, priority, due_date, assigned_to, task_type)
      VALUES (
        ${officeId},
        ${case_id ? sql`${case_id}::uuid` : sql`NULL`},
        ${title.trim()}, ${description?.trim() ?? null},
        ${priority ?? 'medium'}, ${due_date ?? null},
        ${assigned_to ?? null}, ${task_type ?? 'manual'}
      ) RETURNING *
    `));
    res.status(201).json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* PATCH /bankruptcy/tasks/:id */
router.patch("/bankruptcy/tasks/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const { title, description, priority, status, due_date, assigned_to } = req.body;
    const existing = sqlOne(await db.execute(sql`SELECT id FROM bk_tasks WHERE id=${id}::uuid AND office_id=${officeId}`));
    if (!existing) return res.status(404).json({ error: "المهمة غير موجودة" });

    const row = sqlOne(await db.execute(sql`
      UPDATE bk_tasks SET
        title       = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        priority    = COALESCE(${priority ?? null}, priority),
        status      = COALESCE(${status ?? null}, status),
        due_date    = COALESCE(${due_date ?? null}::date, due_date),
        assigned_to = COALESCE(${assigned_to ?? null}, assigned_to),
        completed_at = CASE WHEN ${status ?? ''} = 'completed' THEN NOW() ELSE completed_at END,
        updated_at  = NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* DELETE /bankruptcy/tasks/:id */
router.delete("/bankruptcy/tasks/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    await db.execute(sql`DELETE FROM bk_tasks WHERE id=${id}::uuid AND office_id=${officeId}`);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /bankruptcy/tasks/:id/comments */
router.post("/bankruptcy/tasks/:id/comments", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: "التعليق مطلوب" });
  try {
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_task_comments (task_id, office_id, user_id, comment)
      VALUES (${id}::uuid, ${officeId}, ${req.auth?.userId ?? null}, ${comment.trim()})
      RETURNING *
    `));
    res.status(201).json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /bankruptcy/tasks/:id/comments */
router.get("/bankruptcy/tasks/:id/comments", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT c.* FROM bk_task_comments c
      JOIN bk_tasks t ON t.id=c.task_id
      WHERE c.task_id=${id}::uuid AND t.office_id=${officeId}
      ORDER BY c.created_at
    `));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /bankruptcy/cases/:id/auto-tasks — generate tasks automatically */
router.post("/bankruptcy/cases/:id/auto-tasks", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const bkCase = sqlOne(await db.execute(sql`SELECT * FROM bankruptcy_cases WHERE id=${caseId}::uuid AND office_id=${officeId}`));
    if (!bkCase) return res.status(404).json({ error: "الملف غير موجود" });

    const [claimCount, assetCount, meetingCount] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_claims WHERE case_id=${caseId}::uuid AND status='pending'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_assets WHERE case_id=${caseId}::uuid AND status='valuation'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_meetings WHERE case_id=${caseId}::uuid AND status='scheduled' AND meeting_date > NOW()`),
    ]);

    const autoTasks: any[] = [];
    const pendingClaims = Number(sqlOne(claimCount)?.cnt ?? 0);
    const pendingAssets = Number(sqlOne(assetCount)?.cnt ?? 0);
    const upcomingMeet  = Number(sqlOne(meetingCount)?.cnt ?? 0);

    if (pendingClaims > 0) {
      autoTasks.push({ title: `مراجعة ${pendingClaims} مطالبة معلقة`, priority: 'high', task_type: 'auto', due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) });
    }
    if (pendingAssets > 0) {
      autoTasks.push({ title: `إكمال تقييم ${pendingAssets} أصل`, priority: 'medium', task_type: 'auto', due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) });
    }
    if (upcomingMeet > 0) {
      autoTasks.push({ title: `التحضير لـ${upcomingMeet} اجتماع مجدول`, priority: 'high', task_type: 'auto', due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) });
    }

    const created: any[] = [];
    for (const t of autoTasks) {
      const r = sqlOne(await db.execute(sql`
        INSERT INTO bk_tasks (office_id, case_id, title, priority, task_type, due_date)
        VALUES (${officeId}, ${caseId}::uuid, ${t.title}, ${t.priority}, ${t.task_type}, ${t.due_date}::date)
        RETURNING *
      `));
      created.push(r);
    }

    res.json({ created: created.length, tasks: created });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /bankruptcy/tasks/stats */
router.get("/bankruptcy/tasks/stats", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT status, priority, COUNT(*) as cnt FROM bk_tasks
      WHERE office_id=${officeId}
      GROUP BY status, priority
    `));
    const overdue = sqlOne(await db.execute(sql`
      SELECT COUNT(*) as cnt FROM bk_tasks
      WHERE office_id=${officeId} AND due_date < CURRENT_DATE AND status NOT IN ('completed','cancelled')
    `));
    res.json({ byStatusPriority: rows, overdueCount: Number(overdue?.cnt ?? 0) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 5: TEMPLATES ENGINE
══════════════════════════════════════════════════════════ */

/* GET /bankruptcy/templates */
router.get("/bankruptcy/templates", requireAuth, async (req: any, res) => {
  const officeId     = req.tenantId as string;
  const templateType = req.query.type as string | undefined;
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT id, office_id, template_type, title, ai_generated, approved, usage_count, created_at, updated_at
      FROM bk_templates
      WHERE office_id=${officeId}
        ${templateType ? sql`AND template_type=${templateType}` : sql``}
      ORDER BY usage_count DESC, created_at DESC
    `));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /bankruptcy/templates/:id */
router.get("/bankruptcy/templates/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const row = sqlOne(await db.execute(sql`SELECT * FROM bk_templates WHERE id=${id}::uuid AND office_id=${officeId}`));
    if (!row) return res.status(404).json({ error: "القالب غير موجود" });
    await db.execute(sql`UPDATE bk_templates SET usage_count=usage_count+1 WHERE id=${id}::uuid`);
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /bankruptcy/templates */
router.post("/bankruptcy/templates", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const { template_type, title, content } = req.body;
  if (!template_type || !title?.trim() || !content?.trim()) return res.status(400).json({ error: "نوع القالب والعنوان والمحتوى مطلوبة" });
  try {
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_templates (office_id, template_type, title, content)
      VALUES (${officeId}, ${template_type}, ${title.trim()}, ${content.trim()})
      RETURNING *
    `));
    res.status(201).json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* PATCH /bankruptcy/templates/:id */
router.patch("/bankruptcy/templates/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    const { title, content, approved } = req.body;
    const row = sqlOne(await db.execute(sql`
      UPDATE bk_templates SET
        title    = COALESCE(${title ?? null}, title),
        content  = COALESCE(${content ?? null}, content),
        approved = COALESCE(${approved !== undefined ? approved : null}, approved),
        approved_by = CASE WHEN ${approved === true} THEN ${req.auth?.userId ?? 'system'} ELSE approved_by END,
        approved_at = CASE WHEN ${approved === true} THEN NOW() ELSE approved_at END,
        updated_at = NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "القالب غير موجود" });
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* DELETE /bankruptcy/templates/:id */
router.delete("/bankruptcy/templates/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    await db.execute(sql`DELETE FROM bk_templates WHERE id=${id}::uuid AND office_id=${officeId}`);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /bankruptcy/templates/ai-generate — AI-powered template generation */
router.post("/bankruptcy/templates/ai-generate", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const { template_type, case_id, context } = req.body;
  if (!template_type) return res.status(400).json({ error: "نوع القالب مطلوب" });

  const typeLabels: Record<string, string> = {
    opening_petition: "عريضة الإفلاس",
    trustee_report: "تقرير أمين الإفلاس",
    meeting_minutes: "محضر الاجتماع",
    distribution_report: "تقرير التوزيع",
    claim_review: "تقرير مراجعة المطالبات",
    asset_evaluation: "تقرير تقييم الأصول",
    court_correspondence: "مراسلة المحكمة",
    executive_summary: "الملخص التنفيذي",
    creditors_register: "سجل الدائنين",
  };

  try {
    let caseContext = "";
    if (case_id && isUUID(case_id)) {
      const c = sqlOne(await db.execute(sql`SELECT * FROM bankruptcy_cases WHERE id=${case_id}::uuid AND office_id=${officeId}`));
      if (c) caseContext = `\n\nبيانات الملف: ${c.debtor_name} (${c.case_number}) — ${c.procedure_type}`;
    }

    const systemPrompt = `أنت خبير قانوني في نظام الإفلاس السعودي. أنشئ قالباً قانونياً احترافياً.`;
    const userPrompt = `أنشئ قالباً احترافياً لـ: ${typeLabels[template_type] ?? template_type}

المتطلبات:
- أسلوب قانوني رسمي باللغة العربية
- مطابق لنظام الإفلاس السعودي 1439هـ
- استخدم متغيرات بصيغة {{اسم_المتغير}} للبيانات الديناميكية
- شامل ومفصل وجاهز للاستخدام الفوري
${caseContext}
${context ? `\nسياق إضافي: ${context}` : ""}`;

    const content = await callBkAI(systemPrompt, userPrompt, officeId, "bankruptcy_analysis", req.auth?.userId ?? "system");
    const title   = `${typeLabels[template_type] ?? template_type} — مُنشأ بالذكاء الاصطناعي`;

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_templates (office_id, template_type, title, content, ai_generated, approved)
      VALUES (${officeId}, ${template_type}, ${title}, ${content}, true, false)
      RETURNING *
    `));
    res.status(201).json({ template: row, requiresApproval: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 6: ALERTS SYSTEM
══════════════════════════════════════════════════════════ */

/* GET /bankruptcy/alerts */
router.get("/bankruptcy/alerts", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const status   = (req.query.status as string) ?? "active";
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT a.*, bc.debtor_name, bc.case_number
      FROM bk_alerts a
      LEFT JOIN bankruptcy_cases bc ON bc.id=a.case_id
      WHERE a.office_id=${officeId} AND a.status=${status}
      ORDER BY
        CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
        a.created_at DESC
      LIMIT 100
    `));
    const counts = sqlAll(await db.execute(sql`
      SELECT severity, COUNT(*) as cnt FROM bk_alerts
      WHERE office_id=${officeId} AND status='active'
      GROUP BY severity
    `));
    res.json({ alerts: rows, counts });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* PATCH /bankruptcy/alerts/:id */
router.patch("/bankruptcy/alerts/:id", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  const { status } = req.body;
  const allowed = ["acknowledged","resolved","dismissed"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "حالة غير صالحة" });
  try {
    const row = sqlOne(await db.execute(sql`
      UPDATE bk_alerts SET
        status           = ${status},
        acknowledged_by  = CASE WHEN ${status} = 'acknowledged' THEN ${req.auth?.userId ?? 'system'} ELSE acknowledged_by END,
        acknowledged_at  = CASE WHEN ${status} = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
        resolved_at      = CASE WHEN ${status} = 'resolved' THEN NOW() ELSE resolved_at END
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "التنبيه غير موجود" });
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /bankruptcy/cases/:id/alerts/scan — scan case for alerts */
router.post("/bankruptcy/cases/:id/alerts/scan", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const bkCase = sqlOne(await db.execute(sql`SELECT * FROM bankruptcy_cases WHERE id=${caseId}::uuid AND office_id=${officeId}`));
    if (!bkCase) return res.status(404).json({ error: "الملف غير موجود" });

    const [claims, assets, overdueTasks, pendingDists] = await Promise.all([
      db.execute(sql`SELECT status, COUNT(*) as cnt FROM bk_claims WHERE case_id=${caseId}::uuid GROUP BY status`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_assets WHERE case_id=${caseId}::uuid AND status='valuation'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_tasks WHERE case_id=${caseId}::uuid AND due_date < CURRENT_DATE AND status NOT IN ('completed','cancelled')`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_distributions WHERE case_id=${caseId}::uuid AND status='draft'`),
    ]);

    const claimRows    = sqlAll(claims);
    const disputed     = Number(claimRows.find((r: any) => r.status === "disputed")?.cnt ?? 0);
    const assetsPendingValuation = Number(sqlOne(assets)?.cnt ?? 0);
    const overdueCount = Number(sqlOne(overdueTasks)?.cnt ?? 0);
    const pendingDist  = Number(sqlOne(pendingDists)?.cnt ?? 0);

    const newAlerts: any[] = [];

    if (disputed >= 3) {
      newAlerts.push({ type: "large_claim_dispute", severity: "high", title: "مطالبات متنازع عليها", message: `${disputed} مطالبات متنازع عليها تحتاج مراجعة عاجلة` });
    }
    if (assetsPendingValuation >= 2) {
      newAlerts.push({ type: "asset_valuation_delay", severity: "warning", title: "تأخر تقييم الأصول", message: `${assetsPendingValuation} أصل في انتظار التقييم` });
    }
    if (overdueCount >= 1) {
      newAlerts.push({ type: "overdue_task", severity: "high", title: "مهام متأخرة", message: `${overdueCount} مهمة تجاوزت موعدها النهائي` });
    }
    if (pendingDist >= 1) {
      newAlerts.push({ type: "distribution_delay", severity: "warning", title: "خطة توزيع معلقة", message: `${pendingDist} خطة توزيع لم تُفعَّل بعد` });
    }

    const created: any[] = [];
    for (const a of newAlerts) {
      const existing = sqlOne(await db.execute(sql`
        SELECT id FROM bk_alerts WHERE case_id=${caseId}::uuid AND alert_type=${a.type} AND status='active'
      `));
      if (!existing) {
        const r = sqlOne(await db.execute(sql`
          INSERT INTO bk_alerts (office_id, case_id, alert_type, severity, title, message)
          VALUES (${officeId}, ${caseId}::uuid, ${a.type}, ${a.severity}, ${a.title}, ${a.message})
          RETURNING *
        `));
        created.push(r);
        /* ④ Telegram: critical/high alert */
        if (r?.severity === "critical" || r?.severity === "high") {
          void (async () => {
            const bCase = sqlOne(await db.execute(sql`SELECT debtor_name FROM bankruptcy_cases WHERE id=${caseId}::uuid`).catch(() => null));
            void tgBkAlert(officeId, bCase?.debtor_name ?? caseId, r.title, r.severity);
          })();
        }
      }
    }

    res.json({ scanned: true, newAlerts: created.length, alerts: created });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 7: ENTERPRISE — HEALTH & RISK SCORE
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/health-score", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const bkCase = sqlOne(await db.execute(sql`SELECT * FROM bankruptcy_cases WHERE id=${caseId}::uuid AND office_id=${officeId}`));
    if (!bkCase) return res.status(404).json({ error: "الملف غير موجود" });

    const [claims, assets, tasks, alerts, wf] = await Promise.all([
      db.execute(sql`SELECT status, COUNT(*) as cnt, COALESCE(SUM(amount),0) as total FROM bk_claims WHERE case_id=${caseId}::uuid GROUP BY status`),
      db.execute(sql`SELECT status, COUNT(*) as cnt FROM bk_assets WHERE case_id=${caseId}::uuid GROUP BY status`),
      db.execute(sql`SELECT status, COUNT(*) as cnt FROM bk_tasks WHERE case_id=${caseId}::uuid GROUP BY status`),
      db.execute(sql`SELECT severity, COUNT(*) as cnt FROM bk_alerts WHERE case_id=${caseId}::uuid AND status='active' GROUP BY severity`),
      db.execute(sql`SELECT current_step, (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=bk_workflows.id AND status='completed') AS done, (SELECT COUNT(*) FROM bk_workflow_steps WHERE workflow_id=bk_workflows.id) AS total FROM bk_workflows WHERE case_id=${caseId}::uuid`),
    ]);

    const claimRows   = sqlAll(claims);
    const taskRows    = sqlAll(tasks);
    const alertRows   = sqlAll(alerts);
    const wfRow       = sqlOne(wf);

    const totalClaims = claimRows.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const approved    = Number(claimRows.find((r: any) => r.status === "approved")?.cnt ?? 0);
    const disputed    = Number(claimRows.find((r: any) => r.status === "disputed")?.cnt ?? 0);
    const totalTasks  = taskRows.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const doneTasks   = Number(taskRows.find((r: any) => r.status === "completed")?.cnt ?? 0);
    const criticalAlerts = Number(alertRows.find((r: any) => r.severity === "critical")?.cnt ?? 0);
    const highAlerts     = Number(alertRows.find((r: any) => r.severity === "high")?.cnt ?? 0);
    const wfPct       = wfRow && Number(wfRow.total) > 0 ? Math.round((Number(wfRow.done) / Number(wfRow.total)) * 100) : 0;

    let score = 100;
    score -= criticalAlerts * 15;
    score -= highAlerts * 8;
    score -= (disputed > 0 ? Math.min(20, disputed * 5) : 0);
    score += (totalTasks > 0 && doneTasks > 0 ? Math.round((doneTasks / totalTasks) * 10) : 0);
    score += Math.round(wfPct * 0.1);
    score = Math.max(0, Math.min(100, score));

    const riskLevel = score >= 80 ? "low" : score >= 60 ? "medium" : score >= 40 ? "high" : "critical";
    const riskLabel = score >= 80 ? "منخفض" : score >= 60 ? "متوسط" : score >= 40 ? "مرتفع" : "حرج";

    res.json({
      caseId,
      healthScore: score,
      riskLevel,
      riskLabel,
      workflowProgress: wfPct,
      claimsApprovalRate: totalClaims > 0 ? Math.round((approved / totalClaims) * 100) : 0,
      taskCompletionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      activeAlerts: { critical: criticalAlerts, high: highAlerts },
      breakdown: { claims: claimRows, assets: sqlAll(assets), tasks: taskRows, alerts: alertRows },
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /bankruptcy/enterprise-analytics — Phase 7 aggregate metrics */
router.get("/bankruptcy/enterprise-analytics", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    const [taskStats, alertStats, templateStats, wfStats] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status='pending') AS pending,
          COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE status='completed') AS completed,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed','cancelled')) AS overdue
        FROM bk_tasks WHERE office_id=${officeId}
      `),
      db.execute(sql`
        SELECT severity, COUNT(*) as cnt FROM bk_alerts
        WHERE office_id=${officeId} AND status='active' GROUP BY severity
      `),
      db.execute(sql`
        SELECT template_type, COUNT(*) as cnt, SUM(usage_count) as uses
        FROM bk_templates WHERE office_id=${officeId}
        GROUP BY template_type ORDER BY uses DESC NULLS LAST
      `),
      db.execute(sql`
        SELECT w.status,
          AVG(EXTRACT(EPOCH FROM (COALESCE(w.completed_at,NOW()) - w.started_at))/86400)::INT AS avg_days,
          COUNT(*) as cnt
        FROM bk_workflows w WHERE w.office_id=${officeId} GROUP BY w.status
      `),
    ]);
    res.json({
      tasks:     sqlOne(taskStats) ?? {},
      alerts:    sqlAll(alertStats),
      templates: sqlAll(templateStats),
      workflows: sqlAll(wfStats),
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
