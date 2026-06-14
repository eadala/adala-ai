import { Router } from "express";
import { db, casesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { ListCasesQueryParams, CreateCaseBody, UpdateCaseBody } from "@workspace/api-zod";
import { auditLog } from "../lib/auditLogger";
import { notifyTelegramCaseStatus } from "./telegram";
import { eventBus } from "../core/eventBus";

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

router.get("/cases", async (req, res) => {
  try {
    const query = ListCasesQueryParams.parse(req.query);
    const page  = req.query.page  ? Math.max(1, parseInt(String(req.query.page)))  : null;
    const limit = req.query.limit ? Math.min(200, parseInt(String(req.query.limit))) : null;

    let cases = await db.select().from(casesTable).orderBy(casesTable.createdAt);
    if (query.status)   cases = cases.filter((c) => c.status   === query.status);
    if (query.caseType) cases = cases.filter((c) => c.caseType === query.caseType);

    const total = cases.length;
    if (page && limit) {
      cases = cases.slice((page - 1) * limit, page * limit);
      const mapped = cases.map((c) => ({
        id: c.id, title: c.title, description: c.description,
        caseType: c.caseType, status: c.status, clientName: c.clientName,
        assignedTo: c.assignedTo,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt?.toISOString() ?? null,
      }));
      res.json({ data: mapped, total, page, limit, pages: Math.ceil(total / limit) });
      return;
    }

    res.json(cases.map((c) => ({
      id: c.id, title: c.title, description: c.description,
      caseType: c.caseType, status: c.status, clientName: c.clientName,
      assignedTo: c.assignedTo,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt?.toISOString() ?? null,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/cases", async (req, res) => {
  try {
    const body = CreateCaseBody.parse(req.body);
    const [created] = await db.insert(casesTable).values({
      title: body.title,
      description: body.description ?? null,
      caseType: body.caseType,
      status: body.status ?? "open",
      clientName: body.clientName ?? null,
      assignedTo: body.assignedTo ?? null,
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

router.get("/cases/:id", async (req, res) => {
  try {
    const [found] = await db.select().from(casesTable).where(eq(casesTable.id, req.params.id));
    if (!found) return res.status(404).json({ error: "Not found" });
    res.json({ ...found, createdAt: found.createdAt.toISOString(), updatedAt: found.updatedAt?.toISOString() ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/cases/:id", async (req, res) => {
  try {
    const body = UpdateCaseBody.parse(req.body);
    const [before] = await db.select().from(casesTable).where(eq(casesTable.id, req.params.id));
    const [updated] = await db.update(casesTable).set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.caseType !== undefined && { caseType: body.caseType }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.clientName !== undefined && { clientName: body.clientName }),
      ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
      updatedAt: new Date(),
    }).where(eq(casesTable.id, req.params.id)).returning();
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

router.delete("/cases/:id", async (req, res) => {
  try {
    const auth = (req as any).auth;
    await db.delete(casesTable).where(eq(casesTable.id, req.params.id));
    auditLog({ userId: auth?.userId, action: "delete", resource: "cases", resourceId: req.params.id }).catch(() => {});
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /cases/:id/hub ── full case hub with related entities ──────────────
router.get("/cases/:id/hub", async (req, res) => {
  try {
    const { sql } = await import("drizzle-orm");
    const caseId = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

    const [caseRow, invoices, events, documents] = await Promise.all([
      db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} LIMIT 1`),
      db.execute(sql`SELECT id, invoice_number, title, total, status, due_date, created_at FROM client_invoices WHERE case_id = ${caseId} ORDER BY created_at DESC`),
      db.execute(sql`SELECT id, title, event_type, start_at, location, status FROM events WHERE case_id = ${caseId} ORDER BY start_at DESC`),
      db.execute(sql`SELECT id, file_name, file_type, created_at FROM documents WHERE case_id = ${caseId} ORDER BY created_at DESC`),
    ]);

    let contractRows: any[] = [];
    if (isUuid) {
      const contractsResult = await db.execute(sql`SELECT id, title, type, status, expires_at, created_at FROM contracts WHERE case_id = ${caseId}::uuid ORDER BY created_at DESC`);
      contractRows = contractsResult.rows ?? [];
    }

    const found = caseRow.rows?.[0];
    if (!found) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      case: found,
      invoices: invoices.rows ?? [],
      contracts: contractRows,
      events: events.rows ?? [],
      documents: documents.rows ?? [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
