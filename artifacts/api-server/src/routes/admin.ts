import { Router } from "express";
import { db } from "@workspace/db";
import {
  plansTable, discountCodesTable, aiApiKeysTable, platformSettingsTable,
  departmentsTable, jobTitlesTable, legalSystemsTable, supportTicketsTable,
  usersTable, usageLogsTable, officePageTable,
} from "@workspace/db/schema";
import { eq, desc, count, sum } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";

const router = Router();

/* ── Clerk Backend Client (lazy) ──────────────────── */
let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

/* ── Platform Owner / Super-Admin Guard ───────────── */
async function isSuperAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return false;

  try {
    const clerk = getClerk();
    const user = await clerk.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(
      (e: any) => e.id === user.primaryEmailAddressId
    )?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";

    const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    const isOwner = !!ownerEmail && primaryEmail === ownerEmail;
    const isRoleAdmin = user.publicMetadata?.role === "super_admin";
    return isOwner || isRoleAdmin;
  } catch {
    return false;
  }
}

async function adminOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req))) return res.status(403).json({ error: "غير مصرح" });
  next();
}

/* ══════════════════════════════════════════════════════
   OVERVIEW STATS
══════════════════════════════════════════════════════ */
router.get("/admin/stats", adminOnly, async (_req, res) => {
  const [totalOffices] = await db.select({ count: count() }).from(officePageTable);
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [totalTickets] = await db.select({ count: count() }).from(supportTicketsTable);
  const [openTickets] = await db.select({ count: count() }).from(supportTicketsTable).where(eq(supportTicketsTable.status, "open"));
  const [totalAiUsage] = await db.select({ total: sum(usageLogsTable.units) }).from(usageLogsTable);
  const [totalCost] = await db.select({ total: sum(usageLogsTable.cost) }).from(usageLogsTable);
  const [activePlans] = await db.select({ count: count() }).from(plansTable).where(eq(plansTable.isActive, true));

  res.json({
    totalOffices: totalOffices.count,
    totalUsers: totalUsers.count,
    totalTickets: totalTickets.count,
    openTickets: openTickets.count,
    totalAiUsage: totalAiUsage.total ?? 0,
    totalCost: totalCost.total ?? 0,
    activePlans: activePlans.count,
  });
});

/* ══════════════════════════════════════════════════════
   ALL OFFICES
══════════════════════════════════════════════════════ */
router.get("/admin/offices", adminOnly, async (_req, res) => {
  const offices = await db.select().from(officePageTable).orderBy(desc(officePageTable.createdAt));
  res.json(offices);
});

router.patch("/admin/offices/:id", adminOnly, async (req, res) => {
  const { id } = req.params;

  /* Detect plan change and log notification */
  if (req.body.plan) {
    try {
      const [before] = await db.select({ plan: officePageTable.plan }).from(officePageTable).where(eq(officePageTable.id, id));
      const oldPlan = before?.plan ?? "starter";
      const newPlan = req.body.plan;
      if (oldPlan !== newPlan) {
        const LABELS: Record<string, string> = { free: "مجاني", starter: "مبتدئ", professional: "احترافي", enterprise: "مؤسسي" };
        const isUpgrade = ["free","starter","professional","enterprise"].indexOf(newPlan) > ["free","starter","professional","enterprise"].indexOf(oldPlan);
        const title = isUpgrade ? `✅ تم ترقية باقتك إلى ${LABELS[newPlan] ?? newPlan}` : `⚠️ تم تعديل باقتك إلى ${LABELS[newPlan] ?? newPlan}`;
        const message = isUpgrade
          ? `تم ترقية اشتراك مكتبك من باقة "${LABELS[oldPlan] ?? oldPlan}" إلى باقة "${LABELS[newPlan] ?? newPlan}". الخدمات الجديدة متاحة الآن.`
          : `تم تغيير اشتراك مكتبك من باقة "${LABELS[oldPlan] ?? oldPlan}" إلى باقة "${LABELS[newPlan] ?? newPlan}". بعض الخدمات قد تكون غير متاحة.`;
        await db.execute(sql`
          INSERT INTO plan_notifications (id, type, old_plan, new_plan, title, message)
          VALUES (gen_random_uuid()::text, ${isUpgrade ? "upgrade" : "downgrade"}, ${oldPlan}, ${newPlan}, ${title}, ${message})
        `);
        /* Invalidate feature flag cache */
        const { invalidateFeatureCache } = await import("../middleware/feature-gate.js");
        invalidateFeatureCache();
      }
    } catch (e) {
      console.error("Plan notification error:", e);
    }
  }

  const updated = await db.update(officePageTable).set({ ...req.body }).where(eq(officePageTable.id, id)).returning();
  res.json(updated[0]);
});

/* ══════════════════════════════════════════════════════
   ALL USERS
══════════════════════════════════════════════════════ */
router.get("/admin/users", adminOnly, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users);
});

router.patch("/admin/users/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const updated = await db.update(usersTable).set(req.body).where(eq(usersTable.id, id)).returning();
  res.json(updated[0]);
});

/* ══════════════════════════════════════════════════════
   PLANS
══════════════════════════════════════════════════════ */
router.get("/admin/plans", adminOnly, async (_req, res) => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.displayOrder);
  res.json(plans);
});

router.post("/admin/plans", adminOnly, async (req, res) => {
  const plan = await db.insert(plansTable).values(req.body).returning();
  res.json(plan[0]);
});

router.patch("/admin/plans/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const updated = await db.update(plansTable).set({ ...req.body, updatedAt: new Date() }).where(eq(plansTable.id, id)).returning();
  res.json(updated[0]);
});

router.delete("/admin/plans/:id", adminOnly, async (req, res) => {
  await db.delete(plansTable).where(eq(plansTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   DISCOUNT CODES
══════════════════════════════════════════════════════ */
router.get("/admin/discounts", adminOnly, async (_req, res) => {
  const codes = await db.select().from(discountCodesTable).orderBy(desc(discountCodesTable.createdAt));
  res.json(codes);
});

router.post("/admin/discounts", adminOnly, async (req, res) => {
  const code = await db.insert(discountCodesTable).values(req.body).returning();
  res.json(code[0]);
});

router.patch("/admin/discounts/:id", adminOnly, async (req, res) => {
  const updated = await db.update(discountCodesTable).set(req.body).where(eq(discountCodesTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/admin/discounts/:id", adminOnly, async (req, res) => {
  await db.delete(discountCodesTable).where(eq(discountCodesTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   AI API KEYS
══════════════════════════════════════════════════════ */
router.get("/admin/ai-keys", adminOnly, async (_req, res) => {
  const keys = await db.select({
    id: aiApiKeysTable.id, provider: aiApiKeysTable.provider,
    keyLabel: aiApiKeysTable.keyLabel, keyMasked: aiApiKeysTable.keyMasked,
    isActive: aiApiKeysTable.isActive, usageCount: aiApiKeysTable.usageCount,
    totalCost: aiApiKeysTable.totalCost, lastUsedAt: aiApiKeysTable.lastUsedAt,
    createdAt: aiApiKeysTable.createdAt,
  }).from(aiApiKeysTable).orderBy(desc(aiApiKeysTable.createdAt));
  res.json(keys);
});

router.post("/admin/ai-keys", adminOnly, async (req, res) => {
  const { provider, keyLabel, keyValue } = req.body;
  const keyMasked = keyValue.slice(0, 8) + "..." + keyValue.slice(-4);
  const keyHash = Buffer.from(keyValue).toString("base64");
  const key = await db.insert(aiApiKeysTable).values({ provider, keyLabel, keyHash, keyMasked }).returning();
  res.json({ ...key[0], keyHash: undefined });
});

router.patch("/admin/ai-keys/:id", adminOnly, async (req, res) => {
  const { isActive } = req.body;
  const updated = await db.update(aiApiKeysTable).set({ isActive }).where(eq(aiApiKeysTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/admin/ai-keys/:id", adminOnly, async (req, res) => {
  await db.delete(aiApiKeysTable).where(eq(aiApiKeysTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   PLATFORM SETTINGS
══════════════════════════════════════════════════════ */
router.get("/admin/settings", adminOnly, async (_req, res) => {
  const settings = await db.select().from(platformSettingsTable).orderBy(platformSettingsTable.group, platformSettingsTable.key);
  res.json(settings);
});

router.put("/admin/settings/:key", adminOnly, async (req, res) => {
  const { key } = req.params;
  const upserted = await db.insert(platformSettingsTable)
    .values({ key, ...req.body, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: req.body.value, updatedAt: new Date() } })
    .returning();
  res.json(upserted[0]);
});

router.post("/admin/settings", adminOnly, async (req, res) => {
  const setting = await db.insert(platformSettingsTable)
    .values({ ...req.body, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: req.body.value, updatedAt: new Date() } })
    .returning();
  res.json(setting[0]);
});

/* ══════════════════════════════════════════════════════
   DEPARTMENTS
══════════════════════════════════════════════════════ */
router.get("/admin/departments", adminOnly, async (_req, res) => {
  const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.sortOrder);
  res.json(depts);
});

router.post("/admin/departments", adminOnly, async (req, res) => {
  const dept = await db.insert(departmentsTable).values(req.body).returning();
  res.json(dept[0]);
});

router.patch("/admin/departments/:id", adminOnly, async (req, res) => {
  const updated = await db.update(departmentsTable).set(req.body).where(eq(departmentsTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/admin/departments/:id", adminOnly, async (req, res) => {
  await db.delete(departmentsTable).where(eq(departmentsTable.id, req.params.id));
  res.json({ ok: true });
});

/* ── Job Titles ── */
router.get("/admin/job-titles", adminOnly, async (_req, res) => {
  const titles = await db.select().from(jobTitlesTable).orderBy(jobTitlesTable.name);
  res.json(titles);
});

router.post("/admin/job-titles", adminOnly, async (req, res) => {
  const title = await db.insert(jobTitlesTable).values(req.body).returning();
  res.json(title[0]);
});

router.delete("/admin/job-titles/:id", adminOnly, async (req, res) => {
  await db.delete(jobTitlesTable).where(eq(jobTitlesTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   LEGAL SYSTEMS & RULINGS
══════════════════════════════════════════════════════ */
router.get("/admin/legal-systems", adminOnly, async (_req, res) => {
  const items = await db.select().from(legalSystemsTable).orderBy(desc(legalSystemsTable.createdAt));
  res.json(items);
});

router.post("/admin/legal-systems", adminOnly, async (req, res) => {
  const item = await db.insert(legalSystemsTable).values(req.body).returning();
  res.json(item[0]);
});

router.patch("/admin/legal-systems/:id", adminOnly, async (req, res) => {
  const updated = await db.update(legalSystemsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(legalSystemsTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/admin/legal-systems/:id", adminOnly, async (req, res) => {
  await db.delete(legalSystemsTable).where(eq(legalSystemsTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   SUPPORT TICKETS
══════════════════════════════════════════════════════ */
router.get("/admin/support", adminOnly, async (_req, res) => {
  const tickets = await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.createdAt));
  res.json(tickets);
});

router.post("/admin/support", async (req, res) => {
  const ticket = await db.insert(supportTicketsTable).values(req.body).returning();
  res.json(ticket[0]);
});

router.patch("/admin/support/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const data: any = { ...req.body, updatedAt: new Date() };
  if (req.body.status === "resolved" && !data.resolvedAt) data.resolvedAt = new Date();
  const updated = await db.update(supportTicketsTable).set(data).where(eq(supportTicketsTable.id, id)).returning();
  res.json(updated[0]);
});

/* ══════════════════════════════════════════════════════
   USAGE LOGS
══════════════════════════════════════════════════════ */
router.get("/admin/usage", adminOnly, async (_req, res) => {
  const logs = await db.select().from(usageLogsTable).orderBy(desc(usageLogsTable.createdAt)).limit(500);
  const summary = await db.select({
    feature: usageLogsTable.feature,
    totalUnits: sum(usageLogsTable.units),
    totalCost: sum(usageLogsTable.cost),
    count: count(),
  }).from(usageLogsTable).groupBy(usageLogsTable.feature);
  res.json({ logs, summary });
});

export default router;
