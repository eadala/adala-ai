/**
 * Investor Metrics API
 * ────────────────────────────────────────────────────────────────
 * Super-admin only. Computes MRR, ARR, LTV, Churn, Growth, AI cost,
 * plan distribution, and monthly trend — all from existing DB tables.
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ── Plan price map (SAR/month) ─────────────────────────────────── */
const PLAN_PRICE: Record<string, number> = {
  free: 0, basic: 99, pro: 299, growth: 599,
  advanced: 999, enterprise: 2999, elite: 9999,
  /* legacy slugs */
  starter: 99, professional: 299, business: 599,
};

/* ── isSuperAdmin guard ─────────────────────────────────────────── */
function isSuperAdmin(req: any): boolean {
  try {
    const auth = getAuth(req);
    const meta = (auth as any)?.sessionClaims?.publicMetadata as any;
    if (meta?.role === "super_admin") return true;
    const allowed = (process.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map(s => s.trim());
    const email   = (auth as any)?.sessionClaims?.email as string ?? "";
    return allowed.includes(email);
  } catch { return false; }
}

/* ── Helper ─────────────────────────────────────────────────────── */
function toRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
function n(v: any): number { return Number(v ?? 0); }

/* ────────────────────────────────────────────────────────────────
   GET /admin/investor-metrics
   ──────────────────────────────────────────────────────────────── */
router.get("/admin/investor-metrics", async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "super_admin only" });
  try {
    const [officeRows, newPerMonth, aiRows, invoiceRows, aiTxRows] = await Promise.all([
      /* 1. All offices: plan + status + joined date */
      db.execute(sql`
        SELECT id, name, plan, status,
               joined_at::date AS joined
        FROM office_registry
        ORDER BY joined_at DESC
      `),
      /* 2. New offices per month (last 6 months) */
      db.execute(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', joined_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM office_registry
        WHERE joined_at >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month
      `),
      /* 3. AI credits (balance vs allowance per office) */
      db.execute(sql`
        SELECT office_id, monthly_allowance, balance
        FROM office_ai_credits
      `).catch(() => []),
      /* 4. Total collected revenue from client invoices */
      db.execute(sql`
        SELECT COALESCE(SUM(total), 0)::float AS total
        FROM client_invoices WHERE status = 'paid'
      `).catch(() => []),
      /* 5. AI transactions this month (usage cost) */
      db.execute(sql`
        SELECT COALESCE(SUM(amount), 0)::int AS used
        FROM ai_credit_transactions
        WHERE created_at >= DATE_TRUNC('month', NOW())
      `).catch(() => []),
    ]);

    const offices      = toRows(officeRows);
    const monthlyNew   = toRows(newPerMonth);
    const aiCredits    = toRows(aiRows);
    const invRow       = toRows(invoiceRows)[0] ?? {};
    const aiTxRow      = toRows(aiTxRows)[0] ?? {};

    /* ── Core counts ─────────────────────────────────────────── */
    const total    = offices.length;
    const active   = offices.filter((o: any) => o.status === "active").length;
    const inactive = offices.filter((o: any) => o.status !== "active").length;

    /* ── MRR: sum plan prices of ACTIVE offices ───────────────── */
    const mrr = offices
      .filter((o: any) => o.status === "active")
      .reduce((sum: number, o: any) => sum + (PLAN_PRICE[o.plan] ?? 0), 0);

    const arr = mrr * 12;

    /* ── Churn rate (inactive / total, as %) ─────────────────── */
    const churnRate = total > 0 ? Math.round((inactive / total) * 100) : 0;

    /* ── LTV = total revenue / total offices (simple model) ───── */
    const totalRevenue = n(invRow.total);
    const ltv = total > 0 ? Math.round(totalRevenue / total) : 0;

    /* ── Monthly growth trend ─────────────────────────────────── */
    const growthTrend = monthlyNew.map((r: any) => ({
      month: r.month,
      count: n(r.count),
    }));

    /* MoM growth % */
    let momGrowth = 0;
    if (growthTrend.length >= 2) {
      const last  = growthTrend[growthTrend.length - 1].count;
      const prev  = growthTrend[growthTrend.length - 2].count;
      momGrowth   = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
    }

    /* ── Plan distribution ────────────────────────────────────── */
    const planMap: Record<string, number> = {};
    for (const o of offices) {
      const p = (o as any).plan ?? "free";
      planMap[p] = (planMap[p] ?? 0) + 1;
    }
    const planDist = Object.entries(planMap)
      .map(([plan, count]) => ({ plan, count, price: PLAN_PRICE[plan] ?? 0 }))
      .sort((a, b) => b.price - a.price);

    /* ── AI usage this month ──────────────────────────────────── */
    const aiUsedCredits  = n(aiTxRow.used);
    const aiTotalAllowed = aiCredits.reduce((s: number, r: any) => s + n(r.monthly_allowance), 0);
    const aiCurrentBal   = aiCredits.reduce((s: number, r: any) => s + n(r.balance), 0);

    /* ── Recent offices ───────────────────────────────────────── */
    const recentOffices = offices.slice(0, 10).map((o: any) => ({
      id:     o.id,
      name:   o.name,
      plan:   o.plan,
      status: o.status,
      joined: o.joined,
      mrr:    PLAN_PRICE[o.plan] ?? 0,
    }));

    return res.json({
      /* top-line KPIs */
      mrr,
      arr,
      totalRevenue,
      ltv,
      churnRate,
      momGrowth,
      /* office counts */
      total,
      active,
      inactive,
      /* distribution */
      planDist,
      /* trend */
      growthTrend,
      /* AI */
      aiUsedCredits,
      aiTotalAllowed,
      aiCurrentBal,
      /* recent */
      recentOffices,
    });
  } catch (err: any) {
    console.error("[investor-metrics]", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
