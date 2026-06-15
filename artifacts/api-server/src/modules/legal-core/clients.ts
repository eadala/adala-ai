import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { eventBus } from "../../core/eventBus";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();

// ── GET /clients ──────────────────────────────────────────────────────────────
router.get("/clients", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const clients = await db.select().from(clientsTable)
      .where(eq((clientsTable as any).officeId, tenantId))
      .orderBy(desc(clientsTable.createdAt));
    res.json(clients);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /clients ─────────────────────────────────────────────────────────────
router.post("/clients", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
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
      officeId:   tenantId,
    } as any).returning();

    eventBus.emit({
      type: "CLIENT_ADDED",
      data: { fullName, email, phone, type, company, source },
    }).catch(() => {});

    auditLog({ ...auditMeta(req), action: "create", resource: "client", resourceId: String((client as any)?.id ?? ""), details: `اسم: ${fullName}` }).catch(() => {});
    res.json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /clients/:id ────────────────────────────────────────────────────────
router.patch("/clients/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
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
      .where(and(eq(clientsTable.id, String(req.params.id)), eq((clientsTable as any).officeId, tenantId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "الموكل غير موجود" });
    auditLog({ ...auditMeta(req), action: "update", resource: "client", resourceId: String(req.params.id) }).catch(() => {});
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /clients/:id ───────────────────────────────────────────────────────
router.delete("/clients/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    await db.delete(clientsTable)
      .where(and(eq(clientsTable.id, String(req.params.id)), eq((clientsTable as any).officeId, tenantId)));
    auditLog({ ...auditMeta(req), action: "delete", resource: "client", resourceId: String(req.params.id) }).catch(() => {});
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /clients/stats ────────────────────────────────────────────────────────
router.get("/clients/stats", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const all = await db.select().from(clientsTable)
      .where(eq((clientsTable as any).officeId, tenantId));
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

// ── GET /clients/:id ──────────────────────────────────────────────────────────
router.get("/clients/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, String(req.params.id)), eq((clientsTable as any).officeId, tenantId)));
    if (!client) return res.status(404).json({ error: "الموكل غير موجود" });
    res.json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /clients/:id/overview ─────────────────────────────────────────────────
router.get("/clients/:id/overview", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;

    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, id), eq((clientsTable as any).officeId, tenantId)));
    if (!client) return res.status(404).json({ error: "الموكل غير موجود" });

    async function safeRows(q: any): Promise<any[]> {
      try {
        const r = await db.execute(q) as any;
        return Array.isArray(r) ? r : (r?.rows ?? []);
      } catch { return []; }
    }

    const [cases, invoices, contracts, events, messages] = await Promise.all([
      safeRows(sql`SELECT * FROM cases WHERE client_id = ${id} AND office_id = ${tenantId} ORDER BY created_at DESC LIMIT 20`),
      safeRows(sql`SELECT * FROM client_invoices WHERE client_id = ${id} AND office_id = ${tenantId} ORDER BY created_at DESC LIMIT 20`),
      safeRows(sql`SELECT * FROM contracts WHERE client_id = ${id}::uuid AND office_id = ${tenantId} ORDER BY created_at DESC LIMIT 20`),
      safeRows(sql`SELECT * FROM events WHERE client_id = ${id} ORDER BY start_at DESC LIMIT 10`),
      safeRows(sql`SELECT * FROM office_messages WHERE client_id = ${id} ORDER BY created_at DESC LIMIT 10`),
    ]);

    const paidTotal = invoices
      .filter((i: any) => i.status === "paid")
      .reduce((s: number, i: any) => s + (parseInt(String(i.total ?? 0)) / 100), 0 as number);
    const outstandingTotal = invoices
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
      .reduce((s: number, i: any) => s + (parseInt(String(i.total ?? 0)) / 100), 0 as number);

    const activities = [
      { type: "client_created", date: client.createdAt, label: "تم إضافة الموكل" },
      ...cases.map((c: any) => ({ type: "case_created", date: c.created_at, label: `قضية: ${c.title}` })),
      ...invoices.map((i: any) => ({ type: "invoice_created", date: i.created_at, label: `فاتورة: ${i.invoice_number ?? i.id}` })),
      ...contracts.map((c: any) => ({ type: "contract_created", date: c.created_at, label: `عقد: ${c.title}` })),
      ...events.map((e: any) => ({ type: "event_scheduled", date: e.start_at, label: `موعد: ${e.title}` })),
    ].sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime()).slice(0, 20);

    res.json({
      client, cases, invoices, contracts, events, messages, activities,
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

// ── GET /clients/:id/accounting ───────────────────────────────────────────────
router.get("/clients/:id/accounting", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const { period = "annual", year = new Date().getFullYear(), month = "1" } = req.query as any;

    // Verify client belongs to this office
    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, id), eq((clientsTable as any).officeId, tenantId)));
    if (!client) return res.status(404).json({ error: "الموكل غير موجود" });

    async function safeRows(q: any): Promise<any[]> {
      try {
        const r = await db.execute(q) as any;
        return Array.isArray(r) ? r : (r?.rows ?? []);
      } catch { return []; }
    }

    const y = parseInt(year);
    const m = parseInt(month);
    let startDate: string, endDate: string, label: string;
    if (period === "monthly") {
      startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
      label = `${y}/${String(m).padStart(2, "0")}`;
    } else if (period === "quarterly") {
      const q2 = Math.ceil(m / 3);
      const sm = (q2 - 1) * 3 + 1;
      const em = q2 * 3;
      startDate = `${y}-${String(sm).padStart(2, "0")}-01`;
      endDate = `${y}-${String(em).padStart(2, "0")}-${new Date(y, em, 0).getDate()}`;
      label = `الربع ${q2} - ${y}`;
    } else if (period === "semi") {
      const isFirst = m <= 6;
      startDate = isFirst ? `${y}-01-01` : `${y}-07-01`;
      endDate = isFirst ? `${y}-06-30` : `${y}-12-31`;
      label = isFirst ? `النصف الأول ${y}` : `النصف الثاني ${y}`;
    } else {
      startDate = `${y}-01-01`;
      endDate = `${y}-12-31`;
      label = `سنة ${y}`;
    }

    const invoices = await safeRows(sql`
      SELECT * FROM client_invoices
      WHERE client_id = ${id} AND office_id = ${tenantId}
        AND created_at::date BETWEEN ${startDate}::date AND ${endDate}::date
    `);

    const expenses = await safeRows(sql`
      SELECT * FROM expenses
      WHERE client_id = ${id}
        AND date BETWEEN ${startDate}::date AND ${endDate}::date
    `).catch(() => []);

    const revenue = invoices
      .filter((i: any) => i.status === "paid")
      .reduce((s: number, i: any) => s + (parseInt(String(i.total ?? 0)) / 100), 0 as number);

    const receivables = invoices
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
      .reduce((s: number, i: any) => s + (parseInt(String(i.total ?? 0)) / 100), 0 as number);

    const totalExpenses = (expenses as any[]).reduce((s: number, e: any) => s + (parseFloat(String(e.amount ?? 0))), 0);
    const netProfit = revenue - totalExpenses;

    const monthlyRows = await safeRows(sql`
      SELECT
        EXTRACT(MONTH FROM created_at)::int AS month,
        SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END)::float / 100 AS revenue,
        SUM(CASE WHEN status != 'paid' AND status != 'cancelled' THEN total ELSE 0 END)::float / 100 AS receivables,
        COUNT(*)::int AS count
      FROM client_invoices
      WHERE client_id = ${id} AND office_id = ${tenantId}
        AND EXTRACT(YEAR FROM created_at) = ${y}
      GROUP BY month ORDER BY month
    `);

    const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const monthly = MONTHS_AR.map((name, i) => {
      const row = monthlyRows.find((r: any) => parseInt(r.month) === i + 1);
      return {
        name,
        revenue:     parseFloat(String(row?.revenue ?? 0)),
        receivables: parseFloat(String(row?.receivables ?? 0)),
      };
    });

    const byStatus = {
      paid:    invoices.filter((i: any) => i.status === "paid").length,
      overdue: invoices.filter((i: any) => i.status === "overdue").length,
      sent:    invoices.filter((i: any) => i.status === "sent").length,
      draft:   invoices.filter((i: any) => i.status === "draft").length,
    };

    res.json({
      period: { type: period, startDate, endDate, label, year: y },
      accounting: { revenue, receivables, expenses: totalExpenses, netProfit },
      financialStatements: {
        incomeStatement: { revenue, expenses: totalExpenses, netProfit, margin: revenue > 0 ? ((netProfit / revenue) * 100) : 0 },
        balanceSheet: { assets: { cash: revenue, receivables }, totalAssets: revenue + receivables, equity: revenue + receivables - totalExpenses },
        cashFlow: { cashIn: revenue, cashOut: totalExpenses, netCashFlow: revenue - totalExpenses },
      },
      monthly,
      byStatus,
      invoicesCount: invoices.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
