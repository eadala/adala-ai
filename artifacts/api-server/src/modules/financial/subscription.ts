/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, officePageTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";

const router = Router();

function tenantIdOf(req: any): string | null {
  const tid = req?.tenantId as string | undefined;
  if (!tid || tid === "default" || tid === "platform" || tid === "unknown") return null;
  return tid;
}

/* ─────────────────────────────────────────────────────
   Full-access feature flags for the 30-day trial period.
   Every boolean feature is true; numeric limits are generous.
───────────────────────────────────────────────────── */
const TRIAL_FEATURE_FLAGS: Record<string, boolean> = {
  cases: true, invoices: true, reminders: true, calendar: true,
  exportPdf: true, aiBasic: true, reportsBasic: true,
  website: true, serviceStore: true, payments: true,
  contractsAi: true, mobileApp: true, documentTemplates: true,
  ai: true, aiAnalytics: true, reportsAdvanced: true, ocr: true, backup: true,
  clientPortal: true, branches: true, whatsapp: true, workflow: true,
  customDomain: true, apiAccess: true, aiCfo: true, whiteLabel: true,
  sla: true, dedicatedManager: true, customAiTraining: true, priorityInfrastructure: true,
  api: true, assistant: true,
};

const TRIAL_LIMITS = {
  maxUsers: 999, maxCases: 99999, maxClients: 99999,
  maxAiCalls: 9999, maxStorageGb: 1000, maxBranches: 99,
};

const FREE_FLAGS = {
  cases: true, invoices: true, reminders: true, calendar: true,
  exportPdf: true, aiBasic: true, reportsBasic: true,
  website: false, serviceStore: false, payments: false, contractsAi: false,
  mobileApp: false, ai: false, aiAnalytics: false, reportsAdvanced: false,
  ocr: false, backup: false, clientPortal: false, branches: false,
  whatsapp: false, workflow: false, customDomain: false,
  api: false, assistant: false, aiCfo: false, whiteLabel: false,
  sla: false, dedicatedManager: false, customAiTraining: false,
};

/* ─────────────────────────────────────────────────────
   GET /office/subscription
   Returns current office plan, feature flags, and limits.
───────────────────────────────────────────────────── */
router.get("/office/subscription", requireAuthWithTenant, async (req, res) => {
  try {
    const tid = tenantIdOf(req);
    if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });

    /* Ensure gift_subscriptions can be scoped by office */
    await db.execute(sql`ALTER TABLE gift_subscriptions ADD COLUMN IF NOT EXISTS office_id TEXT`).catch(() => {});

    /* ── 1. Check Stripe for active trial for THIS office ── */
    let isTrial = false;
    let trialEndsAt: number | null = null;
    let trialDaysLeft: number | null = null;

    try {
      const stripe = await getUncachableStripeClient();
      const subs = await stripe.subscriptions.list({ limit: 20, status: "trialing" });
      const trialing = subs.data.find(s => {
        const metaOffice = (s.metadata as any)?.officeId ?? (s.metadata as any)?.office_id;
        return metaOffice === tid;
      });
      if (trialing) {
        isTrial = true;
        trialEndsAt = (trialing as any).trial_end ?? null;
        if (trialEndsAt) {
          const msLeft = trialEndsAt * 1000 - Date.now();
          trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        }
      }
    } catch { /* Stripe not configured — skip trial check */ }

    /* ── 2a. Check for active gift subscription for THIS office ── */
    try {
      const giftRows = await db.execute(sql`
        SELECT gs.plan_slug, gs.end_date, gs.id
        FROM gift_subscriptions gs
        WHERE gs.status = 'active' AND gs.end_date > NOW()
          AND gs.office_id = ${tid}
        ORDER BY gs.end_date DESC LIMIT 1
      `);
      const gift = ((giftRows as any).rows ?? (giftRows as unknown as any[]))[0] ?? null;
      if (gift) {
        const giftPlanSlug = gift.plan_slug as string;
        const plans = await db.select().from(plansTable).where(eq(plansTable.slug, giftPlanSlug)).limit(1);
        const giftPlan = plans[0];
        const daysLeft = Math.max(0, Math.ceil((new Date(gift.end_date as string).getTime() - Date.now()) / 86400000));
        return res.json({
          planSlug:     giftPlan?.slug ?? giftPlanSlug,
          planName:     giftPlan?.name ?? giftPlanSlug,
          planColor:    giftPlan?.color ?? "#C9A84C",
          featureFlags: giftPlan ? ((giftPlan.featureFlags ?? {}) as Record<string, boolean>) : TRIAL_FEATURE_FLAGS,
          limits: giftPlan ? {
            maxUsers:     giftPlan.maxUsers,
            maxCases:     giftPlan.maxCases,
            maxClients:   giftPlan.maxClients ?? 50,
            maxAiCalls:   giftPlan.maxAiCalls,
            maxStorageGb: giftPlan.maxStorageGb ?? 5,
            maxBranches:  giftPlan.maxBranches ?? 0,
          } : TRIAL_LIMITS,
          isActive:   true,
          isTrial:    false,
          isGift:     true,
          giftEndsAt: gift.end_date,
          giftDaysLeft: daysLeft,
          trialEndsAt:  null,
          trialDaysLeft: null,
        });
      }
    } catch { /* gift table may not exist yet — skip */ }

    /* Resolve THIS office's plan from office_page */
    const offices = await db.select().from(officePageTable).where(eq(officePageTable.id, tid as any)).limit(1);
    const officePlan = offices[0]?.plan ?? "free";

    /* ── 2. If in trial → return full access for this office's plan shell ── */
    if (isTrial) {
      const plans = await db.select().from(plansTable).where(eq(plansTable.slug, officePlan)).limit(1);
      const plan = plans[0];
      return res.json({
        planSlug: plan?.slug ?? officePlan,
        planName: plan?.name ?? "مجاني",
        planColor: plan?.color ?? "#C9A84C",
        featureFlags: TRIAL_FEATURE_FLAGS,
        limits: TRIAL_LIMITS,
        isActive: true,
        isTrial: true,
        trialEndsAt,
        trialDaysLeft,
      });
    }

    /* ── 3. Normal path: return plan from DB for this office ── */
    const plans = await db.select().from(plansTable)
      .where(eq(plansTable.slug, officePlan))
      .limit(1);
    const plan = plans[0];

    if (!plan) {
      return res.json({
        planSlug: "free",
        planName: "مجاني",
        planColor: "#64748B",
        featureFlags: FREE_FLAGS,
        limits: { maxUsers: 1, maxCases: 5, maxClients: 10, maxAiCalls: 5, maxStorageGb: 1, maxBranches: 0 },
        isActive: true,
        isTrial: false,
        trialEndsAt: null,
        trialDaysLeft: null,
      });
    }

    return res.json({
      planSlug: plan.slug ?? officePlan,
      planName: plan.name,
      planColor: plan.color ?? "#C9A84C",
      featureFlags: (plan.featureFlags ?? {}) as Record<string, boolean>,
      limits: {
        maxUsers:     plan.maxUsers,
        maxCases:     plan.maxCases,
        maxClients:   plan.maxClients ?? 50,
        maxAiCalls:   plan.maxAiCalls,
        maxStorageGb: plan.maxStorageGb ?? 5,
        maxBranches:  plan.maxBranches ?? 0,
      },
      isActive: plan.isActive,
      isTrial: false,
      trialEndsAt: null,
      trialDaysLeft: null,
    });
  } catch (err) {
    res.status(500).json({ error: "خطأ في جلب بيانات الباقة" });
  }
});

/* ─────────────────────────────────────────────────────
   GET /office/plan-notifications
───────────────────────────────────────────────────── */
router.get("/office/plan-notifications", requireAuthWithTenant, async (req, res) => {
  try {
    const tid = tenantIdOf(req);
    if (!tid) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const rows = await db.execute(sql`
      SELECT id, type, old_plan, new_plan, title, message, is_read, created_at
      FROM plan_notifications
      WHERE office_id = ${tid}
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json((rows as any).rows ?? rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────
   PATCH /office/plan-notifications/read-all
───────────────────────────────────────────────────── */
router.patch("/office/plan-notifications/read-all", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = tenantIdOf(req);
    if (!officeId) { res.status(403).json({ error: "لا يمكن تحديد المكتب", ok: false }); return; }
    await db.execute(sql`UPDATE plan_notifications SET is_read = TRUE WHERE office_id = ${officeId}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message, ok: false });
  }
});

export default router;
