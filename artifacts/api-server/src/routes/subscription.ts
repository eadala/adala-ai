import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, officePageTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

/* ─────────────────────────────────────────────────────
   GET /office/subscription
   Returns current office plan, feature flags, and limits.
   Used by the frontend to gate UI elements.
───────────────────────────────────────────────────── */
router.get("/office/subscription", async (_req, res) => {
  try {
    const offices = await db.select().from(officePageTable).limit(1);
    const officePlan = offices[0]?.plan ?? "free";

    const plans = await db.select().from(plansTable)
      .where(eq(plansTable.slug, officePlan))
      .limit(1);
    const plan = plans[0];

    if (!plan) {
      // Default "free" plan flags when no matching plan row found in DB
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
router.get("/office/plan-notifications", async (_req, res) => {
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
router.patch("/office/plan-notifications/read-all", async (_req, res) => {
  try {
    await db.execute(sql`UPDATE plan_notifications SET is_read = TRUE`);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[plan-notifications/read-all]", e);
    res.status(500).json({ error: e.message, ok: false });
  }
});

export default router;
