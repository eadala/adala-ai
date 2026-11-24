/**
 * ERP Ledger — Double-Entry Per-Office Ledger (Single Source of Truth)
 *
 * الجدول المرجعي للمحاسبة: office_erp_ledger
 * ─────────────────────────────────────────────────────────────
 * كل عملية مالية = قيد مدين + قيد دائن متوازن
 * office_id إلزامي — RLS مُفعَّل
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; schema authority */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { Router } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";

const router = Router();

function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }
function num(v: any)         { return parseFloat(String(v ?? "0")) || 0; }

/* Schema: office_erp_ledger + financial_anomalies owned by
   artifacts/api-server/migrations/013_erp_schema.sql */

/* ── Post a balanced double entry ─────────────────────────────────────────── */
export async function postDoubleEntry(params: {
  officeId: string;
  debit:  { code: string; name: string; type: string };
  credit: { code: string; name: string; type: string };
  amount: number;
  currency?: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  postedBy?: string;
  entryDate?: string;
}): Promise<{ debitId: string; creditId: string; pairId: string }> {
  if (!params.officeId || params.officeId === "platform") throw new Error("ERP_MISSING_TENANT");
  if (params.amount <= 0) throw new Error("ERP_INVALID_AMOUNT");

  const pairId  = crypto.randomUUID();
  const date    = params.entryDate ?? new Date().toISOString().split("T")[0];

  const [debitRow, creditRow] = await Promise.all([
    db.execute(sql`
      INSERT INTO office_erp_ledger
        (office_id, entry_date, entry_type, account_code, account_name, account_type,
         amount, currency, reference_type, reference_id, pair_id, description, posted_by)
      VALUES (${params.officeId}, ${date}::date, 'DEBIT',
              ${params.debit.code}, ${params.debit.name}, ${params.debit.type},
              ${params.amount}, ${params.currency ?? "SAR"},
              ${params.referenceType ?? null}, ${params.referenceId ?? null},
              ${pairId}::uuid, ${params.description ?? null}, ${params.postedBy ?? null})
      RETURNING id
    `),
    db.execute(sql`
      INSERT INTO office_erp_ledger
        (office_id, entry_date, entry_type, account_code, account_name, account_type,
         amount, currency, reference_type, reference_id, pair_id, description, posted_by)
      VALUES (${params.officeId}, ${date}::date, 'CREDIT',
              ${params.credit.code}, ${params.credit.name}, ${params.credit.type},
              ${params.amount}, ${params.currency ?? "SAR"},
              ${params.referenceType ?? null}, ${params.referenceId ?? null},
              ${pairId}::uuid, ${params.description ?? null}, ${params.postedBy ?? null})
      RETURNING id
    `),
  ]);

  return {
    pairId,
    debitId:  rows(debitRow)[0]?.id,
    creditId: rows(creditRow)[0]?.id,
  };
}

/* ── ERP Balance (per office) ─────────────────────────────────────────────── */
export async function getERPBalance(officeId: string): Promise<{
  totalCredits: number; totalDebits: number; netBalance: number; isBalanced: boolean;
}> {
  const r = one(await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE entry_type='CREDIT'), 0) AS credits,
      COALESCE(SUM(amount) FILTER (WHERE entry_type='DEBIT'),  0) AS debits
    FROM office_erp_ledger WHERE office_id = ${officeId}
  `)) ?? {};
  const credits = num(r.credits);
  const debits  = num(r.debits);
  return { totalCredits: credits, totalDebits: debits, netBalance: credits - debits, isBalanced: Math.abs(credits - debits) < 0.01 };
}

/* ── Routes ───────────────────────────────────────────────────────────────── */

// GET /api/erp/ledger — paginated ledger for this office
router.get("/erp/ledger", requireAuthWithTenant, async (req, res) => {
  const tid   = (req as any).tenantId as string;
  const limit = Math.min(parseInt(String(req.query.limit ?? 50)) || 50, 200);
  const page  = Math.max(0, parseInt(String(req.query.page ?? 0)) || 0);
  try {
    const [data, total] = await Promise.all([
      db.execute(sql`
        SELECT * FROM office_erp_ledger
        WHERE office_id = ${tid}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${limit} OFFSET ${page * limit}
      `),
      db.execute(sql`SELECT COUNT(*)::int AS c FROM office_erp_ledger WHERE office_id = ${tid}`),
    ]);
    res.json({ entries: rows(data), total: one(total)?.c ?? 0, page, limit });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/erp/balance — ERP balance check
router.get("/erp/balance", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    res.json(await getERPBalance(tid));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/erp/income-statement — ERP P&L from ledger
router.get("/erp/income-statement", requireAuthWithTenant, async (req, res) => {
  const tid  = (req as any).tenantId as string;
  const year = parseInt(String(req.query.year ?? new Date().getFullYear())) || new Date().getFullYear();
  try {
    const r = one(await db.execute(sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE account_type='Revenue' AND entry_type='CREDIT'), 0) AS total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE account_type='Expense' AND entry_type='DEBIT'),  0) AS total_expenses
      FROM office_erp_ledger
      WHERE office_id = ${tid}
        AND EXTRACT(YEAR FROM entry_date) = ${year}
    `)) ?? {};
    const revenue  = num(r.total_revenue);
    const expenses = num(r.total_expenses);
    res.json({ year, revenue, expenses, netProfit: revenue - expenses, margin: revenue > 0 ? ((revenue - expenses) / revenue * 100).toFixed(1) : "0" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/erp/manual-entry — manual double entry
router.post("/erp/manual-entry", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { debit, credit, amount, description, referenceType, referenceId, entryDate } = req.body ?? {};
  if (!debit || !credit || !amount) { res.status(400).json({ error: "debit/credit/amount مطلوبة" }); return; }
  try {
    const result = await postDoubleEntry({
      officeId: tid, debit, credit, amount: num(amount),
      description, referenceType, referenceId, entryDate,
      postedBy: (req as any).userId,
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/erp/anomalies — financial anomalies for this office
router.get("/erp/anomalies", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const data = rows(await db.execute(sql`
      SELECT * FROM financial_anomalies WHERE office_id = ${tid}
        AND resolved = false ORDER BY created_at DESC LIMIT 50
    `));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
