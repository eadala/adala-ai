/**
 * AI Financial Guard — حارس البيانات المالية للـ AI
 *
 * يمنع AI من:
 *   - الوصول لبيانات مالية خارج المكتب (Cross-Tenant)
 *   - القراءة الخام (raw SQL)
 *   - الحصول على بيانات حساسة (IBAN، أرقام حسابات)
 *
 * يوفر:
 *   - واجهة آمنة للـ AI للحصول على ملخص مالي
 *   - مسح البيانات الحساسة قبل إرسالها للـ AI
 *   - تسجيل كل وصول AI للبيانات المالية
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { Router } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { aiTenantGuard } from "../ai/command-center/middleware/ai-tenant-guard";

const router = Router();
function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }
function num(v: any)         { return parseFloat(String(v ?? "0")) || 0; }

/* ── Scrub sensitive fields before AI consumption ─────────────────────────── */
function scrubFinancialData(data: any[], tenantId: string): any[] {
  return data.map(entry => {
    if (entry.office_id && entry.office_id !== tenantId) {
      throw new Error(`AI_FINANCIAL_GUARD: CROSS_TENANT_BLOCKED — entry belongs to ${entry.office_id}`);
    }
    const safe: any = { ...entry };
    // Remove sensitive fields
    delete safe.iban;
    delete safe.account_number;
    delete safe.bank_reference;
    delete safe.stripe_fee;
    delete safe.net_amount;
    safe.office_id = "[TENANT_SCOPED]"; // mask for AI
    return { ...safe, safe: true };
  });
}

/* ── AI Financial Summary (safe, tenant-scoped) ─────────────────────────── */
export async function getAIFinancialSummary(officeId: string): Promise<{
  monthRevenue: number;
  monthExpenses: number;
  netProfit: number;
  unpaidInvoices: number;
  unpaidAmount: number;
  ledgerBalanced: boolean;
  topExpenseCategories: { name: string; amount: number }[];
  topRevenueCategories: { name: string; amount: number }[];
}> {
  if (!officeId || officeId === "platform") throw new Error("AI_GUARD_MISSING_TENANT");

  const [rev, exp, invoices, ledger, expCat, revCat] = await Promise.all([
    one(db.execute(sql`
      SELECT COALESCE(SUM(amount),0) AS v FROM revenues
      WHERE office_id = ${officeId} AND date >= DATE_TRUNC('month', CURRENT_DATE)
    `)),
    one(db.execute(sql`
      SELECT COALESCE(SUM(amount),0) AS v FROM expenses
      WHERE office_id = ${officeId} AND date >= DATE_TRUNC('month', CURRENT_DATE)
    `)),
    one(db.execute(sql`
      SELECT COUNT(*)::int AS cnt, COALESCE(SUM(total),0) AS amt
      FROM client_invoices WHERE office_id = ${officeId} AND status = 'unpaid'
    `)),
    one(db.execute(sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_type='CREDIT'), 0) AS credits,
        COALESCE(SUM(amount) FILTER (WHERE entry_type='DEBIT'),  0) AS debits
      FROM office_erp_ledger WHERE office_id = ${officeId}
    `).catch(() => null)),
    rows(db.execute(sql`
      SELECT category, COALESCE(SUM(amount),0) AS total
      FROM expenses WHERE office_id = ${officeId} GROUP BY category ORDER BY total DESC LIMIT 5
    `)),
    rows(db.execute(sql`
      SELECT category, COALESCE(SUM(amount),0) AS total
      FROM revenues WHERE office_id = ${officeId} GROUP BY category ORDER BY total DESC LIMIT 5
    `)),
  ]);

  const credits = num(ledger?.credits);
  const debits  = num(ledger?.debits);

  return {
    monthRevenue:   num(rev?.v),
    monthExpenses:  num(exp?.v),
    netProfit:      num(rev?.v) - num(exp?.v),
    unpaidInvoices: num(invoices?.cnt),
    unpaidAmount:   num(invoices?.amt),
    ledgerBalanced: Math.abs(credits - debits) < 0.01,
    topExpenseCategories: expCat.map((r: any) => ({ name: r.category, amount: num(r.total) })),
    topRevenueCategories: revCat.map((r: any) => ({ name: r.category, amount: num(r.total) })),
  };
}

/* ── Routes ──────────────────────────────────────────────────────────────── */

// GET /api/erp/ai-summary — safe financial summary for AI consumption
router.get("/erp/ai-summary", requireAuthWithTenant, aiTenantGuard, async (req, res) => {
  const tid = (req as any).tenantId as string;
  try {
    const summary = await getAIFinancialSummary(tid);
    res.json(summary);
  } catch (e: any) {
    if (e.message?.startsWith("AI_FINANCIAL_GUARD")) {
      res.status(403).json({ error: e.message });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// POST /api/erp/ai-guard/validate — validate financial data for AI
router.post("/erp/ai-guard/validate", requireAuthWithTenant, aiTenantGuard, async (req, res) => {
  const tid = (req as any).tenantId as string;
  const { data } = req.body ?? {};
  if (!Array.isArray(data)) { res.status(400).json({ error: "data must be array" }); return; }
  try {
    const safe = scrubFinancialData(data, tid);
    res.json({ validated: true, count: safe.length, data: safe });
  } catch (e: any) {
    if (e.message?.includes("CROSS_TENANT_BLOCKED")) {
      await db.execute(sql`
        INSERT INTO financial_anomalies (office_id, anomaly_type, severity, description)
        VALUES (${tid}, 'CROSS_TENANT', 'critical', ${e.message})
      `).catch(() => {});
      res.status(403).json({ error: "CROSS_TENANT_FINANCIAL_BLOCKED" });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

export default router;
