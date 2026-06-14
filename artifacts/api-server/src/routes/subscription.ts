import { requireAuth } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, officePageTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

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

/* ─────────────────────────────────────────────────────
   GET /office/subscription
   Returns current office plan, feature flags, and limits.
   Used by the frontend to gate UI elements.
   During the 30-day Stripe trial → returns full access.
───────────────────────────────────────────────────── */
router.get("/office/subscription", requireAuth, async (_req, res) => {
  try {
    /* ── 1. Check Stripe for active trial ── */
    let isTrial = false;
    let trialEndsAt: number | null = null;
    let trialDaysLeft: number | null = null;

    try {
      const stripe = await getUncachableStripeClient();
      const subs = await stripe.subscriptions.list({ limit: 5, status: "trialing" });
      const trialing = subs.data[0];
      if (trialing) {
        isTrial = true;
        trialEndsAt = (trialing as any).trial_end ?? null;
        if (trialEndsAt) {
          const msLeft = trialEndsAt * 1000 - Date.now();
          trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        }
      }
    } catch { /* Stripe not configured — skip trial check */ }

    /* ── 2a. Check for active gift subscription ── */
    try {
      const giftRows = await db.execute(sql`
        SELECT gs.plan_slug, gs.end_date, gs.id
        FROM gift_subscriptions gs
        WHERE gs.status = 'active' AND gs.end_date > NOW()
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

    /* ── 2. If in trial → return full access immediately ── */
    if (isTrial) {
      const offices = await db.select().from(officePageTable).limit(1);
      const officePlan = offices[0]?.plan ?? "free";
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

    /* ── 3. Normal path: return plan from DB ── */
    const offices = await db.select().from(officePageTable).limit(1);
    const officePlan = offices[0]?.plan ?? "free";

    const plans = await db.select().from(plansTable)
      .where(eq(plansTable.slug, officePlan))
      .limit(1);
    const plan = plans[0];

    if (!plan) {
      return res.json({
        planSlug: "free",
        planName: "مجاني",
        planColor: "#64748B",
        featureFlags: {
          cases: true, invoices: true, reminders: true, calendar: true,
          exportPdf: true, aiBasic: true, reportsBasic: true,
          website: false, serviceStore: false, payments: false, contractsAi: false,
          mobileApp: false, ai: false, aiAnalytics: false, reportsAdvanced: false,
          ocr: false, backup: false, clientPortal: false, branches: false,
          whatsapp: false, workflow: false, customDomain: false,
          api: false, assistant: false, aiCfo: false, whiteLabel: false,
          sla: false, dedicatedManager: false, customAiTraining: false,
        },
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
    console.error("Error fetching office subscription:", err);
    res.status(500).json({ error: "خطأ في جلب بيانات الباقة" });
  }
});

/* ─────────────────────────────────────────────────────
   GET /office/plan-notifications
   Returns plan change notification history (last 20).
───────────────────────────────────────────────────── */
router.get("/office/plan-notifications", requireAuth, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, type, old_plan, new_plan, title, message, is_read, created_at
      FROM plan_notifications
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json(rows.rows ?? []);
  } catch (e: any) {
    console.error("[plan-notifications]", e);
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────
   PATCH /office/plan-notifications/read-all
   Mark all plan notifications as read.
───────────────────────────────────────────────────── */
router.patch("/office/plan-notifications/read-all", requireAuth, async (req, res) => {
  try {
    const auth = getAuth(req as any);
    if (!auth?.userId) { res.status(401).json({ error: "غير مصرح" }); return; }
    // Scope to requesting office's notifications only — never update ALL tenants
    const { resolveTenantId } = await import("../middlewares/tenantMiddleware");
    const officeId = await resolveTenantId(auth.userId, req.headers["x-tenant-id"] as string | undefined) ?? "default";
    await db.execute(sql`UPDATE plan_notifications SET is_read = TRUE WHERE office_id = ${officeId}`);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[plan-notifications/read-all]", e);
    res.status(500).json({ error: e.message, ok: false });
  }
});

export default router;
