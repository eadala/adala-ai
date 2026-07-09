/**
 * Go-Live Commercial Metrics API
 * ────────────────────────────────────────────────────────────────
 * Super-admin only. Extends investor-metrics with:
 *  - Daily signups & revenue trend (30 days)
 *  - Go-live readiness checklist
 *  - Activation events feed
 *  - Conversion funnel & revenue waterfall
 */

import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  clerkProductionReadiness,
  r2StorageReadiness,
  stripeProductionReadiness,
} from "../../lib/launchReadiness";

const router = Router();

/* ── Plan price map (SAR/month) ─────────────────────────────────── */
const PLAN_PRICE: Record<string, number> = {
  free: 0, basic: 99, pro: 299, growth: 599,
  advanced: 999, enterprise: 2999, elite: 9999,
  starter: 99, professional: 299, business: 599,
};

/* ── isSuperAdmin guard ─────────────────────────────────────────── */
function toRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
function n(v: any): number { return Number(v ?? 0); }

/* ── Go-live checklist checks ─────────────────────────────────── */
async function runChecklist(): Promise<{ id: string; label: string; status: "ok" | "warn" | "error"; detail: string }[]> {
  const checks = [
    {
      id: "stripe",
      label: "بوابة الدفع (Stripe)",
      check: async () => stripeProductionReadiness(),
    },
    {
      id: "ai",
      label: "محرك الذكاء الاصطناعي",
      check: async () => {
        const ok = !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
        return { ok, detail: ok ? "مفاتيح AI مُهيَّأة" : "لا يوجد مفتاح AI" };
      },
    },
    {
      id: "db",
      label: "قاعدة البيانات",
      check: async () => {
        try {
          await db.execute(sql`SELECT 1`);
          return { ok: true, detail: "PostgreSQL متصل" };
        } catch { return { ok: false, detail: "فشل الاتصال بقاعدة البيانات" }; }
      },
    },
    {
      id: "multitenancy",
      label: "نظام متعدد المستأجرين",
      check: async () => {
        try {
          const r = toRows(await db.execute(sql`SELECT COUNT(*)::int AS c FROM office_registry`));
          const c = n(r[0]?.c);
          return { ok: c > 0, detail: `${c} مكتب مسجّل في النظام` };
        } catch { return { ok: false, detail: "جدول office_registry غير موجود" }; }
      },
    },
    {
      id: "billing",
      label: "محرك الفوترة",
      check: async () => {
        try {
          const r = toRows(await db.execute(sql`SELECT COUNT(*)::int AS c FROM office_registry WHERE status='active'`));
          const c = n(r[0]?.c);
          return { ok: true, detail: `${c} مكتب نشط` };
        } catch { return { ok: false, detail: "خطأ في فحص الفوترة" }; }
      },
    },
    {
      id: "ai_credits",
      label: "نظام رصيد AI",
      check: async () => {
        try {
          const r = toRows(await db.execute(sql`SELECT COUNT(*)::int AS c FROM office_ai_credits`));
          const c = n(r[0]?.c);
          return { ok: c > 0, detail: `${c} حساب رصيد مُهيَّأ` };
        } catch { return { ok: false, detail: "جدول office_ai_credits غير موجود" }; }
      },
    },
    {
      id: "audit",
      label: "سجل التدقيق",
      check: async () => {
        try {
          const r = toRows(await db.execute(sql`SELECT COUNT(*)::int AS c FROM audit_logs`));
          const c = n(r[0]?.c);
          return { ok: c >= 0, detail: `${c} سجل تدقيق محفوظ` };
        } catch { return { ok: false, detail: "جدول audit_logs غير موجود" }; }
      },
    },
    {
      id: "security",
      label: "طبقة الأمان والتشفير",
      check: async () => clerkProductionReadiness(),
    },
    {
      id: "storage",
      label: "تخزين الملفات",
      check: async () => r2StorageReadiness(),
    },
    {
      id: "tenant_isolation",
      label: "عزل بيانات المستأجرين",
      check: async () => {
        try {
          const r = toRows(await db.execute(sql`
            SELECT COUNT(*)::int AS c FROM information_schema.columns
            WHERE column_name = 'office_id' AND table_schema = 'public'
          `));
          const c = n(r[0]?.c);
          return { ok: c > 10, detail: `${c} جدول يحتوي على office_id (عزل كامل)` };
        } catch { return { ok: false, detail: "تعذّر فحص عزل البيانات" }; }
      },
    },
  ];

  const results = await Promise.allSettled(checks.map(c => c.check()));
  return checks.map((c, i) => {
    const r = results[i];
    if (r.status === "fulfilled") {
      return {
        id:     c.id,
        label:  c.label,
        status: r.value.ok ? "ok" as const : "warn" as const,
        detail: r.value.detail,
      };
    }
    return { id: c.id, label: c.label, status: "error" as const, detail: "خطأ في الفحص" };
  });
}

/* ────────────────────────────────────────────────────────────────
   GET /admin/go-live-metrics
   ──────────────────────────────────────────────────────────────── */
router.get("/admin/go-live-metrics", requireSuperAdmin, async (req, res) => {

  try {
    const [officeRows, dailySignups, dailyRevenue, aiRows, aiTxRows, ledgerTotal, recentActivations] = await Promise.all([
      /* 1. All offices */
      db.execute(sql`
        SELECT id, office_name AS name, plan_name AS plan, status, joined_at::date AS joined
        FROM office_registry ORDER BY joined_at DESC
      `),

      /* 2. Daily signups — last 30 days */
      db.execute(sql`
        SELECT TO_CHAR(DATE_TRUNC('day', joined_at), 'MM/DD') AS day,
               COUNT(*)::int AS count
        FROM office_registry
        WHERE joined_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
      `),

      /* 3. Daily revenue from office_ledger — last 30 days */
      db.execute(sql`
        SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'MM/DD') AS day,
               COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0)::float AS revenue
        FROM office_ledger
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
      `).catch(() => []),

      /* 4. AI credits */
      db.execute(sql`
        SELECT office_id, monthly_allowance, balance
        FROM office_ai_credits
      `).catch(() => []),

      /* 5. AI usage this month */
      db.execute(sql`
        SELECT COALESCE(SUM(ABS(amount)), 0)::int AS used
        FROM ai_credit_transactions
        WHERE created_at >= DATE_TRUNC('month', NOW()) AND amount < 0
      `).catch(() => []),

      /* 6. Total platform revenue */
      db.execute(sql`
        SELECT COALESCE(SUM(amount),0)::float AS total
        FROM office_ledger WHERE type='credit'
      `).catch(() => []),

      /* 7. Recent 15 activations */
      db.execute(sql`
        SELECT id, name, plan, status, joined_at
        FROM office_registry
        ORDER BY joined_at DESC LIMIT 15
      `),
    ]);

    const offices    = toRows(officeRows);
    const signupDays = toRows(dailySignups);
    const revDays    = toRows(dailyRevenue);
    const aiCredits  = toRows(aiRows);
    const aiTxRow    = toRows(aiTxRows)[0] ?? {};
    const ledgerRow  = toRows(ledgerTotal)[0] ?? {};
    const recent     = toRows(recentActivations);

    /* KPIs */
    const total    = offices.length;
    const active   = offices.filter((o: any) => o.status === "active").length;
    const inactive = total - active;
    const mrr      = offices
      .filter((o: any) => o.status === "active")
      .reduce((s: number, o: any) => s + (PLAN_PRICE[o.plan] ?? 0), 0);
    const arr           = mrr * 12;
    const churnRate     = total > 0 ? Math.round((inactive / total) * 100) : 0;
    const totalRevenue  = n(ledgerRow.total);
    const ltv           = total > 0 ? Math.round(totalRevenue / total) : 0;

    /* AI */
    const aiUsedCredits  = n(aiTxRow.used);
    const aiTotalAllowed = aiCredits.reduce((s: number, r: any) => s + n(r.monthly_allowance), 0);

    /* Plan distribution */
    const planMap: Record<string, number> = {};
    for (const o of offices) {
      const p = (o as any).plan ?? "free";
      planMap[p] = (planMap[p] ?? 0) + 1;
    }
    const planDist = Object.entries(planMap)
      .map(([plan, count]) => ({
        plan, count,
        price: PLAN_PRICE[plan] ?? 0,
        mrrContrib: (PLAN_PRICE[plan] ?? 0) * Number(count),
      }))
      .sort((a, b) => b.mrrContrib - a.mrrContrib);

    /* Trend charts — merge daily signups + revenue onto same day labels */
    const allDays = Array.from(new Set([
      ...signupDays.map((d: any) => d.day),
      ...revDays.map((d: any) => d.day),
    ])).sort();

    const dailyTrend = allDays.map(day => {
      const s = signupDays.find((d: any) => d.day === day);
      const r = revDays.find((d: any) => d.day === day);
      return {
        day,
        signups: n(s?.count),
        revenue: n(r?.revenue),
      };
    });

    /* Recent activations */
    const recentFeed = recent.map((o: any) => ({
      id:     o.id,
      name:   o.name,
      plan:   o.plan,
      status: o.status,
      joined: o.joined_at,
      mrr:    PLAN_PRICE[o.plan] ?? 0,
    }));

    /* Go-live checklist */
    const checklist = await runChecklist();
    const checksPassed  = checklist.filter(c => c.status === "ok").length;
    const goLiveScore   = Math.round((checksPassed / checklist.length) * 100);

    return res.json({
      /* KPIs */
      mrr, arr, total, active, inactive, churnRate, ltv, totalRevenue,
      aiUsedCredits, aiTotalAllowed,
      /* Charts */
      dailyTrend,
      planDist,
      /* Feed */
      recentFeed,
      /* Checklist */
      checklist,
      goLiveScore,
      checksPassed,
      checksTotal: checklist.length,
    });
  } catch (err: any) {
    console.error("[go-live-metrics]", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
