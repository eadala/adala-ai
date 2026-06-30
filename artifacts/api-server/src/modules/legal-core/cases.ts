/**
 * Cases Router — واجهة API للقضايا (Architecture: Clean Controller)
 * ──────────────────────────────────────────────────────────────────
 * ✅ thin controller only — business logic في CaseService
 * ✅ tenant scoping in every request
 * ✅ same URL contract as before (backward compatible)
 */

import { Router }                                  from "express";
import { requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { CaseService }                             from "../../case/case.service";
import { CaseTimeline }                            from "../../case/modules/timeline";
import { CaseCommunications }                      from "../../case/modules/communications";
import { CaseTasks }                               from "../../case/modules/tasks";
import { CaseDocuments }                           from "../../case/modules/documents";
import { db }                                      from "@workspace/db";
import { sql }                                     from "drizzle-orm";
import { runCaseAutopilot, ensureAutopilotTable }  from "../../agents/caseAutopilot";
import { auditLog, auditMeta }                      from "../../lib/auditLogger";
import { ListCasesQueryParams, CreateCaseBody, UpdateCaseBody } from "@workspace/api-zod";
import { runAIAnalysis, getLatestInsight, approveAITask, rejectAITask } from "../../case/case.ai";

const router = Router();

/* ════════════════════════════════════════════════════
   ONE-TIME STARTUP MIGRATIONS
════════════════════════════════════════════════════ */
(async () => {
  const migs = [
    /* Soft delete */
    sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`,
    /* Optimistic locking */
    sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`,
    /* Clients soft delete */
    sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`,
    /* Performance indexes */
    sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`,
    sql`CREATE INDEX IF NOT EXISTS idx_cases_title_trgm ON cases USING GIN (title gin_trgm_ops)`,
    sql`CREATE INDEX IF NOT EXISTS idx_cases_client_name ON cases (LOWER(client_name))`,
    sql`CREATE INDEX IF NOT EXISTS idx_cases_office_active ON cases (office_id) WHERE deleted_at IS NULL`,
    /* Partial unique index — allows multiple NULLs in same office */
    sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_cases_office_case_number
        ON cases (office_id, case_number) WHERE case_number IS NOT NULL`,
  ];
  for (const m of migs) {
    await db.execute(m).catch(() => {});
  }
})();

function getTenant(req: any): string { return req.tenantId; }
function getAuth(req: any)           { return req.auth; }
function getService(req: any)        { return new CaseService(getTenant(req), getAuth(req)?.userId); }

/* Helper: resolve office role for the current user */
async function getOfficeRole(userId: string, tenantId: string): Promise<string> {
  try {
    const rows = await db.execute(sql`
      SELECT role FROM office_members
      WHERE user_id = ${userId} AND office_id = ${tenantId} AND status = 'active'
      LIMIT 1
    `);
    return ((rows as any).rows ?? rows)?.[0]?.role ?? "lawyer";
  } catch { return "lawyer"; }
}

const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

function serializeCase(c: any) {
  return {
    id:                  c.id,
    title:               c.title,
    description:         c.description,
    caseType:            c.caseType   ?? c.case_type,
    status:              c.status,
    clientName:          c.clientName ?? c.client_name,
    assignedTo:          c.assignedTo ?? c.assigned_to,
    source:              c.source     ?? "manual",
    storeOrderId:        c.storeOrderId ?? c.store_order_id ?? null,
    createdBy:           c.createdBy   ?? c.created_by    ?? null,
    /* ── Court & Hearing fields ── */
    caseNumber:          c.caseNumber  ?? c.case_number   ?? null,
    courtName:           c.courtName   ?? c.court_name    ?? null,
    courtCode:           c.courtCode   ?? c.court_code    ?? null,
    courtCity:           c.courtCity   ?? c.court_city    ?? null,
    courtDistrictNumber: c.courtDistrictNumber ?? c.court_district_number ?? null,
    courtDistrictType:   c.courtDistrictType   ?? c.court_district_type   ?? null,
    nextHearingDate:     c.nextHearingDate      ?? c.next_hearing_date     ?? null,
    createdAt:           c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt:           c.updatedAt instanceof Date ? c.updatedAt?.toISOString() ?? null : c.updatedAt ?? null,
  };
}

/* ══════════════════════════════════════════════════════
   CRUD
══════════════════════════════════════════════════════ */

/* GET /cases */
router.get("/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const q      = ListCasesQueryParams.parse(req.query);
    const page   = req.query.page   ? Math.max(1, parseInt(String(req.query.page)))    : null;
    const limit  = req.query.limit  ? Math.min(200, parseInt(String(req.query.limit))) : null;
    const search = req.query.search ? String(req.query.search) : undefined;

    /* ── Row-level visibility by role ── */
    const userId   = getAuth(req)?.userId as string | undefined;
    const tenantId = getTenant(req);
    const isSA     = (req as any).isSuperAdmin;

    let assignedUserId: string | undefined;
    if (!isSA && userId) {
      const role = await getOfficeRole(userId, tenantId);
      if (!PRIVILEGED_ROLES.has(role)) {
        assignedUserId = userId;
      }
    }

    const filters = {
      status:   q.status   as any,
      caseType: q.caseType as any,
      search,
      assignedUserId,
      ...(page && limit ? { limit, offset: (page - 1) * limit } : {}),
    };

    const svc   = getService(req);
    const cases = await svc.listCases(filters);

    if (page && limit) {
      const total = await svc.countCases({ status: filters.status, caseType: filters.caseType, search, assignedUserId });
      res.json({ data: cases.map(serializeCase), total, page, limit, pages: Math.ceil(total / limit) });
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
    auditLog({ ...auditMeta(req), action: "create", resource: "case", resourceId: String(created.id), details: `عنوان: ${body.title}` }).catch(() => {});
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
        c.case_number, c.court_name, c.court_code, c.court_city,
        c.court_district_number, c.court_district_type, c.next_hearing_date,
        oo.id          AS order_db_id,
        oo.amount      AS order_amount,
        oo.client_email AS order_client_email,
        oo.client_phone AS order_client_phone,
        oo.stripe_session_id AS order_stripe_session,
        oo.created_at  AS order_created_at,
        osvc.name      AS order_service_name,
        osvc.description AS order_service_desc
      FROM cases c
      LEFT JOIN office_orders   oo   ON oo.id::text = c.store_order_id
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
      /* ── Court & Hearing ── */
      caseNumber:          c.case_number          ?? null,
      courtName:           c.court_name           ?? null,
      courtCode:           c.court_code           ?? null,
      courtCity:           c.court_city           ?? null,
      courtDistrictNumber: c.court_district_number ?? null,
      courtDistrictType:   c.court_district_type  ?? null,
      nextHearingDate:     c.next_hearing_date     ?? null,
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
    const id    = String(req.params.id);
    /* Read version and force BEFORE Zod strips them */
    const clientVersion: number | undefined = typeof req.body.version === "number" ? req.body.version : undefined;
    const force: boolean = req.body.force === true;

    const body  = UpdateCaseBody.parse(req.body);
    const svc   = getService(req);

    /* ── Fix 5: warn if closing with unpaid invoices ── */
    if (body.status === "closed" && !force) {
      const caseId = id;
      const tenantId = getTenant(req);
      const unpaidRows = await db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM client_invoices
        WHERE case_id = ${caseId} AND office_id = ${tenantId} AND status != 'paid'
      `);
      const unpaidCount = Number(((unpaidRows as any).rows ?? unpaidRows)?.[0]?.cnt ?? 0);
      if (unpaidCount > 0) {
        res.json({
          requiresConfirmation: true,
          warning: true,
          unpaidCount,
          message: `لديك ${unpaidCount} فاتورة غير مدفوعة مرتبطة بهذه القضية. هل تريد إغلاقها رغم ذلك؟`,
        });
        return;
      }
    }

    const before = await svc.getCase(id).catch(() => null);
    const { after } = await svc.updateCase(id, {
      title:       body.title,
      description: body.description,
      caseType:    body.caseType as any,
      status:      body.status as any,
      clientName:  body.clientName,
      assignedTo:  body.assignedTo,
      version:     clientVersion,
    });
    auditLog({
      ...auditMeta(req), action: "update", resource: "case", resourceId: id,
      oldValue: before ? { title: (before as any).title, status: (before as any).status, assignedTo: (before as any).assignedTo } : null,
      newValue: { title: body.title, status: body.status, assignedTo: body.assignedTo },
    }).catch(() => {});
    res.json(serializeCase(after));
  } catch (e: any) {
    res.status(e.statusCode ?? 400).json({ error: e.message });
  }
});

/* DELETE /cases/:id — soft delete (moves to archive) */
router.delete("/cases/:id", requireAuthWithTenant, requirePermission("cases:delete"), async (req, res) => {
  try {
    const delId = String(req.params.id);
    await getService(req).deleteCase(delId);
    auditLog({ ...auditMeta(req), action: "soft_delete", resource: "case", resourceId: delId }).catch(() => {});
    res.status(204).end();
  } catch (e: any) {
    res.status(e.statusCode ?? 500).json({ error: e.message });
  }
});

/* DELETE /cases/:id/hard — permanent, super_admin only */
router.delete("/cases/:id/hard", requireAuthWithTenant, async (req, res) => {
  if (!(req as any).isSuperAdmin) {
    return res.status(403).json({ error: "الحذف النهائي متاح لمدير النظام فقط" });
  }
  try {
    const delId = String(req.params.id);
    await getService(req).hardDeleteCase(delId);
    auditLog({ ...auditMeta(req), action: "hard_delete", resource: "case", resourceId: delId }).catch(() => {});
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

/* ══════════════════════════════════════════════════════
   COURT INFO — PATCH /cases/:id/court
══════════════════════════════════════════════════════ */
router.patch("/cases/:id/court", requireAuthWithTenant, async (req, res) => {
  try {
    const id       = String(req.params.id);
    const tenantId = getTenant(req);
    const { caseNumber, courtName, courtCode, courtCity, districtNumber, districtType } = req.body;
    await db.execute(sql`
      UPDATE cases SET
        case_number            = ${caseNumber ?? null},
        court_name             = ${courtName ?? null},
        court_code             = ${courtCode ?? null},
        court_city             = ${courtCity ?? null},
        court_district_number  = ${districtNumber ? Number(districtNumber) : null},
        court_district_type    = ${districtType ?? null},
        updated_at             = NOW()
      WHERE id = ${id} AND office_id = ${tenantId}
    `);
    auditLog({ ...auditMeta(req), action: "update", resource: "case_court", resourceId: id }).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   HEARINGS CALENDAR — GET /cases/hearings/calendar
   (must be registered BEFORE /:id routes to avoid conflict)
══════════════════════════════════════════════════════ */
router.get("/cases/hearings/calendar", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getTenant(req);
    const rows = await db.execute(sql`
      SELECT
        h.id, h.case_id, h.hearing_date, h.court_room, h.status, h.notes, h.outcome,
        c.title AS case_title, c.case_number, c.court_name, c.case_type, c.status AS case_status,
        c.client_name, c.assigned_to
      FROM case_hearings h
      JOIN cases c ON c.id = h.case_id
      WHERE h.office_id = ${tenantId}
        AND h.hearing_date >= NOW() - INTERVAL '7 days'
      ORDER BY h.hearing_date ASC
      LIMIT 200
    `);
    res.json((rows as any).rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   HEARINGS CRUD — /cases/:id/hearings
══════════════════════════════════════════════════════ */

async function getCaseTitle(caseId: string, tenantId: string): Promise<string> {
  try {
    const r = await db.execute(sql`SELECT title FROM cases WHERE id = ${caseId} AND office_id = ${tenantId} LIMIT 1`);
    return ((r as any).rows ?? [])[0]?.title ?? "قضية";
  } catch { return "قضية"; }
}

async function syncHearingToCalendar(
  hearingId: string, caseId: string, tenantId: string,
  hearingDate: string, courtRoom: string | null, hearingStatus: string, caseTitle: string,
) {
  try {
    const eventId  = `hearing-${hearingId}`;
    const endAt    = new Date(new Date(hearingDate).getTime() + 2 * 60 * 60 * 1000).toISOString();
    const evtStatus = hearingStatus === "cancelled" ? "cancelled" : "upcoming";
    const title    = `جلسة: ${caseTitle}`;
    await db.execute(sql`
      INSERT INTO events
        (id, user_id, title, event_type, start_at, end_at, all_day,
         case_id, office_id, location, status, created_at, updated_at)
      VALUES
        (${eventId}, 'system', ${title}, 'court_session',
         ${hearingDate}::timestamptz, ${endAt}::timestamptz, false,
         ${caseId}, ${tenantId}, ${courtRoom ?? null}, ${evtStatus}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        title      = EXCLUDED.title,
        start_at   = EXCLUDED.start_at,
        end_at     = EXCLUDED.end_at,
        location   = EXCLUDED.location,
        status     = EXCLUDED.status,
        updated_at = NOW()
    `);
  } catch { /* non-blocking */ }
}

async function deleteHearingFromCalendar(hearingId: string) {
  try {
    await db.execute(sql`DELETE FROM events WHERE id = ${"hearing-" + hearingId}`);
  } catch { /* non-blocking */ }
}

async function createHearingReminder(
  tenantId: string, hearingDate: string, caseTitle: string,
) {
  try {
    const d = new Date(hearingDate);
    d.setDate(d.getDate() - 1);
    const dueDateStr = d.toISOString().slice(0, 10);
    await db.execute(sql`
      INSERT INTO reminders (office_id, title, body, due_date, due_time, priority, category, done, created_at)
      VALUES (
        ${tenantId},
        ${"تذكير جلسة: " + caseTitle},
        ${"جلسة محكمة مقررة بتاريخ " + new Date(hearingDate).toLocaleDateString("ar-SA")},
        ${dueDateStr}::date,
        '08:00', 'high', 'hearing', false, NOW()
      )
    `);
  } catch { /* non-blocking */ }
}

async function syncNextHearing(caseId: string, tenantId: string) {
  const next = await db.execute(sql`
    SELECT hearing_date FROM case_hearings
    WHERE case_id = ${caseId} AND office_id = ${tenantId}
      AND hearing_date > NOW()
      AND status != 'cancelled'
    ORDER BY hearing_date ASC LIMIT 1
  `);
  const row = ((next as any).rows ?? [])[0];
  await db.execute(sql`
    UPDATE cases SET next_hearing_date = ${row?.hearing_date ?? null}
    WHERE id = ${caseId} AND office_id = ${tenantId}
  `);
}

/* GET /cases/:id/hearings */
router.get("/cases/:id/hearings", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const tenantId = getTenant(req);
    const rows = await db.execute(sql`
      SELECT id, case_id, hearing_date, court_room, status, notes, outcome, created_at
      FROM case_hearings
      WHERE case_id = ${caseId} AND office_id = ${tenantId}
      ORDER BY hearing_date DESC
    `);
    res.json((rows as any).rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /cases/:id/hearings */
router.post("/cases/:id/hearings", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const tenantId = getTenant(req);
    const { hearingDate, courtRoom, status = "scheduled", notes } = req.body;
    if (!hearingDate) return res.status(400).json({ error: "تاريخ الجلسة مطلوب" });

    const ins = await db.execute(sql`
      INSERT INTO case_hearings (case_id, office_id, hearing_date, court_room, status, notes)
      VALUES (${caseId}, ${tenantId}, ${hearingDate}, ${courtRoom ?? null}, ${status}, ${notes ?? null})
      RETURNING *
    `);
    const newHearing = ((ins as any).rows ?? [])[0];
    await syncNextHearing(caseId, tenantId);

    /* ── مزامنة التقويم والتذكيرات ── */
    if (newHearing) {
      const caseTitle = await getCaseTitle(caseId, tenantId);
      await syncHearingToCalendar(
        String(newHearing.id), caseId, tenantId,
        hearingDate, courtRoom ?? null, status, caseTitle,
      );
      await createHearingReminder(tenantId, hearingDate, caseTitle);
    }

    auditLog({ ...auditMeta(req), action: "create", resource: "hearing", resourceId: caseId,
      details: `جلسة: ${hearingDate}` }).catch(() => {});
    res.status(201).json(newHearing);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* PATCH /cases/:id/hearings/:hid */
router.patch("/cases/:id/hearings/:hid", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const hid      = String(req.params.hid);
    const tenantId = getTenant(req);
    const { hearingDate, courtRoom, status, notes, outcome } = req.body;
    await db.execute(sql`
      UPDATE case_hearings SET
        hearing_date = COALESCE(${hearingDate ?? null}::timestamptz, hearing_date),
        court_room   = COALESCE(${courtRoom ?? null}, court_room),
        status       = COALESCE(${status ?? null}, status),
        notes        = COALESCE(${notes ?? null}, notes),
        outcome      = COALESCE(${outcome ?? null}, outcome),
        updated_at   = NOW()
      WHERE id = ${hid}::uuid AND case_id = ${caseId} AND office_id = ${tenantId}
    `);
    await syncNextHearing(caseId, tenantId);

    /* ── مزامنة التقويم بعد التعديل ── */
    const updated = await db.execute(sql`
      SELECT hearing_date, court_room, status FROM case_hearings
      WHERE id = ${hid}::uuid AND office_id = ${tenantId} LIMIT 1
    `);
    const upd = ((updated as any).rows ?? [])[0];
    if (upd) {
      const caseTitle = await getCaseTitle(caseId, tenantId);
      await syncHearingToCalendar(
        hid, caseId, tenantId,
        upd.hearing_date, upd.court_room ?? null, upd.status ?? "scheduled", caseTitle,
      );
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/* DELETE /cases/:id/hearings/:hid */
router.delete("/cases/:id/hearings/:hid", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const hid      = String(req.params.hid);
    const tenantId = getTenant(req);
    await db.execute(sql`
      DELETE FROM case_hearings
      WHERE id = ${hid}::uuid AND case_id = ${caseId} AND office_id = ${tenantId}
    `);
    await syncNextHearing(caseId, tenantId);
    await deleteHearingFromCalendar(hid);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   CASE DOCUMENTS — /cases/:id/documents
   GET  → list all docs for a case (no file_url to keep response light)
   POST → upload a new doc (base64 fileData in body)
   DELETE /cases/:id/documents/:did → remove a doc
═══════════════════════════════════════════════════════ */

/* GET /cases/:id/documents */
router.get("/cases/:id/documents", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const tenantId = getTenant(req);
    /* Exclude file_url from list (heavy) — only sent on /download */
    const { rows } = await db.execute(sql`
      SELECT id, case_id, file_name, file_type, file_size,
             uploaded_by, uploaded_by_name, created_at
      FROM documents
      WHERE case_id = ${caseId} AND office_id = ${tenantId}
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /cases/:id/documents */
router.post("/cases/:id/documents", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const tenantId = getTenant(req);
    const userId   = (req as any).auth?.userId ?? "";
    const { fileName, fileType, fileData, uploadedByName } = req.body ?? {};

    if (!fileData || !fileName) {
      return res.status(400).json({ error: "اسم الملف والبيانات مطلوبة" });
    }

    /* ── MIME type allowlist ── */
    const ALLOWED_MIME = new Set([
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      "text/plain", "text/csv",
      "application/zip", "application/x-zip-compressed",
    ]);
    const resolvedMime = fileType ?? "application/octet-stream";
    if (!ALLOWED_MIME.has(resolvedMime)) {
      return res.status(415).json({ error: `نوع الملف غير مدعوم: ${resolvedMime}` });
    }

    /* Enforce reasonable size: base64 of 10 MB ≈ 14 MB string */
    if (typeof fileData === "string" && fileData.length > 15_000_000) {
      return res.status(413).json({ error: "حجم الملف أكبر من المسموح (10 MB)" });
    }

    /* Derive actual byte size from base64 length */
    const comma     = typeof fileData === "string" ? fileData.indexOf(",") : -1;
    const b64part   = comma !== -1 ? fileData.slice(comma + 1) : (fileData as string);
    const fileSize  = Math.floor(b64part.length * 0.75);

    const { rows } = await db.execute(sql`
      INSERT INTO documents
        (case_id, office_id, file_url, file_type, file_name, file_size, uploaded_by, uploaded_by_name)
      VALUES
        (${caseId}, ${tenantId}, ${fileData}, ${fileType ?? "application/octet-stream"},
         ${fileName}, ${fileSize}, ${userId}, ${uploadedByName ?? ""})
      RETURNING id, case_id, file_name, file_type, file_size, uploaded_by, uploaded_by_name, created_at
    `);
    auditLog({
      ...auditMeta(req),
      action: "upload", resource: "document", resourceId: String((rows[0] as any).id),
      details: `مستند: ${fileName} (${fileSize} bytes) — قضية: ${caseId}`,
    }).catch(() => {});
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* GET /cases/:id/documents/:did/download — return the file data */
router.get("/cases/:id/documents/:did/download", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const did      = String(req.params.did);
    const tenantId = getTenant(req);
    const { rows } = await db.execute(sql`
      SELECT file_url, file_name, file_type
      FROM documents
      WHERE id = ${did} AND case_id = ${caseId} AND office_id = ${tenantId}
      LIMIT 1
    `);
    if (!rows.length) return res.status(404).json({ error: "غير موجود" });
    const doc = rows[0] as any;
    /* file_url is a base64 data URL — strip prefix and send as buffer */
    const dataUrl: string = doc.file_url ?? "";
    const comma = dataUrl.indexOf(",");
    if (comma === -1) return res.status(500).json({ error: "تنسيق الملف غير صحيح" });
    const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : (doc.file_type ?? "application/octet-stream");
    const buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
    const safeName = encodeURIComponent(doc.file_name ?? "document");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${safeName}`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* DELETE /cases/:id/documents/:did */
router.delete("/cases/:id/documents/:did", requireAuthWithTenant, async (req, res) => {
  try {
    const caseId   = String(req.params.id);
    const did      = String(req.params.did);
    const tenantId = getTenant(req);
    await db.execute(sql`
      DELETE FROM documents
      WHERE id = ${did} AND case_id = ${caseId} AND office_id = ${tenantId}
    `);
    auditLog({ ...auditMeta(req), action: "delete", resource: "document", resourceId: did }).catch(() => {});
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
