import { Router } from "express";
import { db } from "@workspace/db";
import {
  plansTable, discountCodesTable, aiApiKeysTable, platformSettingsTable,
  departmentsTable, jobTitlesTable, legalSystemsTable, supportTicketsTable,
  officeRegistryTable, usersTable, usageLogsTable, officePageTable,
} from "@workspace/db/schema";
import { eq, desc, count, sum, sql } from "drizzle-orm";

const router = Router();

/* ── Super Admin Guard ─────────────────────────────── */
function isSuperAdmin(req: any): boolean {
  const email = req.auth?.sessionClaims?.email as string | undefined;
  const role = req.auth?.sessionClaims?.metadata?.role as string | undefined;
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  return role === "super_admin" || (superAdminEmails.length > 0 && !!email && superAdminEmails.includes(email));
}

function adminOnly(req: any, res: any, next: any) {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "غير مصرح" });
  next();
}

/* ══════════════════════════════════════════════════════
   OVERVIEW STATS
══════════════════════════════════════════════════════ */
router.get("/api/admin/stats", adminOnly, async (_req, res) => {
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
router.get("/api/admin/offices", adminOnly, async (_req, res) => {
  const offices = await db.select().from(officePageTable).orderBy(desc(officePageTable.createdAt));
  res.json(offices);
});

router.patch("/api/admin/offices/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const updated = await db.update(officePageTable).set({ ...req.body }).where(eq(officePageTable.id, id)).returning();
  res.json(updated[0]);
});

/* ══════════════════════════════════════════════════════
   ALL USERS
══════════════════════════════════════════════════════ */
router.get("/api/admin/users", adminOnly, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users);
});

router.patch("/api/admin/users/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const updated = await db.update(usersTable).set(req.body).where(eq(usersTable.id, id)).returning();
  res.json(updated[0]);
});

/* ══════════════════════════════════════════════════════
   PLANS
══════════════════════════════════════════════════════ */
router.get("/api/admin/plans", adminOnly, async (_req, res) => {
  const plans = await db.select().from(plansTable).orderBy(plansTable.displayOrder);
  res.json(plans);
});

router.post("/api/admin/plans", adminOnly, async (req, res) => {
  const plan = await db.insert(plansTable).values(req.body).returning();
  res.json(plan[0]);
});

router.patch("/api/admin/plans/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const updated = await db.update(plansTable).set({ ...req.body, updatedAt: new Date() }).where(eq(plansTable.id, id)).returning();
  res.json(updated[0]);
});

router.delete("/api/admin/plans/:id", adminOnly, async (req, res) => {
  await db.delete(plansTable).where(eq(plansTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   DISCOUNT CODES
══════════════════════════════════════════════════════ */
router.get("/api/admin/discounts", adminOnly, async (_req, res) => {
  const codes = await db.select().from(discountCodesTable).orderBy(desc(discountCodesTable.createdAt));
  res.json(codes);
});

router.post("/api/admin/discounts", adminOnly, async (req, res) => {
  const code = await db.insert(discountCodesTable).values(req.body).returning();
  res.json(code[0]);
});

router.patch("/api/admin/discounts/:id", adminOnly, async (req, res) => {
  const updated = await db.update(discountCodesTable).set(req.body).where(eq(discountCodesTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/api/admin/discounts/:id", adminOnly, async (req, res) => {
  await db.delete(discountCodesTable).where(eq(discountCodesTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   AI API KEYS
══════════════════════════════════════════════════════ */
router.get("/api/admin/ai-keys", adminOnly, async (_req, res) => {
  const keys = await db.select({
    id: aiApiKeysTable.id, provider: aiApiKeysTable.provider,
    keyLabel: aiApiKeysTable.keyLabel, keyMasked: aiApiKeysTable.keyMasked,
    isActive: aiApiKeysTable.isActive, usageCount: aiApiKeysTable.usageCount,
    totalCost: aiApiKeysTable.totalCost, lastUsedAt: aiApiKeysTable.lastUsedAt,
    createdAt: aiApiKeysTable.createdAt,
  }).from(aiApiKeysTable).orderBy(desc(aiApiKeysTable.createdAt));
  res.json(keys);
});

router.post("/api/admin/ai-keys", adminOnly, async (req, res) => {
  const { provider, keyLabel, keyValue } = req.body;
  const keyMasked = keyValue.slice(0, 8) + "..." + keyValue.slice(-4);
  const keyHash = Buffer.from(keyValue).toString("base64");
  const key = await db.insert(aiApiKeysTable).values({ provider, keyLabel, keyHash, keyMasked }).returning();
  res.json({ ...key[0], keyHash: undefined });
});

router.patch("/api/admin/ai-keys/:id", adminOnly, async (req, res) => {
  const { isActive } = req.body;
  const updated = await db.update(aiApiKeysTable).set({ isActive }).where(eq(aiApiKeysTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/api/admin/ai-keys/:id", adminOnly, async (req, res) => {
  await db.delete(aiApiKeysTable).where(eq(aiApiKeysTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   PLATFORM SETTINGS
══════════════════════════════════════════════════════ */
router.get("/api/admin/settings", adminOnly, async (_req, res) => {
  const settings = await db.select().from(platformSettingsTable).orderBy(platformSettingsTable.group, platformSettingsTable.key);
  res.json(settings);
});

router.put("/api/admin/settings/:key", adminOnly, async (req, res) => {
  const { key } = req.params;
  const upserted = await db.insert(platformSettingsTable)
    .values({ key, ...req.body, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: req.body.value, updatedAt: new Date() } })
    .returning();
  res.json(upserted[0]);
});

router.post("/api/admin/settings", adminOnly, async (req, res) => {
  const setting = await db.insert(platformSettingsTable)
    .values({ ...req.body, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: req.body.value, updatedAt: new Date() } })
    .returning();
  res.json(setting[0]);
});

/* ══════════════════════════════════════════════════════
   DEPARTMENTS
══════════════════════════════════════════════════════ */
router.get("/api/admin/departments", adminOnly, async (_req, res) => {
  const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.sortOrder);
  res.json(depts);
});

router.post("/api/admin/departments", adminOnly, async (req, res) => {
  const dept = await db.insert(departmentsTable).values(req.body).returning();
  res.json(dept[0]);
});

router.patch("/api/admin/departments/:id", adminOnly, async (req, res) => {
  const updated = await db.update(departmentsTable).set(req.body).where(eq(departmentsTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/api/admin/departments/:id", adminOnly, async (req, res) => {
  await db.delete(departmentsTable).where(eq(departmentsTable.id, req.params.id));
  res.json({ ok: true });
});

/* ── Job Titles ── */
router.get("/api/admin/job-titles", adminOnly, async (_req, res) => {
  const titles = await db.select().from(jobTitlesTable).orderBy(jobTitlesTable.name);
  res.json(titles);
});

router.post("/api/admin/job-titles", adminOnly, async (req, res) => {
  const title = await db.insert(jobTitlesTable).values(req.body).returning();
  res.json(title[0]);
});

router.delete("/api/admin/job-titles/:id", adminOnly, async (req, res) => {
  await db.delete(jobTitlesTable).where(eq(jobTitlesTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   LEGAL SYSTEMS & RULINGS
══════════════════════════════════════════════════════ */
router.get("/api/admin/legal-systems", adminOnly, async (_req, res) => {
  const items = await db.select().from(legalSystemsTable).orderBy(desc(legalSystemsTable.createdAt));
  res.json(items);
});

router.post("/api/admin/legal-systems", adminOnly, async (req, res) => {
  const item = await db.insert(legalSystemsTable).values(req.body).returning();
  res.json(item[0]);
});

router.patch("/api/admin/legal-systems/:id", adminOnly, async (req, res) => {
  const updated = await db.update(legalSystemsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(legalSystemsTable.id, req.params.id)).returning();
  res.json(updated[0]);
});

router.delete("/api/admin/legal-systems/:id", adminOnly, async (req, res) => {
  await db.delete(legalSystemsTable).where(eq(legalSystemsTable.id, req.params.id));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   SUPPORT TICKETS
══════════════════════════════════════════════════════ */
router.get("/api/admin/support", adminOnly, async (_req, res) => {
  const tickets = await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.createdAt));
  res.json(tickets);
});

router.post("/api/admin/support", async (req, res) => {
  const ticket = await db.insert(supportTicketsTable).values(req.body).returning();
  res.json(ticket[0]);
});

router.patch("/api/admin/support/:id", adminOnly, async (req, res) => {
  const { id } = req.params;
  const data: any = { ...req.body, updatedAt: new Date() };
  if (req.body.status === "resolved" && !data.resolvedAt) data.resolvedAt = new Date();
  const updated = await db.update(supportTicketsTable).set(data).where(eq(supportTicketsTable.id, id)).returning();
  res.json(updated[0]);
});

/* ══════════════════════════════════════════════════════
   USAGE LOGS
══════════════════════════════════════════════════════ */
router.get("/api/admin/usage", adminOnly, async (_req, res) => {
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
