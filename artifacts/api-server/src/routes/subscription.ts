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
    const officePlan = offices[0]?.plan ?? "starter";

    const plans = await db.select().from(plansTable)
      .where(eq(plansTable.slug, officePlan))
      .limit(1);
    const plan = plans[0];

    if (!plan) {
      return res.json({
        planSlug: officePlan,
        planName: officePlan,
        planColor: "#C9A84C",
        featureFlags: {
          website: true, serviceStore: true, payments: true, booking: true,
          blog: false, seo: false, clientPortal: false, ai: false,
          ocr: false, api: false, whatsapp: false, branches: false,
          workflow: false, sla: false, assistant: false,
          customDomain: false, calendar: true, advancedReports: false, whiteLabel: false,
        },
        limits: { maxUsers: 5, maxCases: 100, maxClients: 50, maxAiCalls: 500, maxStorageGb: 5, maxBranches: 0 },
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
  } catch {
    res.json([]);
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
  } catch {
    res.json({ ok: false });
  }
});

export default router;
