/**
 * Clients routes — fixed:
 *  1. Auth (getAuth) added to all write routes
 *  2. req.body spread replaced with explicit field extraction
 *  3. Fields aligned with actual DB schema (fullName, no address/caseIds)
 *  4. try/catch added throughout
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

function requireAuth(req: any, res: any): boolean {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return false; }
  return true;
}

router.get("/clients", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const clients = await db.select().from(clientsTable).orderBy(desc(clientsTable.createdAt));
    res.json(clients);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/clients", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const {
      fullName, type = "individual", email, phone,
      nationalId, company, notes, status = "active", source, tags,
    } = req.body as {
      fullName: string; type?: string; email?: string; phone?: string;
      nationalId?: string; company?: string; notes?: string;
      status?: string; source?: string; tags?: string[];
    };
    if (!fullName) return res.status(400).json({ error: "اسم الموكل مطلوب" });

    const [client] = await db.insert(clientsTable).values({
      fullName, type,
      email:      email      ?? null,
      phone:      phone      ?? null,
      nationalId: nationalId ?? null,
      company:    company    ?? null,
      notes:      notes      ?? null,
      status,
      source:     source     ?? "direct",
      tags:       tags       ?? [],
    }).returning();
    res.json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const { fullName, type, email, phone, nationalId, company, notes, status, source, tags } = req.body;
    const [updated] = await db.update(clientsTable)
      .set({
        ...(fullName   !== undefined && { fullName }),
        ...(type       !== undefined && { type }),
        ...(email      !== undefined && { email }),
        ...(phone      !== undefined && { phone }),
        ...(nationalId !== undefined && { nationalId }),
        ...(company    !== undefined && { company }),
        ...(notes      !== undefined && { notes }),
        ...(status     !== undefined && { status }),
        ...(source     !== undefined && { source }),
        ...(tags       !== undefined && { tags }),
        updatedAt: new Date(),
      })
      .where(eq(clientsTable.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "الموكل غير موجود" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/clients/:id", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    await db.delete(clientsTable).where(eq(clientsTable.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Single client ────────────────────────────────── */
router.get("/clients/:id", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const [client] = await db.select().from(clientsTable)
      .where(eq(clientsTable.id, req.params.id));
    if (!client) return res.status(404).json({ error: "الموكل غير موجود" });
    res.json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/clients/:id/overview", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const { id } = req.params;

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) return res.status(404).json({ error: "الموكل غير موجود" });

    async function safeRows(q: any): Promise<any[]> {
      try {
        const r = await db.execute(q) as any;
        return Array.isArray(r) ? r : (r?.rows ?? []);
      } catch { return []; }
    }

    const [cases, invoices, contracts, events, messages] = await Promise.all([
      safeRows(sql`SELECT * FROM cases WHERE client_id = ${id} ORDER BY created_at DESC LIMIT 20`),
      safeRows(sql`SELECT * FROM client_invoices WHERE client_id = ${id} ORDER BY created_at DESC LIMIT 20`),
      safeRows(sql`SELECT * FROM contracts WHERE client_id = ${id} ORDER BY created_at DESC LIMIT 20`),
      safeRows(sql`SELECT * FROM events WHERE client_id = ${id} ORDER BY start_at DESC LIMIT 10`),
      safeRows(sql`SELECT * FROM office_messages WHERE client_id = ${id} ORDER BY created_at DESC LIMIT 10`),
    ]);

    /* Use `total` (stored in minor units as integer) matching DB schema */
    const paidTotal = invoices
      .filter((i: any) => i.status === "paid")
      .reduce((s: number, i: any) => s + (parseInt(String(i.total ?? 0)) / 100), 0);
    const outstandingTotal = invoices
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
      .reduce((s: number, i: any) => s + (parseInt(String(i.total ?? 0)) / 100), 0);

    /* Build lightweight activity log */
    const activities = [
      { type: "client_created", date: client.createdAt, label: "تم إضافة الموكل" },
      ...cases.map((c: any) => ({ type: "case_created", date: c.created_at, label: `قضية: ${c.title}` })),
      ...invoices.map((i: any) => ({ type: "invoice_created", date: i.created_at, label: `فاتورة: ${i.invoice_number ?? i.id}` })),
      ...contracts.map((c: any) => ({ type: "contract_created", date: c.created_at, label: `عقد: ${c.title}` })),
      ...events.map((e: any) => ({ type: "event_scheduled", date: e.start_at, label: `موعد: ${e.title}` })),
    ].sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime()).slice(0, 20);

    res.json({
      client,
      cases,
      invoices,
      contracts,
      events,
      messages,
      activities,
      stats: {
        casesCount:       cases.length,
        invoicesCount:    invoices.length,
        contractsCount:   contracts.length,
        paidTotal,
        outstandingTotal,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/clients/stats", async (req, res) => {
  try {
    if (!requireAuth(req, res)) return;
    const all = await db.select().from(clientsTable);
    res.json({
      total:       all.length,
      active:      all.filter(c => c.status === "active").length,
      potential:   all.filter(c => c.status === "potential").length,
      companies:   all.filter(c => c.type   === "company").length,
      individuals: all.filter(c => c.type   === "individual").length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
