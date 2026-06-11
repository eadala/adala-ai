import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/clients", async (_req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt));
  res.json(clients);
});

router.post("/clients", async (req, res) => {
  const [client] = await db.insert(clientsTable).values(req.body).returning();
  res.json(client);
});

router.patch("/clients/:id", async (req, res) => {
  const [updated] = await db.update(clientsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(clientsTable.id, req.params.id)).returning();
  res.json(updated);
});

router.delete("/clients/:id", async (req, res) => {
  await db.delete(clientsTable).where(eq(clientsTable.id, req.params.id));
  res.json({ success: true });
});

router.get("/clients/stats", async (_req, res) => {
  const all = await db.select().from(clientsTable);
  res.json({
    total: all.length,
    active: all.filter(c => c.status === "active").length,
    potential: all.filter(c => c.status === "potential").length,
    companies: all.filter(c => c.type === "company").length,
    individuals: all.filter(c => c.type === "individual").length,
  });
});

// ── GET /clients/:id ── single client ─────────────────────────────────────
router.get("/clients/:id", async (req, res) => {
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, req.params.id));
  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(client);
});

// ── GET /clients/:id/overview ── 360° view with related entities ──────────
router.get("/clients/:id/overview", async (req, res) => {
  try {
    const { sql } = await import("drizzle-orm");
    const clientId = req.params.id;
    const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!clientRow) { res.status(404).json({ error: "Not found" }); return; }

    const [cases, invoices, contracts, events] = await Promise.all([
      db.execute(sql`SELECT id, title, case_type, status, created_at FROM cases WHERE client_name ILIKE ${"%" + clientRow.fullName + "%"} ORDER BY created_at DESC LIMIT 20`),
      db.execute(sql`SELECT id, invoice_number, title, total, status, due_date, created_at FROM client_invoices WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 20`),
      db.execute(sql`SELECT id, title, type, status, expires_at, created_at FROM contracts WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 20`),
      db.execute(sql`SELECT id, title, event_type, start_at FROM events WHERE client_id = ${clientId} ORDER BY start_at DESC LIMIT 10`),
    ]);

    const inv = invoices.rows as any[];
    const paidTotal = inv.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total ?? 0), 0);
    const outstandingTotal = inv.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + Number(i.total ?? 0), 0);

    res.json({
      client: clientRow,
      cases: cases.rows ?? [],
      invoices: inv,
      contracts: contracts.rows ?? [],
      events: events.rows ?? [],
      stats: {
        casesCount: (cases.rows?.length ?? 0),
        invoicesCount: inv.length,
        paidTotal,
        outstandingTotal,
        contractsCount: (contracts.rows?.length ?? 0),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
