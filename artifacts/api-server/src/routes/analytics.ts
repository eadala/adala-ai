import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { callAI } from "./aiChat";

const router = Router();

function num(v: any) { return parseFloat(String(v ?? "0")) || 0; }

async function sqlAll(query: any): Promise<Record<string, any>[]> {
  const result = await db.execute(query) as any;
  if (Array.isArray(result)) return result;
  if (result?.rows && Array.isArray(result.rows)) return result.rows;
  return [];
}

async function sqlOne(query: any): Promise<Record<string, any>> {
  const rows = await sqlAll(query);
  return rows[0] ?? {};
}

function periodMonths(period: string): number {
  switch (period) {
    case "30d": return 1;
    case "3m":  return 3;
    case "6m":  return 6;
    default:    return 12;
  }
}

/** Returns an ISO timestamp string for the start of the requested period.
 *  Using a JS-computed date avoids sql.raw() for INTERVAL expressions. */
function periodStartDate(period: string): string {
  const d = new Date();
  switch (period) {
    case "30d": d.setDate(d.getDate() - 30); break;
    case "3m":  d.setMonth(d.getMonth() - 3); break;
    case "6m":  d.setMonth(d.getMonth() - 6); break;
    default:    d.setFullYear(d.getFullYear() - 1); break;
  }
  return d.toISOString();
}

/* ─── FINANCIAL analytics ─────────────────────────────────── */
router.get("/analytics/financial", requireAuth, async (req, res) => {
  try {
    const period = String(req.query.period ?? "1y");
    const startDate = periodStartDate(period);
    const months = periodMonths(period);

    // Monthly revenue from revenues table
    const revMonthly = await sqlAll(sql`
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month_key,
        TO_CHAR(date, 'Mon') AS month_label,
        SUM(amount) AS revenue
      FROM revenues
      WHERE date >= ${startDate}::timestamptz
      GROUP BY month_key, month_label
      ORDER BY month_key
    `);

    // Monthly paid invoices contribution
    const invMonthly = await sqlAll(sql`
      SELECT
        TO_CHAR(paid_at::date, 'YYYY-MM') AS month_key,
        SUM(total) / 100.0 AS inv_revenue
      FROM client_invoices
      WHERE status = 'paid'
        AND paid_at IS NOT NULL
        AND paid_at::date >= ${startDate}::timestamptz
      GROUP BY month_key
      ORDER BY month_key
    `);

    // Monthly expenses
    const expMonthly = await sqlAll(sql`
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month_key,
        TO_CHAR(date, 'Mon') AS month_label,
        SUM(amount) AS expenses
      FROM expenses
      WHERE date >= ${startDate}::timestamptz
      GROUP BY month_key, month_label
      ORDER BY month_key
    `);

    // Build merged monthly map
    const monthMap: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};

    // Generate last N months as skeleton
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("ar-SA", { month: "short" });
      monthMap[key] = { month: label, revenue: 0, expenses: 0, profit: 0 };
    }

    for (const r of revMonthly) {
      if (monthMap[r.month_key]) monthMap[r.month_key].revenue += num(r.revenue);
      else monthMap[r.month_key] = { month: r.month_label, revenue: num(r.revenue), expenses: 0, profit: 0 };
    }
    for (const r of invMonthly) {
      if (monthMap[r.month_key]) monthMap[r.month_key].revenue += num(r.inv_revenue);
    }
    for (const r of expMonthly) {
      if (monthMap[r.month_key]) monthMap[r.month_key].expenses += num(r.expenses);
    }

    const monthly = Object.values(monthMap).map(m => ({
      ...m,
      profit: m.revenue - m.expenses,
    }));

    // Totals
    const totRev = await sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM revenues WHERE date >= ${startDate}::timestamptz`);
    const totInv = await sqlOne(sql`SELECT COALESCE(SUM(total),0)/100.0 AS total FROM client_invoices WHERE status='paid' AND paid_at IS NOT NULL AND paid_at::date >= ${startDate}::timestamptz`);
    const totExp = await sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date >= ${startDate}::timestamptz`);
    const totalRevenue = num(totRev.total) + num(totInv.total);
    const totalExpenses = num(totExp.total);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Invoice collection rate
    const invStats = await sqlOne(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
        COUNT(*) AS total_count,
        COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) / 100.0 AS paid_amount,
        COALESCE(SUM(total), 0) / 100.0 AS total_amount
      FROM client_invoices
      WHERE created_at >= ${startDate}::timestamptz
    `);
    const collectionRate = num(invStats.total_amount) > 0
      ? (num(invStats.paid_amount) / num(invStats.total_amount)) * 100
      : 0;

    // Revenue by category
    const revCategories = await sqlAll(sql`
      SELECT category AS name, SUM(amount) AS value
      FROM revenues
      WHERE date >= ${startDate}::timestamptz
      GROUP BY category ORDER BY value DESC LIMIT 6
    `);

    // Expense by category
    const expCategories = await sqlAll(sql`
      SELECT category AS name, SUM(amount) AS value
      FROM expenses
      WHERE date >= ${startDate}::timestamptz
      GROUP BY category ORDER BY value DESC LIMIT 6
    `);

    res.json({
      monthly,
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      collectionRate,
      paidInvoices: num(invStats.paid_count),
      totalInvoices: num(invStats.total_count),
      revCategories: revCategories.map(r => ({ name: r.name, value: num(r.value) })),
      expCategories: expCategories.map(r => ({ name: r.name, value: num(r.value) })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── CASES analytics ─────────────────────────────────────── */
router.get("/analytics/cases", requireAuth, async (req, res) => {
  try {
    const period = String(req.query.period ?? "1y");
    const startDate = periodStartDate(period);
    const months = periodMonths(period);

    // By type
    const byType = await sqlAll(sql`
      SELECT case_type AS name, COUNT(*) AS value
      FROM cases
      WHERE created_at >= ${startDate}::timestamptz
      GROUP BY case_type ORDER BY value DESC
    `);

    // By status
    const byStatus = await sqlAll(sql`
      SELECT status AS name, COUNT(*) AS value
      FROM cases
      WHERE created_at >= ${startDate}::timestamptz
      GROUP BY status ORDER BY value DESC
    `);

    // Monthly new cases trend
    const skeleton: Record<string, { month: string; total: number; closed: number; open: number }> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      skeleton[key] = { month: d.toLocaleString("ar-SA", { month: "short" }), total: 0, closed: 0, open: 0 };
    }

    const monthlyTrend = await sqlAll(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month_key,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('closed','مغلقة','فائزة','فاز')) AS closed,
        COUNT(*) FILTER (WHERE status NOT IN ('closed','مغلقة','فائزة','فاز')) AS open
      FROM cases
      WHERE created_at >= ${startDate}::timestamptz
      GROUP BY month_key ORDER BY month_key
    `);

    for (const r of monthlyTrend) {
      if (skeleton[r.month_key]) {
        skeleton[r.month_key].total = num(r.total);
        skeleton[r.month_key].closed = num(r.closed);
        skeleton[r.month_key].open = num(r.open);
      }
    }

    // KPIs
    const totals = await sqlOne(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('closed','مغلقة','فائزة','فاز')) AS closed,
        COUNT(*) FILTER (WHERE status = 'open' OR status = 'مفتوحة') AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress' OR status = 'قيد النظر') AS in_progress,
        ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)) AS avg_days
      FROM cases
      WHERE created_at >= ${startDate}::timestamptz
    `);

    const total = num(totals.total);
    const closed = num(totals.closed);
    const successRate = total > 0 ? Math.round((closed / total) * 100) : 0;
    const avgDays = num(totals.avg_days);

    res.json({
      byType: byType.map(r => ({ name: r.name, value: num(r.value) })),
      byStatus: byStatus.map(r => ({ name: r.name, value: num(r.value) })),
      monthly: Object.values(skeleton),
      total,
      closed,
      open: num(totals.open),
      inProgress: num(totals.in_progress),
      successRate,
      avgDays: Math.round(avgDays),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── TEAM analytics ──────────────────────────────────────── */
router.get("/analytics/team", requireAuth, async (req, res) => {
  try {
    const period = String(req.query.period ?? "1y");
    const startDate = periodStartDate(period);

    // Cases per assignee
    const casesByAssignee = await sqlAll(sql`
      SELECT
        COALESCE(assigned_to, 'غير محدد') AS name,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('closed','مغلقة','فائزة','فاز')) AS closed
      FROM cases
      WHERE created_at >= ${startDate}::timestamptz
      GROUP BY assigned_to ORDER BY total DESC LIMIT 10
    `);

    // Employees list for enrichment
    const employees = await sqlAll(sql`
      SELECT full_name, job_title, department, status FROM employees WHERE status = 'active' LIMIT 20
    `);

    // Team size
    const teamStats = await sqlOne(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active
      FROM employees
    `);

    // Invoice revenue per assignee (via cases)
    const revenueByMember = await sqlAll(sql`
      SELECT
        COALESCE(c.assigned_to, 'غير محدد') AS name,
        COALESCE(SUM(i.total), 0) / 100.0 AS revenue
      FROM cases c
      JOIN client_invoices i ON i.case_id = c.id AND i.status = 'paid'
      WHERE c.created_at >= ${startDate}::timestamptz
      GROUP BY c.assigned_to ORDER BY revenue DESC LIMIT 10
    `);

    res.json({
      casesByMember: casesByAssignee.map(r => ({
        name: r.name,
        قضايا: num(r.total),
        مغلقة: num(r.closed),
        نسبة: num(r.total) > 0 ? Math.round((num(r.closed) / num(r.total)) * 100) : 0,
      })),
      revenueByMember: revenueByMember.map(r => ({
        name: r.name,
        إيرادات: Math.round(num(r.revenue)),
      })),
      employees: employees.map(e => ({
        name: e.full_name,
        title: e.job_title,
        dept: e.department,
      })),
      teamTotal: num(teamStats.total),
      teamActive: num(teamStats.active),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── CLIENTS analytics ───────────────────────────────────── */
router.get("/analytics/clients", requireAuth, async (req, res) => {
  try {
    const period = String(req.query.period ?? "1y");
    const startDate = periodStartDate(period);
    const months = periodMonths(period);

    // New clients per month
    const skeleton: Record<string, { month: string; عملاء: number }> = {};
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      skeleton[key] = { month: d.toLocaleString("ar-SA", { month: "short" }), عملاء: 0 };
    }

    const clientsMonthly = await sqlAll(sql`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month_key, COUNT(*) AS cnt
      FROM clients
      WHERE created_at >= ${startDate}::timestamptz
      GROUP BY month_key ORDER BY month_key
    `);
    for (const r of clientsMonthly) {
      if (skeleton[r.month_key]) skeleton[r.month_key].عملاء = num(r.cnt);
    }

    // Client type breakdown
    const byType = await sqlAll(sql`
      SELECT type AS name, COUNT(*) AS value
      FROM clients
      GROUP BY type ORDER BY value DESC
    `);

    // Top clients by invoice revenue — aggregate each side independently to avoid join multiplication
    const topClients = await sqlAll(sql`
      SELECT
        cl.id,
        cl.full_name AS name,
        cl.type,
        COALESCE(cc.cases_count, 0) AS cases_count,
        COALESCE(inv.revenue, 0)    AS revenue
      FROM clients cl
      LEFT JOIN (
        SELECT client_name, COUNT(*) AS cases_count
        FROM cases
        GROUP BY client_name
      ) cc ON cc.client_name = cl.full_name
      LEFT JOIN (
        SELECT client_id, SUM(total) / 100.0 AS revenue
        FROM client_invoices
        WHERE status = 'paid'
        GROUP BY client_id
      ) inv ON inv.client_id = cl.id::text
      ORDER BY revenue DESC NULLS LAST, cases_count DESC
      LIMIT 8
    `);

    // KPIs
    const totals = await sqlOne(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE created_at >= ${startDate}::timestamptz) AS new_in_period
      FROM clients
    `);

    res.json({
      monthly: Object.values(skeleton),
      byType: byType.map(r => ({ name: r.name === "individual" ? "أفراد" : r.name === "company" ? "شركات" : r.name, value: num(r.value) })),
      topClients: topClients.map(r => ({
        name: r.name,
        type: r.type,
        قضايا: num(r.cases_count),
        إيرادات: Math.round(num(r.revenue)),
      })),
      totalClients: num(totals.total),
      activeClients: num(totals.active),
      newInPeriod: num(totals.new_in_period),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── AI INSIGHTS ──────────────────────────────────────────── */
router.get("/analytics/ai-insights", requireAuth, async (req, res) => {
  try {
    const period = String(req.query.period ?? "1y");
    const force  = req.query.force === "1";
    const cacheKey = `ai_insights_${period}`;

    if (!force) {
      const cached = await sqlOne(sql`
        SELECT content, model_used FROM ai_analytics_cache
        WHERE cache_key = ${cacheKey} AND expires_at > NOW() LIMIT 1
      `);
      if (cached?.content) {
        return res.json({ insights: cached.content, modelUsed: cached.model_used, cached: true });
      }
    }

    const startDate = periodStartDate(period);

    const [rev, exp, casesRow, topLawyer, invRow] = await Promise.all([
      sqlOne(sql`SELECT COALESCE(SUM(amount)/100.0,0)::numeric AS total FROM revenues WHERE date >= ${startDate}::timestamptz`),
      sqlOne(sql`SELECT COALESCE(SUM(amount)/100.0,0)::numeric AS total FROM expenses WHERE date >= ${startDate}::timestamptz`),
      sqlOne(sql`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status='open')   AS open,
          COUNT(*) FILTER (WHERE status='closed') AS closed
        FROM cases WHERE created_at >= ${startDate}::timestamptz
      `),
      sqlOne(sql`
        SELECT assigned_to AS name, COUNT(*) AS cnt FROM cases
        WHERE assigned_to IS NOT NULL AND created_at >= ${startDate}::timestamptz
        GROUP BY assigned_to ORDER BY cnt DESC LIMIT 1
      `),
      sqlOne(sql`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status='paid') AS paid,
          COALESCE(SUM(total) FILTER (WHERE status='paid')/100.0,0)::numeric AS collected
        FROM client_invoices WHERE created_at >= ${startDate}::timestamptz
      `),
    ]);

    const totalRevenue  = num(rev.total);
    const totalExpenses = num(exp.total);
    const netProfit     = totalRevenue - totalExpenses;
    const profitMargin  = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0";
    const collRate      = num(invRow.total) > 0
      ? ((num(invRow.paid) / num(invRow.total)) * 100).toFixed(1)
      : "0";

    const ctx = [
      `الفترة الزمنية: ${period === "30d" ? "آخر 30 يوم" : period === "3m" ? "3 أشهر" : period === "6m" ? "6 أشهر" : "سنة كاملة"}`,
      `الإيرادات: ${totalRevenue.toLocaleString("ar-SA")} ر.س`,
      `المصروفات: ${totalExpenses.toLocaleString("ar-SA")} ر.س`,
      `صافي الربح: ${netProfit.toLocaleString("ar-SA")} ر.س (هامش ${profitMargin}%)`,
      `القضايا الجديدة: ${num(casesRow.total)} (${num(casesRow.open)} مفتوحة، ${num(casesRow.closed)} مغلقة)`,
      `الفواتير: ${num(invRow.total)} فاتورة — معدل التحصيل ${collRate}% — محصّل: ${num(invRow.collected).toLocaleString("ar-SA")} ر.س`,
      topLawyer.name ? `أعلى أداء: ${topLawyer.name} (${topLawyer.cnt} قضية)` : "",
    ].filter(Boolean).join("\n");

    const system = `أنت مستشار استراتيجي متخصص في تحليل أداء المكاتب القانونية. حلّل البيانات وأنتج تقريراً تحليلياً احترافياً موجزاً باللغة العربية يشمل:
1. **ملخص الأداء** — جملة تلخص الوضع العام
2. **نقاط القوة** — 2-3 مؤشرات إيجابية
3. **فرص التحسين** — 2-3 توصيات عملية
4. **تنبيهات** — أنماط تستحق الانتباه
استخدم الأرقام بدقة. أبقِ الرد بين 200-300 كلمة. استخدم ** للعناوين.`;

    const { reply, modelUsed } = await callAI(system, ctx);

    await db.execute(sql`
      INSERT INTO ai_analytics_cache (cache_key, content, model_used, expires_at)
      VALUES (${cacheKey}, ${reply}, ${modelUsed}, NOW() + INTERVAL '6 hours')
      ON CONFLICT (cache_key) DO UPDATE
        SET content = ${reply}, model_used = ${modelUsed},
            created_at = NOW(), expires_at = NOW() + INTERVAL '6 hours'
    `);

    res.json({ insights: reply, modelUsed, cached: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

/* ─── PERFORMANCE SCORE ───────────────────────────────────────── */
router.get("/analytics/performance", requireAuth, async (req, res) => {
  try {
    const period = String(req.query.period ?? "1y");
    const startDate = periodStartDate(period);

    /* 1. Financial health */
    const [invStats, revRow, expRow] = await Promise.all([
      sqlOne(sql`
        SELECT
          COUNT(*) FILTER (WHERE status='paid')   AS paid_count,
          COUNT(*)                                 AS total_count,
          COALESCE(SUM(total) FILTER (WHERE status='paid'),0)/100.0 AS paid_amt,
          COALESCE(SUM(total),0)/100.0             AS total_amt
        FROM client_invoices
        WHERE created_at >= ${startDate}::timestamptz
      `),
      sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS r FROM revenues  WHERE date >= ${startDate}::timestamptz`),
      sqlOne(sql`SELECT COALESCE(SUM(amount),0) AS e FROM expenses  WHERE date >= ${startDate}::timestamptz`),
    ]);
    const collectionRate = num(invStats.total_amt) > 0 ? (num(invStats.paid_amt) / num(invStats.total_amt)) * 100 : 0;
    const totalRevenue   = num(revRow.r) + num(invStats.paid_amt);
    const totalExpenses  = num(expRow.e);
    const profitMargin   = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
    const financialScore = Math.min(100, Math.round(collectionRate * 0.5 + Math.max(0, profitMargin) * 0.5));

    /* 2. Cases performance */
    const casesRow = await sqlOne(sql`
      SELECT
        COUNT(*)                              AS total,
        COUNT(*) FILTER (WHERE status='won') AS won,
        COUNT(*) FILTER (WHERE status='lost') AS lost,
        COUNT(*) FILTER (WHERE status='closed') AS closed,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) FILTER (WHERE status IN ('won','lost','closed')) AS avg_days
      FROM cases
      WHERE created_at >= ${startDate}::timestamptz
    `);
    const totalCases  = num(casesRow.total);
    const decidedCases = num(casesRow.won) + num(casesRow.lost);
    const successRate = decidedCases > 0 ? (num(casesRow.won) / decidedCases) * 100 : totalCases > 0 ? 50 : 0;
    const avgDays     = num(casesRow.avg_days) || 0;
    const speedScore  = avgDays === 0 ? 70 : Math.min(100, Math.max(0, 100 - (avgDays - 30) * 0.5));
    const casesScore  = Math.round(successRate * 0.6 + speedScore * 0.4);

    /* 3. Client retention */
    const [clientsNow, clientsPrev] = await Promise.all([
      sqlOne(sql`SELECT COUNT(DISTINCT client_id) AS c FROM cases WHERE created_at >= ${startDate}::timestamptz`),
      sqlOne(sql`SELECT COUNT(DISTINCT client_id) AS c FROM cases WHERE created_at < ${startDate}::timestamptz AND created_at >= NOW() - INTERVAL '2 years'`),
    ]);
    const repeatClients = await sqlOne(sql`
      SELECT COUNT(*) AS c FROM (
        SELECT client_id FROM cases
        WHERE created_at >= ${startDate}::timestamptz
        GROUP BY client_id HAVING COUNT(*) > 1
      ) t
    `);
    const retention = num(clientsNow.c) > 0 ? Math.min(100, (num(repeatClients.c) / num(clientsNow.c)) * 100 + 30) : 40;
    const clientScore = Math.round(Math.min(100, retention));

    /* 4. AI adoption */
    const aiRow = await sqlOne(sql`
      SELECT
        COALESCE(SUM(units),0)  AS units,
        COUNT(*)                AS calls
      FROM usage_logs
      WHERE created_at >= ${startDate}::timestamptz
    `);
    const credRow = await sqlOne(sql`
      SELECT balance, monthly_allowance FROM office_ai_credits WHERE office_id='default' LIMIT 1
    `).catch(() => ({ balance: 0, monthly_allowance: 0 }));
    const aiCalls    = num(aiRow.calls);
    const aiUnits    = num(aiRow.units);
    const allowance  = num(credRow.monthly_allowance) || 1000;
    const balance    = num(credRow.balance);
    const aiUsagePct = Math.min(100, ((allowance - balance) / allowance) * 100);
    const aiScore    = Math.min(100, aiCalls > 0 ? 40 + aiUsagePct * 0.6 : 10);

    /* Composite score */
    const composite = Math.round(
      financialScore * 0.35 +
      casesScore     * 0.35 +
      clientScore    * 0.20 +
      aiScore        * 0.10
    );
    const scoreBand =
      composite >= 80 ? "excellent" :
      composite >= 65 ? "good"      :
      composite >= 45 ? "average"   : "needsImprovement";

    /* Previous period composite (for trend) */
    const prevInv = await sqlOne(sql`
      SELECT
        COALESCE(SUM(total) FILTER (WHERE status='paid'),0)/100.0 AS paid_amt,
        COALESCE(SUM(total),0)/100.0 AS total_amt
      FROM client_invoices
      WHERE created_at >= NOW() - INTERVAL '2 years'
        AND created_at < ${startDate}::timestamptz
    `);
    const prevCollRate = num(prevInv.total_amt) > 0 ? (num(prevInv.paid_amt) / num(prevInv.total_amt)) * 100 : 0;
    const prevCases = await sqlOne(sql`
      SELECT
        COUNT(*) FILTER (WHERE status='won')  AS won,
        COUNT(*) FILTER (WHERE status='lost') AS lost
      FROM cases
      WHERE created_at >= NOW() - INTERVAL '2 years'
        AND created_at < ${startDate}::timestamptz
    `);
    const prevDecided = num(prevCases.won) + num(prevCases.lost);
    const prevSuccess = prevDecided > 0 ? (num(prevCases.won) / prevDecided) * 100 : 50;
    const prevFinScore = Math.round(prevCollRate * 0.5 + Math.max(0, profitMargin - 5) * 0.5);
    const prevCasScore = Math.round(prevSuccess * 0.6 + speedScore * 0.4);
    const prevComposite = Math.round(prevFinScore * 0.35 + prevCasScore * 0.35 + 40 * 0.20 + 10 * 0.10);
    const trend = composite - prevComposite;

    res.json({
      composite,
      scoreBand,
      trend,
      dimensions: {
        financial: { score: financialScore, collectionRate: parseFloat(collectionRate.toFixed(1)), profitMargin: parseFloat(profitMargin.toFixed(1)), totalRevenue, totalExpenses },
        cases:     { score: casesScore, successRate: parseFloat(successRate.toFixed(1)), avgDays: parseFloat(avgDays.toFixed(0)), total: totalCases },
        clients:   { score: clientScore, retention: parseFloat(retention.toFixed(1)), total: num(clientsNow.c), repeat: num(repeatClients.c) },
        ai:        { score: Math.round(aiScore), calls: aiCalls, units: aiUnits, usagePct: parseFloat(aiUsagePct.toFixed(1)), balance, allowance },
      },
      benchmarks: { industryAvg: 62, topQuartile: 83 },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
