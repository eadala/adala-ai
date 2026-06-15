/**
 * Cases Router — واجهة API للقضايا (Architecture: Clean Controller)
 * ──────────────────────────────────────────────────────────────────
 * ✅ thin controller only — business logic في CaseService
 * ✅ tenant scoping in every request
 * ✅ same URL contract as before (backward compatible)
 */

import { Router }                                  from "express";
import { requireAuthWithTenant }                   from "../middlewares/requireAuth";
import { CaseService }                             from "../case/case.service";
import { CaseTimeline }                            from "../case/modules/timeline";
import { CaseCommunications }                      from "../case/modules/communications";
import { CaseTasks }                               from "../case/modules/tasks";
import { CaseDocuments }                           from "../case/modules/documents";
import { db }                                      from "@workspace/db";
import { sql }                                     from "drizzle-orm";
import { runCaseAutopilot, ensureAutopilotTable }  from "../agents/caseAutopilot";
import { auditLog }                                from "../lib/auditLogger";
import { ListCasesQueryParams, CreateCaseBody, UpdateCaseBody } from "@workspace/api-zod";
import { runAIAnalysis, getLatestInsight, approveAITask, rejectAITask } from "../case/case.ai";

const router = Router();

function getTenant(req: any): string { return req.tenantId; }
function getAuth(req: any)           { return req.auth; }
function getService(req: any)        { return new CaseService(getTenant(req), getAuth(req)?.userId); }

function serializeCase(c: any) {
  return {
    id:          c.id,
    title:       c.title,
    description: c.description,
    caseType:    c.caseType,
    status:      c.status,
    clientName:  c.clientName,
    assignedTo:  c.assignedTo,
    source:      c.source ?? "manual",
    storeOrderId: c.storeOrderId ?? null,
    createdBy:   c.createdBy ?? null,
    createdAt:   c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt:   c.updatedAt instanceof Date ? c.updatedAt?.toISOString() ?? null : c.updatedAt ?? null,
  };
}

/* ══════════════════════════════════════════════════════
   CRUD
══════════════════════════════════════════════════════ */

/* GET /cases */
router.get("/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const q     = ListCasesQueryParams.parse(req.query);
    const cases = await getService(req).listCases({
      status:   q.status   as any,
      caseType: q.caseType as any,
    });

    const page  = req.query.page  ? Math.max(1, parseInt(String(req.query.page)))      : null;
    const limit = req.query.limit ? Math.min(200, parseInt(String(req.query.limit))) : null;
    const total = cases.length;

    if (page && limit) {
      const sliced = cases.slice((page - 1) * limit, page * limit);
      res.json({ data: sliced.map(serializeCase), total, page, limit, pages: Math.ceil(total / limit) });
      return;
    }
    res.json(cases.map(serializeCase));
  } catch (e: any) {
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
});

/* GET /cases/stats */
router.get("/cases/stats", requireAuthWithTenant, async (req, res) => {
  try {
    const stats = await getService(req).getStats();
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /cases */
router.post("/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const body    = CreateCaseBody.parse(req.body);
    const created = await getService(req).createCase({
      title:       body.title,
      description: body.description,
      caseType:    body.caseType as any,
      status:      body.status as any,
      clientName:  body.clientName,
      assignedTo:  body.assignedTo,
    });
    res.status(201).json(serializeCase(created));
  } catch (e: any) {
    res.status(e.statusCode ?? 400).json({ error: e.message });
  }
});

/* GET /cases/:id */
router.get("/cases/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!id || id.length > 200) return res.status(400).json({ error: "معرف غير صالح" });

    const tenantId = getTenant(req);
    /* include order details via raw SQL join (same as before) */
    const rows = await db.execute(sql`
      SELECT
        c.id, c.title, c.description, c.case_type, c.status,
        c.client_name, c.assigned_to, c.created_at, c.updated_at,
        COALESCE(c.source,'manual') AS source, c.store_order_id, c.created_by,
        oo.id          AS order_db_id,
        oo.amount      AS order_amount,
        oo.client_email AS order_client_email,
        oo.client_phone AS order_client_phone,
        oo.stripe_session_id AS order_stripe_session,
        oo.created_at  AS order_created_at,
        osvc.name      AS order_service_name,
        osvc.description AS order_service_desc
      FROM cases c
      LEFT JOIN office_orders   oo   ON oo.id  = c.store_order_id
      LEFT JOIN office_services osvc ON osvc.id = oo.service_id
      WHERE c.id = ${id} AND c.office_id = ${tenantId}
      LIMIT 1
    `);
    const raw: any[] = (rows as any).rows ?? (rows as any) ?? [];
    const c = raw[0];
    if (!c) return res.status(404).json({ error: "غير موجود" });

    const orderDetails = c.order_db_id ? {
      id:            c.order_db_id,
      serviceName:   c.order_service_name ?? null,
      serviceDesc:   c.order_service_desc ?? null,
      amount:        c.order_amount ? Number(c.order_amount) : null,
      clientEmail:   c.order_client_email ?? null,
      clientPhone:   c.order_client_phone ?? null,
      stripeSession: c.order_stripe_session ?? null,
      createdAt:     c.order_created_at instanceof Date ? c.order_created_at.toISOString() : c.order_created_at ?? null,
    } : null;

    res.json({
      id: c.id, title: c.title, description: c.description,
      caseType: c.case_type, status: c.status,
      clientName: c.client_name, assignedTo: c.assigned_to,
      source: c.source ?? "manual",
      storeOrderId: c.store_order_id ?? null,
      createdBy: c.created_by ?? null,
      orderDetails,
      createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : c.created_at,
      updatedAt: c.updated_at instanceof Date ? c.updated_at?.toISOString() ?? null : c.updated_at ?? null,
    });
  } catch (e: any) {
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
});

/* PATCH /cases/:id */
router.patch("/cases/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const id   = String(req.params.id);
    const body = UpdateCaseBody.parse(req.body);
    const { after } = await getService(req).updateCase(id, {
      title:       body.title,
      description: body.description,
      caseType:    body.caseType as any,
      status:      body.status as any,
      clientName:  body.clientName,
      assignedTo:  body.assignedTo,
    });
    res.json(serializeCase(after));
  } catch (e: any) {
    res.status(e.statusCode ?? 400).json({ error: e.message });
  }
});

/* DELETE /cases/:id */
router.delete("/cases/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await getService(req).deleteCase(String(req.params.id));
    res.status(204).end();
  } catch (e: any) {
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   HUB — all related entities in one call
══════════════════════════════════════════════════════ */
router.get("/cases/:id/hub", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const caseId   = String(req.params.id);
    const isUuid   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

    const [caseRow, invoices, events, documents] = await Promise.all([
      db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} AND office_id = ${tenantId} LIMIT 1`),
      db.execute(sql`SELECT id,invoice_number,title,total,status,due_date,created_at FROM client_invoices WHERE case_id = ${caseId} AND office_id = ${tenantId} ORDER BY created_at DESC`),
      db.execute(sql`SELECT id,title,event_type,start_at,location,status FROM events WHERE case_id = ${caseId} ORDER BY start_at DESC`),
      db.execute(sql`SELECT id,file_name,file_type,created_at FROM documents WHERE case_id = ${caseId} AND office_id = ${tenantId} ORDER BY created_at DESC`),
    ]);

    let contractRows: any[] = [];
    if (isUuid) {
      const cr = await db.execute(sql`SELECT id,title,type,status,expires_at,created_at FROM contracts WHERE case_id = ${caseId} AND office_id = ${tenantId} ORDER BY created_at DESC`);
      contractRows = (cr as any).rows ?? [];
    }

    const found = (caseRow as any).rows?.[0];
    if (!found) return res.status(404).json({ error: "غير موجود" });

    res.json({
      case:      found,
      invoices:  (invoices  as any).rows ?? [],
      contracts: contractRows,
      events:    (events    as any).rows ?? [],
      documents: (documents as any).rows ?? [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   TIMELINE
══════════════════════════════════════════════════════ */
router.get("/cases/:id/timeline", requireAuthWithTenant, async (req, res) => {
  try {
    const entries = await new CaseTimeline(getTenant(req)).getEntries(String(req.params.id));
    res.json(entries);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/cases/:id/timeline", requireAuthWithTenant, async (req, res) => {
  try {
    const auth   = getAuth(req);
    const entry  = await new CaseTimeline(getTenant(req)).addEntry(String(req.params.id), {
      ...req.body,
      created_by: auth?.userId,
    });
    auditLog({ userId: auth?.userId, action: "create", resource: "case_timeline", resourceId: String(req.params.id) }).catch(() => {});
    res.status(201).json(entry);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   COMMUNICATIONS (case chat)
══════════════════════════════════════════════════════ */
router.get("/cases/:id/messages", requireAuthWithTenant, async (req, res) => {
  try {
    const msgs = await new CaseCommunications(getTenant(req)).getMessages(String(req.params.id));
    res.json(msgs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/cases/:id/messages", requireAuthWithTenant, async (req, res) => {
  try {
    const { body: msgBody, sender_name } = req.body;
    if (!msgBody?.trim()) return res.status(400).json({ error: "الرسالة فارغة" });
    const auth = getAuth(req);
    const msg  = await new CaseCommunications(getTenant(req)).sendMessage(String(req.params.id), {
      body:        msgBody,
      sender_id:   auth?.userId,
      sender_name: sender_name ?? "المحامي",
    });
    res.status(201).json(msg);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   TASKS
══════════════════════════════════════════════════════ */
router.get("/cases/:id/tasks", requireAuthWithTenant, async (req, res) => {
  try {
    const tasks = await new CaseTasks(getTenant(req)).getTasks(String(req.params.id));
    res.json(tasks);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/cases/:id/tasks", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const caseId   = String(req.params.id);
    const caseData = await getService(req).getCase(caseId);
    const task     = await new CaseTasks(tenantId).createTask(caseId, caseData.title, req.body);
    res.status(201).json(task);
  } catch (e: any) {
    res.status(e.statusCode ?? 400).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   DOCUMENTS
══════════════════════════════════════════════════════ */
router.get("/cases/:id/documents", requireAuthWithTenant, async (req, res) => {
  try {
    const docs = await new CaseDocuments(getTenant(req)).getDocuments(String(req.params.id));
    res.json(docs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   AI AUTOPILOT
══════════════════════════════════════════════════════ */
router.get("/cases/:id/health", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const caseId   = String(req.params.id);
    const force    = req.query.force === "1";

    if (!force) {
      const cached = await db.execute(sql`
        SELECT * FROM case_autopilot_reports WHERE case_id = ${caseId} AND office_id = ${tenantId} LIMIT 1
      `).catch(() => null);
      const row = (cached as any)?.rows?.[0];
      if (row) return res.json(row);
    }

    await ensureAutopilotTable();
    const report = await runCaseAutopilot(caseId, tenantId, false);
    if (!report) return res.status(404).json({ error: "القضية غير موجودة" });
    res.json(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/cases/:id/autopilot", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const caseId   = String(req.params.id);
    const auth     = getAuth(req);

    await ensureAutopilotTable();
    const report = await runCaseAutopilot(caseId, tenantId, true);
    if (!report) return res.status(404).json({ error: "القضية غير موجودة" });

    auditLog({ userId: auth?.userId, action: "autopilot", resource: "cases", resourceId: caseId,
      details: `score=${report.healthScore} tasks=${report.tasksCreated}` }).catch(() => {});
    res.json(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   AI AUTONOMOUS ASSISTANT
══════════════════════════════════════════════════════ */

/** GET /cases/:id/ai-insights — latest cached insight */
router.get("/cases/:id/ai-insights", requireAuthWithTenant, async (req, res) => {
  try {
    const insight = await getLatestInsight(String(req.params.id), getTenant(req));
    res.json(insight ?? null);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /cases/:id/analyze — trigger fresh AI analysis */
router.post("/cases/:id/analyze", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const tenantId = getTenant(req);
    const result   = await runAIAnalysis(caseId, tenantId);
    if (!result) return res.status(404).json({ error: "القضية غير موجودة" });
    auditLog({ userId: getAuth(req)?.userId, action: "ai_analyze", resource: "cases",
      resourceId: caseId, details: `risks=${result.risks?.length ?? 0}` }).catch(() => {});
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /cases/:id/ai-insights/approve-task — approve → create real task */
router.post("/cases/:id/ai-insights/approve-task", requireAuthWithTenant, async (req, res) => {
  try {
    const { insightId, taskId } = req.body as { insightId: string; taskId: string };
    const result = await approveAITask(insightId, taskId, String(req.params.id), getTenant(req));
    if (!result) return res.status(404).json({ error: "المهمة غير موجودة أو تمت معالجتها مسبقاً" });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /cases/:id/ai-insights/reject-task — reject a pending auto-task */
router.post("/cases/:id/ai-insights/reject-task", requireAuthWithTenant, async (req, res) => {
  try {
    const { insightId, taskId } = req.body as { insightId: string; taskId: string };
    const result = await rejectAITask(insightId, taskId, getTenant(req));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
