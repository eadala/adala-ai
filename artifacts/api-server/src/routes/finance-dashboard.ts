/**
 * Finance Dashboard — Aggregation Layer
 * يجمع من 4 مصادر:
 *   ledger_entries      → رصيد المنصة + revenue split
 *   payment_transactions → حركات الدفع
 *   client_invoices     → حالة الفواتير
 *   revenues + expenses  → التدفق النقدي الفعلي
 */
import { Router, type Request, type Response } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function sqlRows(r: any): any[] { return r.rows ?? r ?? []; }

/* ─── helper ─── */
function genInsights(data: {
  netFlow: number;
  overdueCount: number;
  netProfit: number;
  revenueGrowth: number;
  expenseGrowth: number;
  topRevenueCategory: string;
}): string[] {
  const out: string[] = [];
  if (data.netFlow < 0)         out.push("🔴 التدفق النقدي سلبي هذا الشهر — المصاريف تتجاوز الإيرادات");
  if (data.overdueCount > 5)    out.push(`⚠️ ${data.overdueCount} فاتورة متأخرة — تحتاج لمتابعة عاجلة`);
  if (data.overdueCount > 0 && data.overdueCount <= 5) out.push(`📌 ${data.overdueCount} فواتير تجاوزت تاريخ الاستحقاق`);
  if (data.netProfit < 0)       out.push("🔴 إجمالي المصاريف أعلى من الإيرادات — راجع بنود الإنفاق");
  if (data.revenueGrowth > 10)  out.push(`📈 الإيرادات ارتفعت ${data.revenueGrowth.toFixed(0)}% مقارنة بالشهر الماضي`);
  if (data.revenueGrowth < -10) out.push(`📉 الإيرادات انخفضت ${Math.abs(data.revenueGrowth).toFixed(0)}% — تحقق من الأسباب`);
  if (data.expenseGrowth > 20)  out.push(`⚠️ المصاريف ارتفعت ${data.expenseGrowth.toFixed(0)}% — راجع بنود الإنفاق`);
  if (data.topRevenueCategory)  out.push(`💡 أعلى مصدر دخل: ${data.topRevenueCategory}`);
  if (data.netFlow > 0 && data.overdueCount === 0) out.push("✅ التدفق النقدي إيجابي ولا توجد فواتير متأخرة");
  return out.length ? out : ["✅ الوضع المالي مستقر — لا توجد تحذيرات"];
}

/* ══════════════════════════════════════════════════════════
   GET /api/finance-dashboard/overview
   لوحة التحكم الرئيسية — كل البيانات دفعة واحدة
   ══════════════════════════════════════════════════════════ */
router.get("/finance-dashboard/overview", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId  = (req as any).tenantId ?? "default";
    const period    = (req.query.period as string) ?? "30";      // days
    const cutoff    = Number(period) > 0 ? Number(period) : 30;

    /* ── 1. Revenue & Expense totals ── */
    const [revRows, expRows] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(amount),0) AS total, category
        FROM revenues
        WHERE office_id = ${officeId}
          AND date >= CURRENT_DATE - ${cutoff}::int
        GROUP BY category ORDER BY total DESC
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount),0) AS total, category
        FROM expenses
        WHERE office_id = ${officeId}
          AND date >= CURRENT_DATE - ${cutoff}::int
        GROUP BY category ORDER BY total DESC
      `),
    ]);
    const revCats = sqlRows(revRows);
    const expCats = sqlRows(expRows);
    const totalRevenue  = revCats.reduce((s: number, r: any) => s + Number(r.total), 0);
    const totalExpenses = expCats.reduce((s: number, r: any) => s + Number(r.total), 0);
    const netProfit     = +(totalRevenue - totalExpenses).toFixed(2);

    /* ── 2. Previous period for growth % ── */
    const [prevRevRows, prevExpRows] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM revenues
        WHERE office_id = ${officeId}
          AND date >= CURRENT_DATE - ${cutoff * 2}::int
          AND date <  CURRENT_DATE - ${cutoff}::int
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount),0) AS total FROM expenses
        WHERE office_id = ${officeId}
          AND date >= CURRENT_DATE - ${cutoff * 2}::int
          AND date <  CURRENT_DATE - ${cutoff}::int
      `),
    ]);
    const prevRev = Number(sqlRows(prevRevRows)[0]?.total ?? 0);
    const prevExp = Number(sqlRows(prevExpRows)[0]?.total ?? 0);
    const revenueGrowth  = prevRev > 0 ? ((totalRevenue - prevRev) / prevRev) * 100 : 0;
    const expenseGrowth  = prevExp > 0 ? ((totalExpenses - prevExp) / prevExp) * 100 : 0;

    /* ── 3. Invoice stats ── */
    const invRows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid')    AS paid_count,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'draft')   AS draft_count,
        COUNT(*) FILTER (
          WHERE status != 'paid'
            AND due_date IS NOT NULL
            AND due_date != ''
            AND TO_DATE(due_date, 'YYYY-MM-DD') < CURRENT_DATE
        )                                           AS overdue_count,
        COALESCE(SUM(total) FILTER (WHERE status = 'paid'),    0) AS paid_amount,
        COALESCE(SUM(total) FILTER (WHERE status = 'pending'), 0) AS pending_amount
      FROM client_invoices
      WHERE office_id = ${officeId}
    `);
    const inv = sqlRows(invRows)[0] ?? {};

    /* ── 4. Payment transactions (ledger-engine) ── */
    const txRows = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount),0)       AS gross,
        COALESCE(SUM(platform_fee),0) AS platform_fees,
        COALESCE(SUM(net_amount),0)   AS net,
        COUNT(*)                       AS count
      FROM payment_transactions
      WHERE office_id = ${officeId}
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '1 day' * ${cutoff}
    `);
    const tx = sqlRows(txRows)[0] ?? {};

    /* ── 5. Ledger balance ── */
    const balRows = await db.execute(sql`
      SELECT balance_after FROM ledger_entries
      WHERE office_id = ${officeId}
      ORDER BY created_at DESC LIMIT 1
    `);
    const currentBalance = Number(sqlRows(balRows)[0]?.balance_after ?? 0);

    /* ── 6. Recent transactions feed ── */
    const recentRows = await db.execute(sql`
      SELECT pt.id, pt.client_name, pt.amount, pt.net_amount, pt.platform_fee,
             pt.status, pt.gateway, pt.created_at, pt.description
      FROM payment_transactions pt
      WHERE pt.office_id = ${officeId}
      ORDER BY pt.created_at DESC LIMIT 8
    `);

    /* ── 7. Insights ── */
    const insights = genInsights({
      netFlow:            netProfit,
      overdueCount:       Number(inv.overdue_count ?? 0),
      netProfit,
      revenueGrowth,
      expenseGrowth,
      topRevenueCategory: revCats[0]?.category ?? "",
    });

    res.json({
      period: cutoff,
      summary: {
        totalRevenue:  +totalRevenue.toFixed(2),
        totalExpenses: +totalExpenses.toFixed(2),
        netProfit,
        currentBalance,
        revenueGrowth:  +revenueGrowth.toFixed(1),
        expenseGrowth:  +expenseGrowth.toFixed(1),
        grossPayments:  +Number(tx.gross  ?? 0).toFixed(2),
        platformFees:   +Number(tx.platform_fees ?? 0).toFixed(2),
        netPayments:    +Number(tx.net    ?? 0).toFixed(2),
        paymentCount:   Number(tx.count   ?? 0),
      },
      invoices: {
        paid:     Number(inv.paid_count    ?? 0),
        pending:  Number(inv.pending_count ?? 0),
        draft:    Number(inv.draft_count   ?? 0),
        overdue:  Number(inv.overdue_count ?? 0),
        paidAmount:    +Number(inv.paid_amount    ?? 0).toFixed(2),
        pendingAmount: +Number(inv.pending_amount ?? 0).toFixed(2),
      },
      revenueByCategory: revCats.map((r: any) => ({ name: r.category, value: +Number(r.total).toFixed(2) })),
      expenseByCategory: expCats.map((r: any) => ({ name: r.category, value: +Number(r.total).toFixed(2) })),
      recentTransactions: sqlRows(recentRows),
      insights,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   GET /api/finance-dashboard/cashflow?months=6
   تدفق نقدي شهري — revenues vs expenses vs net
   ══════════════════════════════════════════════════════════ */
router.get("/finance-dashboard/cashflow", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = (req as any).tenantId ?? "default";
    const months   = Math.min(Number(req.query.months) || 6, 24);

    const [revRows, expRows] = await Promise.all([
      db.execute(sql`
        SELECT
          TO_CHAR(date, 'YYYY-MM') AS month,
          COALESCE(SUM(amount), 0) AS revenue
        FROM revenues
        WHERE office_id = ${officeId}
          AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * ${months - 1}
        GROUP BY month ORDER BY month ASC
      `),
      db.execute(sql`
        SELECT
          TO_CHAR(date, 'YYYY-MM') AS month,
          COALESCE(SUM(amount), 0) AS expenses
        FROM expenses
        WHERE office_id = ${officeId}
          AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' * ${months - 1}
        GROUP BY month ORDER BY month ASC
      `),
    ]);

    /* دمج الشهرين */
    const revMap = new Map(sqlRows(revRows).map((r: any) => [r.month, +Number(r.revenue).toFixed(2)]));
    const expMap = new Map(sqlRows(expRows).map((r: any) => [r.month, +Number(r.expenses).toFixed(2)]));

    /* أنشئ كل الأشهر المطلوبة حتى لو لا توجد بيانات */
    const allMonths: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      allMonths.push(d.toISOString().slice(0, 7));
    }

    const cashflow = allMonths.map(month => {
      const rev = revMap.get(month) ?? 0;
      const exp = expMap.get(month) ?? 0;
      const label = new Date(month + "-01").toLocaleDateString("ar-SA", { month: "short", year: "2-digit" });
      return { month, label, revenue: rev, expenses: exp, net: +(rev - exp).toFixed(2) };
    });

    /* إجمالي + اتجاه */
    const totalRev = cashflow.reduce((s, c) => s + c.revenue, 0);
    const totalExp = cashflow.reduce((s, c) => s + c.expenses, 0);
    const lastMonth = cashflow[cashflow.length - 1];
    const prevMonth = cashflow[cashflow.length - 2];
    const trend: "up" | "down" | "stable" =
      !prevMonth          ? "stable"
      : lastMonth.net > prevMonth.net ? "up"
      : lastMonth.net < prevMonth.net ? "down" : "stable";

    res.json({
      cashflow,
      totals: {
        revenue:  +totalRev.toFixed(2),
        expenses: +totalExp.toFixed(2),
        net:      +(totalRev - totalExp).toFixed(2),
      },
      trend,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   GET /api/finance-dashboard/invoices
   تحليل الفواتير بالتفصيل
   ══════════════════════════════════════════════════════════ */
router.get("/finance-dashboard/invoices", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = (req as any).tenantId ?? "default";

    const [statsRows, overdueRows, monthlyRows] = await Promise.all([
      db.execute(sql`
        SELECT
          status,
          COUNT(*)         AS count,
          COALESCE(SUM(total), 0) AS amount
        FROM client_invoices
        WHERE office_id = ${officeId}
        GROUP BY status
      `),
      db.execute(sql`
        SELECT id, number, total, due_date, status, created_at
        FROM client_invoices
        WHERE office_id = ${officeId}
          AND status != 'paid'
          AND due_date IS NOT NULL AND due_date != ''
          AND TO_DATE(due_date, 'YYYY-MM-DD') < CURRENT_DATE
        ORDER BY due_date ASC LIMIT 10
      `),
      db.execute(sql`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') AS month,
          COUNT(*) AS count,
          COALESCE(SUM(total), 0) AS amount
        FROM client_invoices
        WHERE office_id = ${officeId}
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month ASC
      `),
    ]);

    res.json({
      byStatus:       sqlRows(statsRows),
      overdueList:    sqlRows(overdueRows),
      monthlyTrend:   sqlRows(monthlyRows),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   GET /api/finance-dashboard/growth
   نمو الإيرادات شهرياً — لكل فئة
   ══════════════════════════════════════════════════════════ */
router.get("/finance-dashboard/growth", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = (req as any).tenantId ?? "default";

    const rows = await db.execute(sql`
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month,
        category,
        COALESCE(SUM(amount), 0) AS total
      FROM revenues
      WHERE office_id = ${officeId}
        AND date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month, category
      ORDER BY month ASC, total DESC
    `);

    res.json({ growth: sqlRows(rows) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
