/**
 * عدالة AI — نظام القيد المزدوج (Double-Entry Accounting)
 *
 * جداول:
 *   chart_of_accounts  — دليل الحسابات (مُهيَّأ مسبقاً لمكاتب المحاماة)
 *   journal_entries    — رأس القيد اليومي
 *   journal_items      — تفاصيل القيد (مدين / دائن)
 *
 * مسارات القوائم المالية:
 *   GET /accounting/journal/accounts          — دليل الحسابات
 *   GET /accounting/journal/entries           — القيود اليومية
 *   POST /accounting/journal/entries          — قيد يدوي
 *   GET /accounting/statements/income         — قائمة الدخل
 *   GET /accounting/statements/balance-sheet  — الميزانية العمومية
 *   GET /accounting/statements/trial-balance  — ميزان المراجعة
 */

import { Router }                        from "express";
import { requireAuthWithTenant }         from "../middlewares/requireAuth";
import { db }                            from "@workspace/db";
import { sql }                           from "drizzle-orm";

const router = Router();

/* ── helpers ─────────────────────────────────────────────── */
function num(v: any) { return parseFloat(String(v ?? "0")) || 0; }

async function rows(q: any): Promise<any[]> {
  const r = await db.execute(q);
  return (r as any)?.rows ?? (Array.isArray(r) ? r : []);
}
async function one(q: any): Promise<any> {
  const rr = await rows(q);
  return rr[0] ?? {};
}

/* ══════════════════════════════════════════════════════════
   ENSURE TABLES + SEED
══════════════════════════════════════════════════════════ */

export async function ensureJournalTables(officeId: string): Promise<void> {

  /* 1. دليل الحسابات */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chart_of_accounts (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id     TEXT NOT NULL,
      account_code  TEXT NOT NULL,
      account_name  TEXT NOT NULL,
      account_type  TEXT NOT NULL CHECK (account_type IN ('Asset','Liability','Equity','Revenue','Expense')),
      parent_code   TEXT,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(office_id, account_code)
    )
  `).catch(() => {});

  /* 2. رأس القيد */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id        TEXT NOT NULL,
      entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      description      TEXT NOT NULL,
      reference_number TEXT,
      reference_type   TEXT,
      reference_id     TEXT,
      posted_by        TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_je_office ON journal_entries(office_id)`).catch(() => {});

  /* 3. تفاصيل القيد */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS journal_items (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entry_id     UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      office_id    TEXT NOT NULL,
      account_code TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      debit        NUMERIC(15,2) NOT NULL DEFAULT 0,
      credit       NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes        TEXT
    )
  `).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ji_entry ON journal_items(entry_id)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ji_office ON journal_items(office_id)`).catch(() => {});

  /* ── Seed Chart of Accounts (only if empty for this office) ── */
  const existing = await one(sql`
    SELECT COUNT(*) AS cnt FROM chart_of_accounts WHERE office_id = ${officeId}
  `);
  if (num(existing.cnt) > 0) return;

  const accounts = [
    /* ── الأصول ── */
    { code: "1000", name: "الأصول المتداولة",          type: "Asset",     parent: null },
    { code: "1100", name: "النقدية والأرصدة",          type: "Asset",     parent: "1000" },
    { code: "1110", name: "الصندوق",                   type: "Asset",     parent: "1100" },
    { code: "1120", name: "البنك الرئيسي",             type: "Asset",     parent: "1100" },
    { code: "1200", name: "الذمم المدينة (العملاء)",   type: "Asset",     parent: "1000" },
    { code: "1210", name: "أتعاب مستحقة",              type: "Asset",     parent: "1200" },
    { code: "1300", name: "أصول أخرى متداولة",         type: "Asset",     parent: "1000" },
    { code: "1310", name: "سلف الموظفين",              type: "Asset",     parent: "1300" },
    { code: "1320", name: "مصروفات مدفوعة مقدماً",    type: "Asset",     parent: "1300" },
    /* ── الخصوم ── */
    { code: "2000", name: "الالتزامات المتداولة",      type: "Liability", parent: null },
    { code: "2100", name: "الدائنون",                  type: "Liability", parent: "2000" },
    { code: "2200", name: "رواتب مستحقة الدفع",        type: "Liability", parent: "2000" },
    { code: "2300", name: "ضريبة القيمة المضافة",      type: "Liability", parent: "2000" },
    { code: "2400", name: "أمانات العملاء",            type: "Liability", parent: "2000" },
    /* ── حقوق الملكية ── */
    { code: "3000", name: "حقوق الملكية",              type: "Equity",    parent: null },
    { code: "3100", name: "رأس المال",                 type: "Equity",    parent: "3000" },
    { code: "3200", name: "الأرباح المحتجزة",          type: "Equity",    parent: "3000" },
    { code: "3300", name: "صافي الربح / الخسارة",     type: "Equity",    parent: "3000" },
    /* ── الإيرادات ── */
    { code: "4000", name: "الإيرادات",                 type: "Revenue",   parent: null },
    { code: "4100", name: "أتعاب قضائية",              type: "Revenue",   parent: "4000" },
    { code: "4200", name: "أتعاب استشارية",            type: "Revenue",   parent: "4000" },
    { code: "4300", name: "أتعاب عقود وتوثيق",        type: "Revenue",   parent: "4000" },
    { code: "4400", name: "أتعاب تحكيم",              type: "Revenue",   parent: "4000" },
    { code: "4500", name: "إيرادات أخرى",              type: "Revenue",   parent: "4000" },
    /* ── المصروفات ── */
    { code: "5000", name: "المصروفات",                 type: "Expense",   parent: null },
    { code: "5100", name: "رواتب ومكافآت",             type: "Expense",   parent: "5000" },
    { code: "5200", name: "إيجار المكتب",              type: "Expense",   parent: "5000" },
    { code: "5300", name: "اتصالات وإنترنت",           type: "Expense",   parent: "5000" },
    { code: "5400", name: "مواد مكتبية",               type: "Expense",   parent: "5000" },
    { code: "5500", name: "تسويق وإعلان",              type: "Expense",   parent: "5000" },
    { code: "5600", name: "نقل ومواصلات",              type: "Expense",   parent: "5000" },
    { code: "5700", name: "رسوم حكومية وقضائية",       type: "Expense",   parent: "5000" },
    { code: "5800", name: "استهلاك وصيانة",            type: "Expense",   parent: "5000" },
    { code: "5900", name: "مصروفات متنوعة",            type: "Expense",   parent: "5000" },
  ];

  for (const a of accounts) {
    await db.execute(sql`
      INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type, parent_code)
      VALUES (${officeId}, ${a.code}, ${a.name}, ${a.type}, ${a.parent})
      ON CONFLICT (office_id, account_code) DO NOTHING
    `).catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════════
   AUTO-POST HELPER — يُستدعى من accounting.ts تلقائياً
══════════════════════════════════════════════════════════ */

export async function autoPostJournalEntry(opts: {
  officeId:        string;
  description:     string;
  referenceNumber?: string;
  referenceType?:  string;
  referenceId?:    string;
  date?:           string;
  debitCode:       string;
  debitName:       string;
  debitType:       string;
  creditCode:      string;
  creditName:      string;
  creditType:      string;
  amount:          number;
}): Promise<void> {
  if (opts.amount <= 0) return;
  const d = opts.date ?? new Date().toISOString().split("T")[0];

  const entryResult = await db.execute(sql`
    INSERT INTO journal_entries (office_id, entry_date, description, reference_number, reference_type, reference_id, posted_by)
    VALUES (${opts.officeId}, ${d}::date, ${opts.description}, ${opts.referenceNumber ?? null}, ${opts.referenceType ?? null}, ${opts.referenceId ?? null}, 'system')
    RETURNING id
  `);
  const entryId = ((entryResult as any)?.rows?.[0] ?? (entryResult as any)?.[0])?.id;
  if (!entryId) return;

  await db.execute(sql`
    INSERT INTO journal_items (entry_id, office_id, account_code, account_name, account_type, debit, credit)
    VALUES
      (${entryId}::uuid, ${opts.officeId}, ${opts.debitCode},  ${opts.debitName},  ${opts.debitType},  ${opts.amount}, 0),
      (${entryId}::uuid, ${opts.officeId}, ${opts.creditCode}, ${opts.creditName}, ${opts.creditType}, 0, ${opts.amount})
  `);
}

/* ══════════════════════════════════════════════════════════
   ROUTES — دليل الحسابات
══════════════════════════════════════════════════════════ */

router.get("/accounting/journal/accounts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    await ensureJournalTables(tenantId);
    const data = await rows(sql`
      SELECT * FROM chart_of_accounts WHERE office_id = ${tenantId} ORDER BY account_code
    `);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/accounting/journal/accounts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { accountCode, accountName, accountType, parentCode } = req.body;
    if (!accountCode || !accountName || !accountType) {
      return res.status(400).json({ error: "رمز الحساب والاسم والنوع مطلوبة" });
    }
    const r = await one(sql`
      INSERT INTO chart_of_accounts (office_id, account_code, account_name, account_type, parent_code)
      VALUES (${tenantId}, ${accountCode}, ${accountName}, ${accountType}, ${parentCode ?? null})
      ON CONFLICT (office_id, account_code) DO UPDATE SET account_name=${accountName}, account_type=${accountType}
      RETURNING *
    `);
    res.json(r);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   ROUTES — القيود اليومية
══════════════════════════════════════════════════════════ */

router.get("/accounting/journal/entries", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const limit    = parseInt(String(req.query.limit ?? "50"));
    const offset   = parseInt(String(req.query.offset ?? "0"));
    const from     = req.query.from as string | undefined;
    const to       = req.query.to   as string | undefined;

    const entries = await rows(sql`
      SELECT e.*,
        json_agg(json_build_object(
          'account_code', i.account_code,
          'account_name', i.account_name,
          'account_type', i.account_type,
          'debit',  i.debit,
          'credit', i.credit
        ) ORDER BY i.debit DESC) AS items
      FROM journal_entries e
      LEFT JOIN journal_items i ON i.entry_id = e.id
      WHERE e.office_id = ${tenantId}
        ${from ? sql`AND e.entry_date >= ${from}::date` : sql``}
        ${to   ? sql`AND e.entry_date <= ${to}::date`   : sql``}
      GROUP BY e.id
      ORDER BY e.entry_date DESC, e.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    res.json(entries);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* قيد يدوي — يجب أن يكون متوازناً (مجموع مدين = مجموع دائن) */
router.post("/accounting/journal/entries", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { description, entryDate, referenceNumber, items } = req.body;
    if (!description || !items?.length) {
      return res.status(400).json({ error: "الوصف وبنود القيد مطلوبة" });
    }

    const totalDebit  = items.reduce((s: number, i: any) => s + num(i.debit),  0);
    const totalCredit = items.reduce((s: number, i: any) => s + num(i.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: `القيد غير متوازن: مدين ${totalDebit.toFixed(2)} ≠ دائن ${totalCredit.toFixed(2)}` });
    }

    await ensureJournalTables(tenantId);
    const entry = await one(sql`
      INSERT INTO journal_entries (office_id, entry_date, description, reference_number, posted_by)
      VALUES (${tenantId}, ${entryDate ?? new Date().toISOString().split("T")[0]}::date, ${description}, ${referenceNumber ?? null}, 'manual')
      RETURNING *
    `);

    for (const item of items) {
      await db.execute(sql`
        INSERT INTO journal_items (entry_id, office_id, account_code, account_name, account_type, debit, credit, notes)
        VALUES (
          ${entry.id}::uuid, ${tenantId},
          ${item.accountCode}, ${item.accountName}, ${item.accountType},
          ${num(item.debit)}, ${num(item.credit)}, ${item.notes ?? null}
        )
      `);
    }

    res.json({ ...entry, items });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   FINANCIAL STATEMENTS
══════════════════════════════════════════════════════════ */

/* ── قائمة الدخل (Income Statement) ── */
router.get("/accounting/statements/income", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const from     = (String(req.query.from)) ?? `${new Date().getFullYear()}-01-01`;
    const to       = (req.query.to   as string) ?? new Date().toISOString().split("T")[0];

    await ensureJournalTables(tenantId);

    /* توحيد المصادر: القيود اليومية + الإيرادات/المصاريف المباشرة + الفواتير المدفوعة */
    const journalLines = await rows(sql`
      SELECT
        i.account_code,
        i.account_name,
        i.account_type,
        SUM(i.credit - i.debit) AS balance
      FROM journal_items i
      JOIN journal_entries e ON e.id = i.entry_id
      WHERE e.office_id = ${tenantId}
        AND e.entry_date BETWEEN ${from}::date AND ${to}::date
        AND i.account_type IN ('Revenue','Expense')
      GROUP BY i.account_code, i.account_name, i.account_type
      ORDER BY i.account_type, i.account_code
    `);

    /* إيرادات مباشرة (revenues table) لمن لم يستخدم القيود بعد */
    const directRev = await rows(sql`
      SELECT category AS account_name, 'Revenue' AS account_type, SUM(amount) AS balance
      FROM revenues
      WHERE office_id = ${tenantId}
        AND date BETWEEN ${from}::date AND ${to}::date
      GROUP BY category
    `).catch(() => []);

    /* فواتير مدفوعة */
    const invoiceRev = await one(sql`
      SELECT COALESCE(SUM(total),0) AS balance FROM client_invoices
      WHERE office_id = ${tenantId} AND status='paid'
        AND created_at BETWEEN ${from}::timestamp AND ${to}::timestamp + interval '1 day'
    `).catch(() => ({ balance: 0 }));

    /* مصاريف مباشرة */
    const directExp = await rows(sql`
      SELECT category AS account_name, 'Expense' AS account_type, SUM(amount) AS balance
      FROM expenses
      WHERE office_id = ${tenantId}
        AND date BETWEEN ${from}::date AND ${to}::date
      GROUP BY category
    `).catch(() => []);

    /* دمج المصادر */
    const revenues: any[]  = [];
    const expenses: any[]  = [];

    /* من القيود */
    for (const l of journalLines) {
      if (l.account_type === "Revenue") revenues.push({ name: l.account_name, code: l.account_code, amount: num(l.balance) });
      else                              expenses.push({ name: l.account_name, code: l.account_code, amount: Math.abs(num(l.balance)) });
    }

    /* من الجداول المباشرة (إذا لم تكن مقيَّدة في دفتر اليومية) */
    if (revenues.length === 0) {
      for (const r of directRev) revenues.push({ name: r.account_name, code: "", amount: num(r.balance) });
      if (num(invoiceRev.balance) > 0) revenues.push({ name: "أتعاب فواتير مدفوعة", code: "4100", amount: num(invoiceRev.balance) });
    }
    if (expenses.length === 0) {
      for (const e of directExp) expenses.push({ name: e.account_name, code: "", amount: num(e.balance) });
    }

    const totalRevenue  = revenues.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netIncome     = totalRevenue - totalExpenses;

    res.json({
      period: { from, to },
      revenues,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
      profitMargin: totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 1000) / 10 : 0,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── الميزانية العمومية (Balance Sheet) ── */
router.get("/accounting/statements/balance-sheet", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const asOf     = (String(req.query.asOf)) ?? new Date().toISOString().split("T")[0];

    await ensureJournalTables(tenantId);

    const balances = await rows(sql`
      SELECT
        i.account_code,
        i.account_name,
        i.account_type,
        SUM(i.debit - i.credit) AS balance
      FROM journal_items i
      JOIN journal_entries e ON e.id = i.entry_id
      WHERE e.office_id = ${tenantId}
        AND e.entry_date <= ${asOf}::date
        AND i.account_type IN ('Asset','Liability','Equity')
      GROUP BY i.account_code, i.account_name, i.account_type
      HAVING ABS(SUM(i.debit - i.credit)) > 0.01
      ORDER BY i.account_type, i.account_code
    `);

    const assets:      any[] = [];
    const liabilities: any[] = [];
    const equity:      any[] = [];

    for (const b of balances) {
      const item = { name: b.account_name, code: b.account_code, amount: num(b.balance) };
      if (b.account_type === "Asset")     assets.push(item);
      if (b.account_type === "Liability") liabilities.push({ ...item, amount: Math.abs(item.amount) });
      if (b.account_type === "Equity")    equity.push({ ...item, amount: Math.abs(item.amount) });
    }

    /* احتساب الربح الصافي المتراكم من قيود الإيرادات/المصاريف */
    const plRow = await one(sql`
      SELECT
        SUM(CASE WHEN i.account_type='Revenue' THEN i.credit - i.debit ELSE 0 END) -
        SUM(CASE WHEN i.account_type='Expense' THEN i.debit - i.credit ELSE 0 END) AS net_income
      FROM journal_items i
      JOIN journal_entries e ON e.id = i.entry_id
      WHERE e.office_id = ${tenantId} AND e.entry_date <= ${asOf}::date
    `).catch(() => ({ net_income: 0 }));

    const netIncome = num(plRow.net_income);
    if (netIncome !== 0) equity.push({ name: "صافي الربح / الخسارة (الفترة)", code: "3300", amount: netIncome });

    const totalAssets      = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const totalEquity      = equity.reduce((s, e) => s + e.amount, 0);

    res.json({
      asOf,
      assets, liabilities, equity,
      totalAssets, totalLiabilities, totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── ميزان المراجعة (Trial Balance) ── */
router.get("/accounting/statements/trial-balance", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const asOf     = (String(req.query.asOf)) ?? new Date().toISOString().split("T")[0];

    await ensureJournalTables(tenantId);

    const data = await rows(sql`
      SELECT
        i.account_code,
        i.account_name,
        i.account_type,
        SUM(i.debit)  AS total_debit,
        SUM(i.credit) AS total_credit,
        SUM(i.debit - i.credit) AS net_balance
      FROM journal_items i
      JOIN journal_entries e ON e.id = i.entry_id
      WHERE e.office_id = ${tenantId}
        AND e.entry_date <= ${asOf}::date
      GROUP BY i.account_code, i.account_name, i.account_type
      ORDER BY i.account_code
    `);

    const totalDebit  = data.reduce((s: number, r: any) => s + num(r.total_debit),  0);
    const totalCredit = data.reduce((s: number, r: any) => s + num(r.total_credit), 0);

    res.json({
      asOf,
      accounts: data.map((r: any) => ({
        code:       r.account_code,
        name:       r.account_name,
        type:       r.account_type,
        totalDebit: num(r.total_debit),
        totalCredit:num(r.total_credit),
        netBalance: num(r.net_balance),
      })),
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
