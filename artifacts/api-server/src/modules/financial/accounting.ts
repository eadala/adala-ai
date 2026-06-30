/**
 * Accounting Module — عدالة AI
 * ─────────────────────────────────────────────────────────────────────────
 * ✅ FIXED: All queries now enforce office_id (tenant isolation)
 * ✅ FIXED: INSERT operations include office_id
 * ✅ FIXED: UPDATE/DELETE scoped to office_id
 * ✅ Uses raw SQL for explicit isolation (safer than ORM without schema check)
 */
import { requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { autoPostJournalEntry, ensureJournalTables } from "./journalAccounting";
import { sql } from "drizzle-orm";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();

/* ── One-time migration: add deleted_at for soft-delete on revenues & expenses ── */
db.execute(sql`ALTER TABLE revenues ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`).catch(() => {});
db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`).catch(() => {});

/* ── helpers ────────────────────────────────────────────── */
function num(v: any) { return parseFloat(String(v ?? "0")) || 0; }
function today() { return new Date().toISOString().split("T")[0]; }

function rows(r: any): any[]  { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any     { return rows(r)[0] ?? {}; }

async function sqlExec(query: any): Promise<any[]> {
  try { return rows(await db.execute(query)); } catch { return []; }
}
async function sqlOne(query: any): Promise<any> {
  return (await sqlExec(query))[0] ?? {};
}

/* ══════════════════════════════════════════════════════════
   REVENUES  — إيرادات المكتب (مُعزولة بـ office_id)
══════════════════════════════════════════════════════════ */

router.get("/accounting/revenues", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const data = await sqlExec(sql`
      SELECT * FROM revenues
      WHERE office_id = ${tenantId} AND deleted_at IS NULL
      ORDER BY date DESC, created_at DESC
      LIMIT 500
    `);
    res.json(data);
  } catch { res.status(500).json({ error: "خطأ في جلب الإيرادات" }); }
});

router.post("/accounting/revenues", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const { title, category, amount, paymentMethod, date, clientId, caseId, notes } = req.body;
    const row = one(await db.execute(sql`
      INSERT INTO revenues (office_id, title, category, amount, payment_method, date, client_id, case_id, notes)
      VALUES (${tenantId}, ${title}, ${category ?? "أخرى"}, ${num(amount)},
              ${paymentMethod ?? "cash"}, ${date ?? today()},
              ${clientId ?? null}, ${caseId ?? null}, ${notes ?? null})
      RETURNING *
    `));

    /* ── القيد التلقائي ── */
    const cashAcc = paymentMethod === "bank"
      ? { code: "1120", name: "البنك الرئيسي" }
      : { code: "1110", name: "الصندوق" };
    const revAcc  = category === "أتعاب قضائية"   ? { code: "4100", name: "أتعاب قضائية" }
                  : category === "أتعاب استشارية" ? { code: "4200", name: "أتعاب استشارية" }
                  : category === "أتعاب عقود"     ? { code: "4300", name: "أتعاب عقود وتوثيق" }
                  : { code: "4500", name: "إيرادات أخرى" };

    ensureJournalTables(tenantId).then(() =>
      autoPostJournalEntry({
        officeId: tenantId, description: `إيراد: ${title}`,
        referenceType: "revenue", referenceId: row.id, date: date ?? today(),
        amount: num(amount),
        debitCode: cashAcc.code, debitName: cashAcc.name, debitType: "Asset",
        creditCode: revAcc.code, creditName: revAcc.name, creditType: "Revenue",
      })
    ).catch(() => {});

    /* ── ERP: مدين الصندوق ← دائن الإيرادات ── */
    import("./financial-event-engine").then(({ recordFinancialEvent }) =>
      recordFinancialEvent({
        officeId: tenantId, type: "PAYMENT_RECEIVED",
        amount: num(amount), referenceId: row.id,
        description: `إيراد: ${title}`, category,
        paymentMethod: paymentMethod as any,
        entryDate: date ?? today(),
      })
    ).catch(() => {});

    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message ?? "خطأ في إضافة الإيراد" }); }
});

router.put("/accounting/revenues/:id", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const { title, category, amount, paymentMethod, date, notes } = req.body;
    const row = one(await db.execute(sql`
      UPDATE revenues SET
        title = ${title}, category = ${category}, amount = ${num(amount)},
        payment_method = ${paymentMethod}, date = ${date}, notes = ${notes},
        updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
      RETURNING *
    `));
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تعديل الإيراد" }); }
});

router.delete("/accounting/revenues/:id", requireAuthWithTenant, requirePermission("accounting:delete"), async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const updated = (await sqlExec(sql`
      UPDATE revenues
      SET deleted_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId} AND deleted_at IS NULL
      RETURNING id, title, amount
    `))[0];
    if (!updated) return res.status(404).json({ error: "السجل غير موجود أو محذوف مسبقاً" });
    auditLog({ ...auditMeta(req), action: "soft_delete", resource: "revenue", resourceId: String(req.params.id), details: `${updated.title} — ${updated.amount}` }).catch(() => {});
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف الإيراد" }); }
});

/* ══════════════════════════════════════════════════════════
   EXPENSES  — مصروفات المكتب (مُعزولة بـ office_id)
══════════════════════════════════════════════════════════ */

router.get("/accounting/expenses", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const data = await sqlExec(sql`
      SELECT * FROM expenses
      WHERE office_id = ${tenantId} AND deleted_at IS NULL
      ORDER BY date DESC, created_at DESC
      LIMIT 500
    `);
    res.json(data);
  } catch { res.status(500).json({ error: "خطأ في جلب المصروفات" }); }
});

router.post("/accounting/expenses", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const { title, category, amount, paymentMethod, date, vendor, notes } = req.body;
    const row = one(await db.execute(sql`
      INSERT INTO expenses (office_id, title, category, amount, payment_method, date, vendor, notes)
      VALUES (${tenantId}, ${title}, ${category ?? "أخرى"}, ${num(amount)},
              ${paymentMethod ?? "cash"}, ${date ?? today()},
              ${vendor ?? null}, ${notes ?? null})
      RETURNING *
    `));

    /* ── القيد التلقائي: مدين المصروفات ← دائن الصندوق/البنك ── */
    const cashAcc = paymentMethod === "bank"
      ? { code: "1120", name: "البنك الرئيسي" }
      : { code: "1110", name: "الصندوق" };
    const expAcc  = category === "رواتب"     ? { code: "6100", name: "مصروفات الرواتب" }
                  : category === "إيجار"     ? { code: "6200", name: "مصروفات الإيجار" }
                  : category === "اتصالات"   ? { code: "6300", name: "مصروفات الاتصالات" }
                  : { code: "6500", name: "مصروفات إدارية أخرى" };

    ensureJournalTables(tenantId).then(() =>
      autoPostJournalEntry({
        officeId: tenantId, description: `مصروف: ${title}`,
        referenceType: "expense", referenceId: row.id, date: date ?? today(),
        amount: num(amount),
        debitCode: expAcc.code, debitName: expAcc.name, debitType: "Expense",
        creditCode: cashAcc.code, creditName: cashAcc.name, creditType: "Asset",
      })
    ).catch(() => {});

    /* ── ERP: مدين المصروفات ← دائن الصندوق ── */
    import("./financial-event-engine").then(({ recordFinancialEvent }) =>
      recordFinancialEvent({
        officeId: tenantId, type: "EXPENSE_RECORDED",
        amount: num(amount), referenceId: row.id,
        description: `مصروف: ${title}`, category,
        paymentMethod: paymentMethod as any,
        entryDate: date ?? today(),
      })
    ).catch(() => {});

    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message ?? "خطأ في إضافة المصروف" }); }
});

router.put("/accounting/expenses/:id", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const { title, category, amount, paymentMethod, date, notes } = req.body;
    const row = one(await db.execute(sql`
      UPDATE expenses SET
        title = ${title}, category = ${category}, amount = ${num(amount)},
        payment_method = ${paymentMethod}, date = ${date}, notes = ${notes},
        updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
      RETURNING *
    `));
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تعديل المصروف" }); }
});

router.delete("/accounting/expenses/:id", requireAuthWithTenant, requirePermission("accounting:delete"), async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const updated = (await sqlExec(sql`
      UPDATE expenses
      SET deleted_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId} AND deleted_at IS NULL
      RETURNING id, title, amount
    `))[0];
    if (!updated) return res.status(404).json({ error: "السجل غير موجود أو محذوف مسبقاً" });
    auditLog({ ...auditMeta(req), action: "soft_delete", resource: "expense", resourceId: String(req.params.id), details: `${updated.title} — ${updated.amount}` }).catch(() => {});
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف المصروف" }); }
});

/* ══════════════════════════════════════════════════════════
   BANK ACCOUNTS  (مُعزولة بـ office_id)
══════════════════════════════════════════════════════════ */

router.get("/accounting/bank-accounts", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const data = await sqlExec(sql`
      SELECT * FROM bank_accounts
      WHERE office_id = ${tenantId} AND is_active = true
      ORDER BY created_at DESC
    `);
    res.json(data);
  } catch { res.status(500).json({ error: "خطأ في جلب الحسابات" }); }
});

router.post("/accounting/bank-accounts", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const { bankName, accountName, accountNumber, iban, currency, currentBalance, isDefault, notes } = req.body;
    const row = one(await db.execute(sql`
      INSERT INTO bank_accounts (office_id, bank_name, account_name, account_number, iban, currency, current_balance, is_default, notes)
      VALUES (${tenantId}, ${bankName}, ${accountName}, ${accountNumber ?? null},
              ${iban ?? null}, ${currency ?? "SAR"}, ${num(currentBalance)},
              ${isDefault ?? false}, ${notes ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message ?? "خطأ في إضافة الحساب" }); }
});

router.put("/accounting/bank-accounts/:id", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const { bankName, accountName, accountNumber, iban, currentBalance, isDefault, notes } = req.body;
    const row = one(await db.execute(sql`
      UPDATE bank_accounts SET
        bank_name = ${bankName}, account_name = ${accountName},
        account_number = ${accountNumber}, iban = ${iban},
        current_balance = ${num(currentBalance)}, is_default = ${isDefault},
        notes = ${notes}, updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
      RETURNING *
    `));
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تعديل الحساب" }); }
});

router.delete("/accounting/bank-accounts/:id", requireAuthWithTenant, requirePermission("accounting:delete"), async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    await db.execute(sql`
      UPDATE bank_accounts SET is_active = false, updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف الحساب" }); }
});

/* ══════════════════════════════════════════════════════════
   CASH ADVANCES  (مُعزولة بـ office_id)
══════════════════════════════════════════════════════════ */

router.get("/accounting/advances", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const data = await sqlExec(sql`
      SELECT * FROM cash_advances
      WHERE office_id = ${tenantId}
      ORDER BY date DESC
      LIMIT 200
    `);
    res.json(data);
  } catch { res.status(500).json({ error: "خطأ في جلب السلف" }); }
});

router.post("/accounting/advances", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const { employeeName, employeeId, amount, purpose, repaymentMonths, date, notes } = req.body;
    const row = one(await db.execute(sql`
      INSERT INTO cash_advances (office_id, employee_name, employee_id, amount, purpose, repayment_months, date, notes)
      VALUES (${tenantId}, ${employeeName}, ${employeeId ?? null}, ${num(amount)},
              ${purpose ?? null}, ${repaymentMonths ?? 1}, ${date ?? today()}, ${notes ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message ?? "خطأ في إضافة السلفة" }); }
});

router.patch("/accounting/advances/:id/approve", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const row = one(await db.execute(sql`
      UPDATE cash_advances SET
        status = 'approved', approved_by = ${req.body.approvedBy ?? "المدير"},
        approved_at = NOW(), updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
      RETURNING *
    `));
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في الموافقة" }); }
});

router.patch("/accounting/advances/:id/repay", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const current = one(await db.execute(sql`
      SELECT * FROM cash_advances WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `));
    if (!current?.id) return res.status(404).json({ error: "السلفة غير موجودة" });
    const newRepaid = num(current.amount_repaid) + num(req.body.amount);
    const isDone = newRepaid >= num(current.amount);
    const row = one(await db.execute(sql`
      UPDATE cash_advances SET
        amount_repaid = ${newRepaid}, status = ${isDone ? "repaid" : "active"},
        updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
      RETURNING *
    `));
    res.json(row);
  } catch { res.status(500).json({ error: "خطأ في تسجيل السداد" }); }
});

router.delete("/accounting/advances/:id", requireAuthWithTenant, requirePermission("accounting:delete"), async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    await db.execute(sql`
      DELETE FROM cash_advances WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "خطأ في حذف السلفة" }); }
});

/* ══════════════════════════════════════════════════════════
   FINANCIAL REPORTS — P&L (كل الأرقام من office_id فقط)
══════════════════════════════════════════════════════════ */

router.get("/accounting/reports/summary", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const year = new Date().getFullYear();

    const [revRow, invRow, expRow, payRow, advRow] = await Promise.all([
      sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM revenues WHERE office_id = ${tenantId} AND deleted_at IS NULL`),
      sqlOne(sql`SELECT COALESCE(SUM(total),0) AS total FROM client_invoices WHERE office_id = ${tenantId} AND status='paid'`),
      sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE office_id = ${tenantId} AND deleted_at IS NULL`),
      sqlOne(sql`SELECT COALESCE(SUM(net_salary),0) AS total FROM payroll WHERE office_id = ${tenantId} AND status='paid'`),
      sqlOne(sql`SELECT COALESCE(SUM(amount - COALESCE(amount_repaid,0)),0) AS total FROM cash_advances WHERE office_id = ${tenantId} AND status NOT IN ('repaid','rejected')`),
    ]);

    const directRevenue    = num(revRow.total);
    const invoiceRevenue   = num(invRow.total);
    const directExpenses   = num(expRow.total);
    const payrollExpenses  = num(payRow.total);
    const outstandingAdv   = num(advRow.total);
    const grossRevenue     = directRevenue + invoiceRevenue;
    const grossExpenses    = directExpenses + payrollExpenses;
    const netProfit        = grossRevenue - grossExpenses;
    const profitMargin     = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const monthly = await Promise.all(MONTHS.map(async (name, idx) => {
      const m    = String(idx + 1).padStart(2, "0");
      const from = `${year}-${m}-01`;
      const [mr, ir, me, mp] = await Promise.all([
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM revenues WHERE office_id = ${tenantId} AND deleted_at IS NULL AND date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(total),0) AS v FROM client_invoices WHERE office_id = ${tenantId} AND status='paid' AND created_at >= ${from}::timestamp AND created_at < ${from}::timestamp + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE office_id = ${tenantId} AND deleted_at IS NULL AND date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(net_salary),0) AS v FROM payroll WHERE office_id = ${tenantId} AND status='paid' AND year=${year} AND month LIKE ${"%" + m + "%"}`),
      ]);
      const rev = num(mr.v) + num(ir.v);
      const exp = num(me.v) + num(mp.v);
      return { month: name, revenue: rev, expenses: exp, profit: rev - exp };
    }));

    const [expCatRows, revCatRows] = await Promise.all([
      sqlExec(sql`SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses WHERE office_id = ${tenantId} AND deleted_at IS NULL GROUP BY category ORDER BY total DESC LIMIT 8`),
      sqlExec(sql`SELECT category, COALESCE(SUM(amount),0) AS total FROM revenues WHERE office_id = ${tenantId} AND deleted_at IS NULL GROUP BY category ORDER BY total DESC LIMIT 8`),
    ]);

    res.json({
      totalRevenue: grossRevenue, totalExpenses: grossExpenses,
      netProfit, profitMargin: Math.round(profitMargin * 10) / 10,
      outstandingAdvances: outstandingAdv,
      revenueBreakdown: { direct: directRevenue, invoices: invoiceRevenue },
      expenseBreakdown: { direct: directExpenses, payroll: payrollExpenses },
      monthly,
      expenseCategories: expCatRows.map(r => ({ name: r.category, value: num(r.total) })),
      revenueCategories: revCatRows.map(r => ({ name: r.category, value: num(r.total) })),
    });
  } catch { res.status(500).json({ error: "خطأ في التقارير المالية" }); }
});

router.get("/accounting/cashflow", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const now = new Date();
    const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

    let bal = 0;
    const cashflow: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d    = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const [rr, ir, er] = await Promise.all([
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM revenues WHERE office_id = ${tenantId} AND deleted_at IS NULL AND date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(total),0) AS v FROM client_invoices WHERE office_id = ${tenantId} AND status='paid' AND created_at >= ${from}::timestamp AND created_at < ${from}::timestamp + interval '1 month'`),
        sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE office_id = ${tenantId} AND deleted_at IS NULL AND date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
      ]);
      const inflow  = num(rr.v) + num(ir.v);
      const outflow = num(er.v);
      bal += inflow - outflow;
      cashflow.push({ month: `${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`, inflow, outflow, balance: bal });
    }
    res.json(cashflow);
  } catch { res.status(500).json({ error: "خطأ في التدفق النقدي" }); }
});

export default router;
