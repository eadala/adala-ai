import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { autoPostJournalEntry, ensureJournalTables } from "./journalAccounting";
import {
  revenuesTable, expensesTable, bankAccountsTable, cashAdvancesTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

/* ── helpers ────────────────────────────────────────────── */
function num(v: any) { return parseFloat(String(v ?? "0")) || 0; }
function today() { return new Date().toISOString().split("T")[0]; }

/** Execute SQL and return the first row (handles both {rows:[...]} and direct array) */
async function sqlOne(query: any): Promise<Record<string, any>> {
  try {
    const result = await db.execute(query) as any;
    if (Array.isArray(result)) return result[0] ?? {};
    if (result?.rows && Array.isArray(result.rows)) return result.rows[0] ?? {};
    return {};
  } catch { return {}; }
}

/** Execute SQL and return all rows */
async function sqlAll(query: any): Promise<Record<string, any>[]> {
  try {
    const result = await db.execute(query) as any;
    if (Array.isArray(result)) return result;
    if (result?.rows && Array.isArray(result.rows)) return result.rows;
    return [];
  } catch { return []; }
}

/* ══════════════════════════════════════════════════════════
   REVENUES
══════════════════════════════════════════════════════════ */

router.get("/accounting/revenues", requireAuthWithTenant, async (_req, res) => {
  try {
    const rows = await db.select().from(revenuesTable).orderBy(desc(revenuesTable.date)).limit(500);
    res.json(rows);
  } catch { res.status(500).json({ error: "خطأ في جلب الإيرادات" }); }
});

router.post("/accounting/revenues", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { title, category, amount, paymentMethod, date, clientId, caseId, notes } = req.body;
    const [row] = await db.insert(revenuesTable).values({
      title, category, amount: String(amount), paymentMethod,
      date: date ?? today(), clientId, caseId, notes,
    }).returning();

    /* ── القيد التلقائي: مدين الصندوق/البنك ← دائن الإيرادات ── */
    const cashAccount  = paymentMethod === "bank" ? { code: "1120", name: "البنك الرئيسي" } : { code: "1110", name: "الصندوق" };
    const revAccount   = category === "أتعاب قضائية"     ? { code: "4100", name: "أتعاب قضائية" }
                       : category === "أتعاب استشارية"   ? { code: "4200", name: "أتعاب استشارية" }
                       : category === "أتعاب عقود"       ? { code: "4300", name: "أتعاب عقود وتوثيق" }
                       : { code: "4500", name: "إيرادات أخرى" };

    ensureJournalTables(tenantId).then(() =>
      autoPostJournalEntry({
        officeId:        tenantId,
        description:     `إيراد: ${title}`,
        referenceType:   "revenue",
        referenceId:     row.id,
        date:            date ?? today(),
        amount:          num(amount),
        debitCode:       cashAccount.code,
        debitName:       cashAccount.name,
        debitType:       "Asset",
        creditCode:      revAccount.code,
        creditName:      revAccount.name,
        creditType:      "Revenue",
      })
    ).catch(() => {});

    res.json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: "خطأ في إضافة الإيراد" }); }
});

router.put("/accounting/revenues/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { title, category, amount, paymentMethod, date, notes } = req.body;
    const [row] = await db.update(revenuesTable)
      .set({ title, category, amount: String(amount), paymentMethod, date, notes, updatedAt: new Date() })
      .where(eq(revenuesTable.id, req.params.id)).returning();
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تعديل الإيراد" }); }
});

router.delete("/accounting/revenues/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.delete(revenuesTable).where(eq(revenuesTable.id, req.params.id));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف الإيراد" }); }
});

/* ══════════════════════════════════════════════════════════
   EXPENSES
══════════════════════════════════════════════════════════ */

router.get("/accounting/expenses", requireAuthWithTenant, async (_req, res) => {
  try {
    const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.date)).limit(500);
    res.json(rows);
  } catch { res.status(500).json({ error: "خطأ في جلب المصاريف" }); }
});

router.post("/accounting/expenses", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { title, category, amount, paymentMethod, date, vendor, notes } = req.body;
    const [row] = await db.insert(expensesTable).values({
      title, category, amount: String(amount), paymentMethod,
      date: date ?? today(), vendor, notes,
    }).returning();

    /* ── القيد التلقائي: مدين المصروف ← دائن الصندوق/البنك ── */
    const cashAccount = paymentMethod === "bank" ? { code: "1120", name: "البنك الرئيسي" } : { code: "1110", name: "الصندوق" };
    const expAccount  = category === "رواتب"           ? { code: "5100", name: "رواتب ومكافآت" }
                      : category === "إيجار"           ? { code: "5200", name: "إيجار المكتب" }
                      : category === "اتصالات"         ? { code: "5300", name: "اتصالات وإنترنت" }
                      : category === "تسويق"           ? { code: "5500", name: "تسويق وإعلان" }
                      : category === "نقل"             ? { code: "5600", name: "نقل ومواصلات" }
                      : category === "رسوم حكومية"     ? { code: "5700", name: "رسوم حكومية وقضائية" }
                      : { code: "5900", name: "مصروفات متنوعة" };

    ensureJournalTables(tenantId).then(() =>
      autoPostJournalEntry({
        officeId:        tenantId,
        description:     `مصروف: ${title}`,
        referenceType:   "expense",
        referenceId:     row.id,
        date:            date ?? today(),
        amount:          num(amount),
        debitCode:       expAccount.code,
        debitName:       expAccount.name,
        debitType:       "Expense",
        creditCode:      cashAccount.code,
        creditName:      cashAccount.name,
        creditType:      "Asset",
      })
    ).catch(() => {});

    res.json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: "خطأ في إضافة المصروف" }); }
});

router.put("/accounting/expenses/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { title, category, amount, paymentMethod, date, vendor, notes } = req.body;
    const [row] = await db.update(expensesTable)
      .set({ title, category, amount: String(amount), paymentMethod, date, vendor, notes, updatedAt: new Date() })
      .where(eq(expensesTable.id, req.params.id)).returning();
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تعديل المصروف" }); }
});

router.delete("/accounting/expenses/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.delete(expensesTable).where(eq(expensesTable.id, req.params.id));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف المصروف" }); }
});

/* ══════════════════════════════════════════════════════════
   BANK ACCOUNTS
══════════════════════════════════════════════════════════ */

router.get("/accounting/bank-accounts", requireAuthWithTenant, async (_req, res) => {
  try {
    const rows = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.isActive, true)).orderBy(desc(bankAccountsTable.createdAt));
    res.json(rows);
  } catch { res.status(500).json({ error: "خطأ في جلب الحسابات" }); }
});

router.post("/accounting/bank-accounts", requireAuthWithTenant, async (req, res) => {
  try {
    const { bankName, accountName, accountNumber, iban, currency, currentBalance, isDefault, notes } = req.body;
    const [row] = await db.insert(bankAccountsTable).values({
      bankName, accountName, accountNumber, iban,
      currency: currency ?? "SAR",
      currentBalance: String(currentBalance ?? 0),
      isDefault: isDefault ?? false, notes,
    }).returning();
    res.json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: "خطأ في إضافة الحساب" }); }
});

router.put("/accounting/bank-accounts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const { bankName, accountName, accountNumber, iban, currentBalance, isDefault, notes } = req.body;
    const [row] = await db.update(bankAccountsTable)
      .set({ bankName, accountName, accountNumber, iban, currentBalance: String(currentBalance), isDefault, notes, updatedAt: new Date() })
      .where(eq(bankAccountsTable.id, req.params.id)).returning();
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تعديل الحساب" }); }
});

router.delete("/accounting/bank-accounts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.update(bankAccountsTable).set({ isActive: false }).where(eq(bankAccountsTable.id, req.params.id));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف الحساب" }); }
});

/* ══════════════════════════════════════════════════════════
   CASH ADVANCES
══════════════════════════════════════════════════════════ */

router.get("/accounting/advances", requireAuthWithTenant, async (_req, res) => {
  try {
    const rows = await db.select().from(cashAdvancesTable).orderBy(desc(cashAdvancesTable.date)).limit(200);
    res.json(rows);
  } catch { res.status(500).json({ error: "خطأ في جلب السلف" }); }
});

router.post("/accounting/advances", requireAuthWithTenant, async (req, res) => {
  try {
    const { employeeName, employeeId, amount, purpose, repaymentMonths, date, notes } = req.body;
    const [row] = await db.insert(cashAdvancesTable).values({
      employeeName, employeeId, amount: String(amount), purpose,
      repaymentMonths: repaymentMonths ?? 1, date: date ?? today(), notes,
    }).returning();
    res.json(row);
  } catch (e) { console.error(e); res.status(500).json({ error: "خطأ في إضافة السلفة" }); }
});

router.patch("/accounting/advances/:id/approve", requireAuthWithTenant, async (req, res) => {
  try {
    const [row] = await db.update(cashAdvancesTable)
      .set({ status: "approved", approvedBy: req.body.approvedBy ?? "المدير", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(cashAdvancesTable.id, req.params.id)).returning();
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في الموافقة" }); }
});

router.patch("/accounting/advances/:id/repay", requireAuthWithTenant, async (req, res) => {
  try {
    const [current] = await db.select().from(cashAdvancesTable).where(eq(cashAdvancesTable.id, req.params.id)).limit(1);
    if (!current) return res.status(404).json({ error: "السلفة غير موجودة" });
    const newRepaid = num(current.amountRepaid) + num(req.body.amount);
    const isDone = newRepaid >= num(current.amount);
    const [row] = await db.update(cashAdvancesTable)
      .set({ amountRepaid: String(newRepaid), status: isDone ? "repaid" : "active", updatedAt: new Date() })
      .where(eq(cashAdvancesTable.id, req.params.id)).returning();
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تسجيل السداد" }); }
});

router.delete("/accounting/advances/:id", requireAuthWithTenant, async (req, res) => {
  try {
    await db.delete(cashAdvancesTable).where(eq(cashAdvancesTable.id, req.params.id));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف السلفة" }); }
});

/* ══════════════════════════════════════════════════════════
   FINANCIAL REPORTS  (P&L)
══════════════════════════════════════════════════════════ */

router.get("/accounting/reports/summary", requireAuthWithTenant, async (_req, res) => {
  try {
    const year = new Date().getFullYear();

    /* ── Aggregate totals ── */
    const revRow  = await sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM revenues`);
    const invRow  = await sqlOne(sql`SELECT COALESCE(SUM(total),0) AS total FROM client_invoices WHERE status='paid'`);
    const expRow  = await sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`);
    const payRow  = await sqlOne(sql`SELECT COALESCE(SUM(net_salary),0) AS total FROM payroll WHERE status='paid'`);
    const advRow  = await sqlOne(sql`SELECT COALESCE(SUM(amount - COALESCE(amount_repaid,0)),0) AS total FROM cash_advances WHERE status NOT IN ('repaid','rejected')`);

    const directRevenue  = num(revRow.total);
    const invoiceRevenue = num(invRow.total);
    const directExpenses = num(expRow.total);
    const payrollExpenses = num(payRow.total);
    const outstandingAdvances = num(advRow.total);

    const grossRevenue  = directRevenue + invoiceRevenue;
    const grossExpenses = directExpenses + payrollExpenses;
    const netProfit     = grossRevenue - grossExpenses;
    const profitMargin  = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    /* ── Monthly breakdown ── */
    const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const monthly = await Promise.all(MONTHS.map(async (name, idx) => {
      const m = String(idx + 1).padStart(2, "0");
      const from = `${year}-${m}-01`;
      const to   = `${year}-${m}-01`;
      const [mr, ir, me, mp] = await Promise.all([
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM revenues WHERE date >= ${from}::date AND date < ${to}::date + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(total),0) AS v FROM client_invoices WHERE status='paid' AND created_at >= ${from}::timestamp AND created_at < ${to}::timestamp + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE date >= ${from}::date AND date < ${to}::date + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(net_salary),0) AS v FROM payroll WHERE status='paid' AND year=${year} AND month LIKE ${"%" + m + "%"}`),
      ]);
      const rev = num(mr.v) + num(ir.v);
      const exp = num(me.v) + num(mp.v);
      return { month: name, revenue: rev, expenses: exp, profit: rev - exp };
    }));

    /* ── Category breakdowns ── */
    const expCatRows = await sqlAll(sql`SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses GROUP BY category ORDER BY total DESC LIMIT 8`);
    const revCatRows = await sqlAll(sql`SELECT category, COALESCE(SUM(amount),0) AS total FROM revenues GROUP BY category ORDER BY total DESC LIMIT 8`);

    res.json({
      totalRevenue: grossRevenue,
      totalExpenses: grossExpenses,
      netProfit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      outstandingAdvances,
      revenueBreakdown: { direct: directRevenue, invoices: invoiceRevenue },
      expenseBreakdown: { direct: directExpenses, payroll: payrollExpenses },
      monthly,
      expenseCategories: expCatRows.map(r => ({ name: r.category, value: num(r.total) })),
      revenueCategories: revCatRows.map(r => ({ name: r.category, value: num(r.total) })),
    });
  } catch (err) {
    console.error("Finance summary error:", err);
    res.status(500).json({ error: "خطأ في التقارير المالية" });
  }
});

/* ── Cashflow: last 12 months ───────────────────────────── */
router.get("/accounting/cashflow", requireAuthWithTenant, async (_req, res) => {
  try {
    const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    let runningBalance = 0;
    const now = new Date();

    const cashflow = await Promise.all(
      Array.from({ length: 12 }, (_, i) => 12 - 1 - i).map(async (i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const from = `${y}-${m}-01`;
        const [rr, ir, er] = await Promise.all([
          sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM revenues WHERE date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
          sqlOne(sql`SELECT COALESCE(SUM(total),0) AS v FROM client_invoices WHERE status='paid' AND created_at >= ${from}::timestamp AND created_at < ${from}::timestamp + interval '1 month'`),
          sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
        ]);
        const inflow  = num(rr.v) + num(ir.v);
        const outflow = num(er.v);
        runningBalance += inflow - outflow;
        return { month: `${MONTHS_AR[d.getMonth()]} ${y}`, inflow, outflow, balance: runningBalance };
      })
    );

    /* Promise.all doesn't preserve running balance order — compute serially */
    let bal = 0;
    const sorted = cashflow.map(m => ({ ...m, balance: (bal += m.inflow - m.outflow) }));
    res.json(sorted);
  } catch (err) {
    console.error("Cashflow error:", err);
    res.status(500).json({ error: "خطأ في التدفق النقدي" });
  }
});

export default router;
