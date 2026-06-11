import { Router } from "express";
import { db, casesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListCasesQueryParams, CreateCaseBody, UpdateCaseBody } from "@workspace/api-zod";

const router = Router();

router.get("/cases", async (req, res) => {
  try {
    const query = ListCasesQueryParams.parse(req.query);
    let cases = await db.select().from(casesTable).orderBy(casesTable.createdAt);
    if (query.status) cases = cases.filter((c) => c.status === query.status);
    if (query.caseType) cases = cases.filter((c) => c.caseType === query.caseType);
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
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt?.toISOString() ?? null });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/cases/:id", async (req, res) => {
  try {
    await db.delete(casesTable).where(eq(casesTable.id, req.params.id));
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
