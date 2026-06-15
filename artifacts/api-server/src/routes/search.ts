import { requireAuth } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function sqlRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

/* ── GET /api/search/global?q=&limit= ────────────── */
router.get("/search/global", requireAuth, async (req, res) => {
  const officeId = (req as any).officeId as string;
  if (!officeId) { res.json({ results: [] }); return; }

  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(parseInt(String(req.query.limit ?? "5")), 10);

  if (!q || q.length < 2) { res.json({ results: [] }); return; }

  const pattern = `%${q}%`;

  try {
    const [caseRes, clientRes, invoiceRes] = await Promise.allSettled([
      db.execute(sql`
        SELECT id, title, case_number, status
        FROM cases
        WHERE office_id = ${officeId}
          AND (title ILIKE ${pattern} OR COALESCE(case_number, '') ILIKE ${pattern})
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `),
      db.execute(sql`
        SELECT id, full_name, phone, email
        FROM clients
        WHERE office_id = ${officeId}
          AND (full_name ILIKE ${pattern}
            OR COALESCE(phone, '') ILIKE ${pattern}
            OR COALESCE(email, '') ILIKE ${pattern})
        ORDER BY created_at DESC
        LIMIT ${limit}
      `),
      db.execute(sql`
        SELECT id, invoice_number, amount, status
        FROM client_invoices
        WHERE office_id = ${officeId}
          AND COALESCE(invoice_number, '') ILIKE ${pattern}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `),
    ]);

    const results: any[] = [];

    if (caseRes.status === "fulfilled") {
      for (const r of sqlRows(caseRes.value) as any[]) {
        results.push({
          id: r.id,
          type: "case",
          title: r.title,
          subtitle: r.case_number ? `رقم: ${r.case_number}` : undefined,
          href: `/case-detail/${r.id}`,
        });
      }
    }

    if (clientRes.status === "fulfilled") {
      for (const r of sqlRows(clientRes.value) as any[]) {
        results.push({
          id: r.id,
          type: "client",
          title: r.full_name,
          subtitle: r.phone ?? r.email ?? undefined,
          href: `/client-detail/${r.id}`,
        });
      }
    }

    if (invoiceRes.status === "fulfilled") {
      for (const r of sqlRows(invoiceRes.value) as any[]) {
        results.push({
          id: r.id,
          type: "invoice",
          title: r.invoice_number ?? `فاتورة #${r.id}`,
          subtitle: r.amount ? `${(Number(r.amount) / 100).toLocaleString("ar-SA")} ر.س · ${r.status}` : undefined,
          href: `/invoices`,
        });
      }
    }

    res.json({ results: results.slice(0, limit * 2) });
  } catch (err: any) {
    res.status(500).json({ error: err.message, results: [] });
  }
});

export default router;
