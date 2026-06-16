/**
 * Reconciliation Engine — محرك التسوية المالية
 *
 * يُطابق:
 *   client_invoices ↔ office_erp_ledger (INVOICE_CREATED)
 *   revenues        ↔ office_erp_ledger (CREDIT)
 *   expenses        ↔ office_erp_ledger (DEBIT)
 *
 * ويكشف:
 *   - فواتير بدون قيد محاسبي
 *   - مدفوعات بدون مقابل في الأستاذ
 *   - عدم توازن (Credits ≠ Debits)
 *   - تكرار في المدفوعات
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { Router } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { getERPBalance, ensureERPTables } from "./erp-ledger";

const router = Router();
function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }
function num(v: any)         { return parseFloat(String(v ?? "0")) || 0; }

export interface ReconciliationReport {
  officeId:            string;
  generatedAt:         Date;
  ledgerBalance:       { credits: number; debits: number; net: number; isBalanced: boolean };
  unmatchedInvoices:   { id: string; amount: number; client: string; date: string }[];
  unmatchedExpenses:   { id: string; amount: number; title: string; date: string }[];
  duplicatePayments:   { invoiceId: string; count: number; totalAmount: number }[];
  anomalies:           string[];
  score:               number; // 0-100 — 100 = perfectly reconciled
}

export async function reconcile(officeId: string): Promise<ReconciliationReport> {
  await ensureERPTables();
  const now = new Date();

  const [balance, unmatchedInv, unmatchedExp, dupPayments, erpLedgerCount] = await Promise.all([
    getERPBalance(officeId),

    // Invoices with no matching CREDIT ledger entry
    db.execute(sql`
      SELECT ci.id, ci.total AS amount, ci.client_name AS client,
             ci.created_at::date::text AS date
      FROM client_invoices ci
      WHERE ci.office_id = ${officeId} AND ci.status = 'paid'
        AND NOT EXISTS (
          SELECT 1 FROM office_erp_ledger el
          WHERE el.office_id = ${officeId}
            AND el.reference_id = ci.id::text
            AND el.entry_type = 'CREDIT'
        )
      ORDER BY ci.created_at DESC LIMIT 20
    `),

    // Expense records with no matching DEBIT entry
    db.execute(sql`
      SELECT e.id, e.amount, e.title, e.date::text
      FROM expenses e
      WHERE e.office_id = ${officeId}
        AND NOT EXISTS (
          SELECT 1 FROM office_erp_ledger el
          WHERE el.office_id = ${officeId}
            AND el.reference_id = e.id::text
            AND el.entry_type = 'DEBIT'
        )
      ORDER BY e.date DESC LIMIT 20
    `),

    // Duplicate payments (same invoice paid multiple times)
    db.execute(sql`
      SELECT reference_id AS invoice_id,
             COUNT(*)::int AS count,
             SUM(amount) AS total_amount
      FROM office_erp_ledger
      WHERE office_id = ${officeId}
        AND reference_type IN ('payment','invoice')
        AND entry_type = 'DEBIT'
      GROUP BY reference_id
      HAVING COUNT(*) > 1
      LIMIT 10
    `),

    // Check if ERP ledger has any entries at all
    db.execute(sql`SELECT COUNT(*)::int AS c FROM office_erp_ledger WHERE office_id = ${officeId}`),
  ]);

  const invRows  = rows(unmatchedInv);
  const expRows  = rows(unmatchedExp);
  const dupRows  = rows(dupPayments);
  const hasLedger = num(one(erpLedgerCount)?.c) > 0;

  const anomalies: string[] = [];
  if (!balance.isBalanced) anomalies.push(`عدم توازن: الدائن=${balance.totalCredits.toFixed(2)} الدفتر=${balance.totalDebits.toFixed(2)} الفرق=${Math.abs(balance.netBalance).toFixed(2)} ر.س`);
  if (invRows.length > 0)  anomalies.push(`${invRows.length} فاتورة مدفوعة بدون قيد محاسبي`);
  if (expRows.length > 0)  anomalies.push(`${expRows.length} مصروف بدون قيد مدين`);
  if (dupRows.length > 0)  anomalies.push(`${dupRows.length} حالة دفع متكرر لنفس الفاتورة`);
  if (!hasLedger)          anomalies.push("لا توجد قيود في الأستاذ العام — يُنصح بتفعيل محرك الأحداث");

  // Score: 100 - deductions per issue
  let score = 100;
  if (!balance.isBalanced) score -= 30;
  if (invRows.length > 0)  score -= Math.min(invRows.length * 3, 20);
  if (expRows.length > 0)  score -= Math.min(expRows.length * 2, 15);
  if (dupRows.length > 0)  score -= dupRows.length * 5;
  if (!hasLedger)          score -= 20;
  score = Math.max(score, 0);

  // Log anomalies to DB
  for (const a of anomalies) {
    await db.execute(sql`
      INSERT INTO financial_anomalies (office_id, anomaly_type, severity, description)
      VALUES (${officeId}, 'RECONCILIATION', ${score < 50 ? "high" : "medium"}, ${a})
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }

  return {
    officeId, generatedAt: now,
    ledgerBalance: { credits: balance.totalCredits, debits: balance.totalDebits, net: balance.netBalance, isBalanced: balance.isBalanced },
    unmatchedInvoices: invRows.map((r: any) => ({ id: r.id, amount: num(r.amount), client: r.client ?? "", date: r.date ?? "" })),
    unmatchedExpenses: expRows.map((r: any) => ({ id: r.id, amount: num(r.amount), title: r.title ?? "", date: r.date ?? "" })),
    duplicatePayments: dupRows.map((r: any) => ({ invoiceId: r.invoice_id, count: r.count, totalAmount: num(r.total_amount) })),
    anomalies, score,
  };
}

/* ── Routes ──────────────────────────────────────────────────────────────── */

// GET /api/erp/reconcile — run reconciliation for this office
router.get("/erp/reconcile", requireAuthWithTenant, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const report = await reconcile(tid);
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
