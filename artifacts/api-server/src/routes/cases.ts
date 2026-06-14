import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router } from "express";
import { db, casesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { ListCasesQueryParams, CreateCaseBody, UpdateCaseBody } from "@workspace/api-zod";
import { auditLog } from "../lib/auditLogger";
import { notifyTelegramCaseStatus } from "./telegram";
import { eventBus } from "../core/eventBus";
import { requireAuthWithTenant } from "../middlewares/requireAuth";

const STATUS_LABELS: Record<string, string> = {
  open: "مفتوحة",
  in_progress: "قيد التنفيذ",
  closed: "مغلقة",
};

async function notifyWhatsAppCaseStatus(updatedCase: any) {
  try {
    const settingsRows = await db.execute(sql`
      SELECT * FROM whatsapp_settings WHERE office_id = 'default' LIMIT 1
    `) as any;
    const rows = Array.isArray(settingsRows) ? settingsRows : (settingsRows?.rows ?? []);
    const settings = rows[0];
    if (!settings?.enabled) return;

    const clientRows = await db.execute(sql`
      SELECT phone FROM clients
      WHERE full_name = ${updatedCase.clientName}
        AND phone IS NOT NULL
        AND phone <> ''
      ORDER BY created_at DESC LIMIT 1
    `) as any;
    const cRows = Array.isArray(clientRows) ? clientRows : (clientRows?.rows ?? []);
    const phone = cRows[0]?.phone;
    if (!phone) return;

    const statusLabel = STATUS_LABELS[updatedCase.status] ?? updatedCase.status;
    const message = `السلام عليكم،\nتم تحديث حالة قضيتكم "${updatedCase.title}" إلى: ${statusLabel}.\nشكراً لثقتكم.`;

    let sent = false;
    let errorMsg = "";
    try {
      if (settings.provider === "twilio" && settings.account_sid && settings.auth_token && settings.from_number) {
        const encoded = Buffer.from(`${settings.account_sid}:${settings.auth_token}`).toString("base64");
        const body = new URLSearchParams({ From: `whatsapp:${settings.from_number}`, To: `whatsapp:${phone}`, Body: message });
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.account_sid}/Messages.json`, {
          method: "POST", headers: { Authorization: `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        sent = r.ok;
        if (!r.ok) errorMsg = await r.text();
      } else if (settings.provider === "meta" && settings.meta_token && settings.meta_phone_id) {
        const r = await fetch(`https://graph.facebook.com/v18.0/${settings.meta_phone_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${settings.meta_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
        });
        sent = r.ok;
        if (!r.ok) errorMsg = await r.text();
      }
    } catch (e: any) { errorMsg = e.message; }

    await db.execute(sql`
      INSERT INTO whatsapp_logs (office_id, to_number, message, template, status, error)
      VALUES ('default', ${phone}, ${message}, 'case_update', ${sent ? "sent" : "failed"}, ${errorMsg || null})
    `);
  } catch { }
}

const router = Router();

// ── GET /cases ──────────────────────────────────────────────────────────────
router.get("/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const query = ListCasesQueryParams.parse(req.query);
    const page  = req.query.page  ? Math.max(1, parseInt(String(req.query.page)))  : null;
    const limit = req.query.limit ? Math.min(200, parseInt(String(req.query.limit))) : null;

    const rawRows = await db.execute(sql`
      SELECT id, title, description, case_type, status, client_name, assigned_to,
             created_at, updated_at,
             COALESCE(source, 'manual') AS source,
             store_order_id
      FROM cases WHERE office_id = ${tenantId} ORDER BY created_at
    `);
    let allCases: any[] = (rawRows as any)?.rows ?? (rawRows as any) ?? [];
    const mapCase = (c: any) => ({
      id: c.id, title: c.title, description: c.description,
      caseType: c.case_type, status: c.status, clientName: c.client_name,
      assignedTo: c.assigned_to,
      source: c.source ?? "manual",
      storeOrderId: c.store_order_id ?? null,
      createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : c.created_at,
      updatedAt: c.updated_at instanceof Date ? c.updated_at?.toISOString() ?? null : c.updated_at ?? null,
    });

    if (query.status)   allCases = allCases.filter((c) => c.status    === query.status);
    if (query.caseType) allCases = allCases.filter((c) => c.case_type === query.caseType);

    const total = allCases.length;
    if (page && limit) {
      const sliced = allCases.slice((page - 1) * limit, page * limit);
      res.json({ data: sliced.map(mapCase), total, page, limit, pages: Math.ceil(total / limit) });
      return;
    }

    res.json(allCases.map(mapCase));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /cases ──────────────────────────────────────────────────────────────
router.post("/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const body = CreateCaseBody.parse(req.body);
    const [created] = await db.insert(casesTable).values({
      title:       body.title,
      description: body.description ?? null,
      caseType:    body.caseType,
      status:      body.status ?? "open",
      clientName:  body.clientName ?? null,
      assignedTo:  body.assignedTo ?? null,
      officeId:    tenantId,
    }).returning();
    const auth = (req as any).auth;
    auditLog({ userId: auth?.userId, action: "create", resource: "cases", resourceId: created.id, details: created.title }).catch(() => {});
    eventBus.emit({
      type: "CASE_CREATED",
      actorId: auth?.userId,
      data: { caseId: created.id, title: created.title, clientName: created.clientName, assignedTo: created.assignedTo, caseType: created.caseType, status: created.status },
    }).catch(() => {});
    res.status(201).json({
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt?.toISOString() ?? null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── GET /cases/:id ───────────────────────────────────────────────────────────
router.get("/cases/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const rows = await db.execute(sql`
      SELECT
        c.id, c.title, c.description, c.case_type, c.status,
        c.client_name, c.assigned_to, c.created_at, c.updated_at,
        COALESCE(c.source, 'manual')  AS source,
        c.store_order_id,
        c.created_by,
        oo.id                        AS order_db_id,
        oo.amount                    AS order_amount,
        oo.client_email              AS order_client_email,
        oo.client_phone              AS order_client_phone,
        oo.stripe_session_id         AS order_stripe_session,
        oo.created_at                AS order_created_at,
        osvc.name                    AS order_service_name,
        osvc.description             AS order_service_desc
      FROM cases c
      LEFT JOIN office_orders   oo   ON oo.id   = c.store_order_id
      LEFT JOIN office_services osvc ON osvc.id  = oo.service_id
      WHERE c.id = ${req.params.id} AND c.office_id = ${tenantId}
      LIMIT 1
    `);
    const rawArr: any[] = (rows as any)?.rows ?? (rows as any) ?? [];
    const c = rawArr[0];
    if (!c) return res.status(404).json({ error: "Not found" });

    const orderDetails = c.order_db_id ? {
      id: c.order_db_id,
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
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /cases/:id ─────────────────────────────────────────────────────────
router.patch("/cases/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const body = UpdateCaseBody.parse(req.body);
    const [before] = await db.select().from(casesTable)
      .where(and(eq(casesTable.id, req.params.id), eq(casesTable.officeId, tenantId)));
    if (!before) return res.status(404).json({ error: "Not found" });

    const [updated] = await db.update(casesTable).set({
      ...(body.title       !== undefined && { title:       body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.caseType    !== undefined && { caseType:    body.caseType }),
      ...(body.status      !== undefined && { status:      body.status }),
      ...(body.clientName  !== undefined && { clientName:  body.clientName }),
      ...(body.assignedTo  !== undefined && { assignedTo:  body.assignedTo }),
      updatedAt: new Date(),
    }).where(and(eq(casesTable.id, req.params.id), eq(casesTable.officeId, tenantId))).returning();
    if (!updated) return res.status(404).json({ error: "Not found" });

    if (body.status && before && before.status !== body.status) {
      notifyWhatsAppCaseStatus(updated).catch(() => {});
      notifyTelegramCaseStatus(updated).catch(() => {});
    }
    const auth = (req as any).auth;
    auditLog({ userId: auth?.userId, action: "update", resource: "cases", resourceId: req.params.id, details: updated.title }).catch(() => {});
    const evType = updated.status === "closed" ? "CASE_CLOSED" : "CASE_UPDATED";
    eventBus.emit({
      type: evType,
      actorId: auth?.userId,
      data: { caseId: updated.id, title: updated.title, clientName: updated.clientName, status: updated.status, assignedTo: updated.assignedTo },
    }).catch(() => {});
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt?.toISOString() ?? null });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── DELETE /cases/:id ────────────────────────────────────────────────────────
router.delete("/cases/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const auth = (req as any).auth;
    await db.delete(casesTable)
      .where(and(eq(casesTable.id, req.params.id), eq(casesTable.officeId, tenantId)));
    auditLog({ userId: auth?.userId, action: "delete", resource: "cases", resourceId: req.params.id }).catch(() => {});
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /cases/:id/hub ── full case hub with related entities ─────────────────
router.get("/cases/:id/hub", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const caseId = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

    const [caseRow, invoices, events, documents] = await Promise.all([
      db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} AND office_id = ${tenantId} LIMIT 1`),
      db.execute(sql`SELECT id, invoice_number, title, total, status, due_date, created_at FROM client_invoices WHERE case_id = ${caseId} AND office_id = ${tenantId} ORDER BY created_at DESC`),
      db.execute(sql`SELECT id, title, event_type, start_at, location, status FROM events WHERE case_id = ${caseId} ORDER BY start_at DESC`),
      db.execute(sql`SELECT id, file_name, file_type, created_at FROM documents WHERE case_id = ${caseId} AND office_id = ${tenantId} ORDER BY created_at DESC`),
    ]);

    let contractRows: any[] = [];
    if (isUuid) {
      const contractsResult = await db.execute(sql`SELECT id, title, type, status, expires_at, created_at FROM contracts WHERE case_id = ${caseId}::uuid AND office_id = ${tenantId} ORDER BY created_at DESC`);
      contractRows = contractsResult.rows ?? [];
    }

    const found = caseRow.rows?.[0];
    if (!found) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      case:      found,
      invoices:  invoices.rows ?? [],
      contracts: contractRows,
      events:    events.rows ?? [],
      documents: documents.rows ?? [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
