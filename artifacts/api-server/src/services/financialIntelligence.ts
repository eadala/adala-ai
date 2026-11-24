/**
 * Financial Intelligence Core Service
 * Unified engine: KPIs + Anomaly Detection + Forecasting + AI Insights
 * Pulls from real DB tables: revenues, expenses, client_invoices,
 * payment_transactions, office_entitlements, usage_logs
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function one(q: any): Promise<any | null> {
  const r = await rows(q);
  return r[0] ?? null;
}

/* ══════════════════════════════════════════════
   KPIs
══════════════════════════════════════════════ */
async function getKPIs() {
  const rev = await one(sql`
    SELECT COALESCE(SUM(amount),0)::float AS total FROM revenues
  `);
  const exp = await one(sql`
    SELECT COALESCE(SUM(amount),0)::float AS total FROM expenses
  `);
  const thisMonth = await one(sql`
    SELECT
      COALESCE(SUM(r.amount),0)::float AS revenue,
      COALESCE(SUM(e.amount),0)::float AS expenses
    FROM
      (SELECT amount FROM revenues  WHERE date >= date_trunc('month', CURRENT_DATE)) r
    FULL OUTER JOIN
      (SELECT amount FROM expenses WHERE date >= date_trunc('month', CURRENT_DATE)) e ON true
  `);
  const lastMonth = await one(sql`
    SELECT
      COALESCE(SUM(r.amount),0)::float AS revenue,
      COALESCE(SUM(e.amount),0)::float AS expenses
    FROM
      (SELECT amount FROM revenues  WHERE date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                     AND date  <  date_trunc('month', CURRENT_DATE)) r
    FULL OUTER JOIN
      (SELECT amount FROM expenses WHERE date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                    AND date  <  date_trunc('month', CURRENT_DATE)) e ON true
  `);
  const invoices = await one(sql`
    SELECT
      COUNT(*)::int                                                       AS total,
      COUNT(*) FILTER (WHERE status = 'paid')::int                       AS paid,
      COUNT(*) FILTER (WHERE status IN ('sent','draft'))::int            AS pending,
      COALESCE(SUM(subtotal) FILTER (WHERE status = 'paid'), 0)::float   AS paid_amount
    FROM client_invoices
  `);
  const activeSubs = await one(sql`
    SELECT COUNT(DISTINCT office_id)::int AS cnt
    FROM office_entitlements
    WHERE plan IS NOT NULL
  `);
  const usageCost = await one(sql`
    SELECT COALESCE(SUM(cost),0)::float AS total FROM usage_logs
  `);

  const totalRevenue  = rev?.total      ?? 0;
  const totalExpenses = exp?.total      ?? 0;
  const aiCost        = usageCost?.total ?? 0;
  const totalCost     = totalExpenses + aiCost;
  const profit        = totalRevenue - totalCost;
  const margin        = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const mRev = parseFloat(thisMonth?.revenue  ?? 0);
  const lRev = parseFloat(lastMonth?.revenue  ?? 0);
  const revGrowth = lRev > 0 ? ((mRev - lRev) / lRev) * 100 : 0;

  return {
    totalRevenue,
    totalExpenses: totalCost,
    profit,
    profitMargin:   Math.round(margin * 10) / 10,
    activeOffices:  activeSubs?.cnt ?? 0,
    thisMonthRevenue: mRev,
    lastMonthRevenue: lRev,
    revenueGrowth:  Math.round(revGrowth * 10) / 10,
    invoiceStats:   invoices ?? {},
    aiCost,
  };
}

/* ══════════════════════════════════════════════
   Monthly trend (last 6 months)
══════════════════════════════════════════════ */
async function getMonthlyTrend() {
  const revTrend = await rows(sql`
    SELECT
      TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS month,
      SUM(amount)::float AS revenue
    FROM revenues
    WHERE date >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY 1 ORDER BY 1
  `);
  const expTrend = await rows(sql`
    SELECT
      TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS month,
      SUM(amount)::float AS expenses
    FROM expenses
    WHERE date >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY 1 ORDER BY 1
  `);

  /* Merge by month */
  const map: Record<string, any> = {};
  for (const r of revTrend) map[r.month] = { month: r.month, revenue: r.revenue, expenses: 0 };
  for (const e of expTrend) {
    if (map[e.month]) map[e.month].expenses = e.expenses;
    else map[e.month] = { month: e.month, revenue: 0, expenses: e.expenses };
  }
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
}

/* ══════════════════════════════════════════════
   Revenue by category
══════════════════════════════════════════════ */
async function getRevenueByCategory() {
  return rows(sql`
    SELECT category, SUM(amount)::float AS total, COUNT(*)::int AS count
    FROM revenues
    GROUP BY category ORDER BY total DESC LIMIT 8
  `);
}

/* ══════════════════════════════════════════════
   Anomaly Detection
══════════════════════════════════════════════ */
async function detectAnomalies(kpis: any) {
  const issues: string[] = [];

  /* Expense spike: expenses > 80% of revenue */
  if (kpis.totalRevenue > 0 && kpis.totalExpenses / kpis.totalRevenue > 0.8)
    issues.push("expense_spike");

  /* Negative growth */
  if (kpis.revenueGrowth < -10)
    issues.push("revenue_decline");

  /* Low margin */
  if (kpis.profitMargin < 15 && kpis.totalRevenue > 0)
    issues.push("low_margin");

  /* High AI cost */
  if (kpis.aiCost > 500)
    issues.push("high_ai_cost");

  /* Unpaid invoices ratio */
  const pending = kpis.invoiceStats?.pending ?? 0;
  const totalInv = kpis.invoiceStats?.total   ?? 0;
  if (totalInv > 0 && pending / totalInv > 0.5)
    issues.push("high_pending_invoices");

  return {
    count:     issues.length,
    riskLevel: issues.length >= 3 ? "HIGH" : issues.length >= 1 ? "MEDIUM" : "LOW",
    issues,
  };
}

/* ══════════════════════════════════════════════
   Revenue Forecast (linear projection)
══════════════════════════════════════════════ */
function forecastRevenue(trend: any[], thisMonth: number) {
  if (trend.length < 2) {
    return { nextMonth: thisMonth * 1.08, threeMonths: thisMonth * 1.25, confidence: "low" };
  }
  const values = trend.map(t => t.revenue as number);
  const avg    = values.reduce((s, v) => s + v, 0) / values.length;
  const last   = values[values.length - 1];
  const growth = avg > 0 ? (last - avg) / avg : 0;
  const factor = 1 + Math.min(Math.max(growth, -0.2), 0.3); // cap ±20-30%
  return {
    nextMonth:   Math.round(last * factor),
    threeMonths: Math.round(last * Math.pow(factor, 3)),
    confidence:  trend.length >= 5 ? "high" : trend.length >= 3 ? "medium" : "low",
    growthRate:  Math.round(growth * 100 * 10) / 10,
  };
}

/* ══════════════════════════════════════════════
   AI Insights (Arabic, rule-based)
══════════════════════════════════════════════ */
function generateInsights(kpis: any, anomalies: any, forecast: any) {
  const insights: Array<{ type: string; level: string; text: string }> = [];

  /* Profitability */
  if (kpis.profit > 0) {
    insights.push({ type: "profit", level: "success",
      text: `النظام مربح — هامش الربح ${kpis.profitMargin}٪ من إجمالي الإيرادات` });
  } else if (kpis.totalRevenue === 0) {
    insights.push({ type: "profit", level: "warning",
      text: "لا توجد إيرادات مسجّلة بعد — ابدأ بإدخال إيراداتك أو إصدار الفواتير" });
  } else {
    insights.push({ type: "profit", level: "error",
      text: `النظام يعمل بخسارة (${Math.abs(kpis.profit).toLocaleString("ar-SA")} ر.س) — مراجعة المصروفات ضرورية` });
  }

  /* Growth */
  if (kpis.revenueGrowth > 15) {
    insights.push({ type: "growth", level: "success",
      text: `نمو قوي في الإيرادات هذا الشهر بنسبة ${kpis.revenueGrowth}٪ مقارنة بالشهر الماضي` });
  } else if (kpis.revenueGrowth < -10) {
    insights.push({ type: "growth", level: "warning",
      text: `تراجع في إيرادات هذا الشهر بنسبة ${Math.abs(kpis.revenueGrowth)}٪ — يُنصح بمراجعة مصادر الدخل` });
  }

  /* Invoices */
  const pending = kpis.invoiceStats?.pending ?? 0;
  if (pending > 0) {
    insights.push({ type: "invoices", level: "warning",
      text: `يوجد ${pending} فاتورة معلقة — متابعة السداد ترفع التدفق النقدي` });
  }

  /* AI cost */
  if (anomalies.issues.includes("high_ai_cost")) {
    insights.push({ type: "ai_cost", level: "warning",
      text: "تكاليف الذكاء الاصطناعي مرتفعة — فكّر في تحسين استخدام الطلبات" });
  }

  /* Forecast */
  if (forecast.nextMonth > kpis.thisMonthRevenue * 1.05) {
    insights.push({ type: "forecast", level: "info",
      text: `التوقع المالي إيجابي — إيرادات الشهر القادم المتوقعة: ${forecast.nextMonth.toLocaleString("ar-SA")} ر.س` });
  }

  /* Expense spike */
  if (anomalies.issues.includes("expense_spike")) {
    insights.push({ type: "expenses", level: "error",
      text: "المصروفات تتجاوز ٨٠٪ من الإيرادات — مراجعة عاجلة لبنود التكاليف" });
  }

  return insights;
}

/* ══════════════════════════════════════════════
   UNIFIED ENGINE
══════════════════════════════════════════════ */
export async function getUnifiedFinancialAI() {
  const [kpis, trend, categories] = await Promise.all([
    getKPIs(),
    getMonthlyTrend(),
    getRevenueByCategory(),
  ]);

  const anomalies = await detectAnomalies(kpis);
  const forecast  = forecastRevenue(trend, kpis.thisMonthRevenue);
  const insights  = generateInsights(kpis, anomalies, forecast);

  return {
    kpis,
    trend,
    categories,
    anomalies,
    forecast,
    aiInsights: insights,
    generatedAt: new Date().toISOString(),
  };
}
