import { Router } from "express";
import { db } from "@workspace/db";
import {
  plansTable, discountCodesTable, aiApiKeysTable, platformSettingsTable,
  departmentsTable, jobTitlesTable, legalSystemsTable, supportTicketsTable, supportMessagesTable,
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
/* ── Public mobile-status check (no auth) ── */
router.get("/mobile-status", async (_req, res) => {
  try {
    const rows = await db.select().from(platformSettingsTable).where(sql`key = 'mobile_app_enabled'`);
    const val = rows[0]?.value;
    res.json({ enabled: val !== "false" });
  } catch {
    res.json({ enabled: true });
  }
});

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

router.get("/admin/support/:id/messages", adminOnly, async (req, res) => {
  try {
    const messages = await db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.ticketId, req.params.id))
      .orderBy(supportMessagesTable.createdAt);
    res.json(messages);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/admin/support/:id/reply", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { message = "" } = req.body;
    if (!message.trim()) return res.status(400).json({ error: "الرسالة مطلوبة" });
    const [msg] = await db.insert(supportMessagesTable).values({
      ticketId: id, senderType: "admin", senderName: "فريق الدعم",  message,
    }).returning();
    await db.update(supportTicketsTable)
      .set({ response: message, status: "in_progress", updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, id));
    res.json(msg);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
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

/* ══════════════════════════════════════════════════════
   ENHANCED PLATFORM STATS (cases, contracts, revenue)
══════════════════════════════════════════════════════ */
router.get("/admin/enhanced-stats", adminOnly, async (_req, res) => {
  try {
    const ex = async (q: any) => {
      const r = await db.execute(q) as any;
      return (Array.isArray(r) ? r[0] : r?.rows?.[0]) ?? {};
    };
    const exAll = async (q: any) => {
      const r = await db.execute(q) as any;
      return Array.isArray(r) ? r : (r?.rows ?? []);
    };

    const year = new Date().getFullYear();
    const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);

    const [totalCases, openCases, closedCases,
           totalContracts, signedContracts,
           totalRevenue, monthlyRevenue, overdueInvoices,
           totalExpenses] = await Promise.all([
      ex(sql`SELECT COUNT(*) AS cnt FROM cases`),
      ex(sql`SELECT COUNT(*) AS cnt FROM cases WHERE status='open'`),
      ex(sql`SELECT COUNT(*) AS cnt FROM cases WHERE status='closed'`),
      ex(sql`SELECT COUNT(*) AS cnt FROM contracts`),
      ex(sql`SELECT COUNT(*) AS cnt FROM contracts WHERE status='signed'`),
      ex(sql`SELECT COALESCE(SUM(amount),0) AS total FROM revenues`),
      ex(sql`SELECT COALESCE(SUM(total),0) AS total FROM client_invoices WHERE status='paid' AND created_at >= ${thisMonth.toISOString()}::timestamp`),
      ex(sql`SELECT COUNT(*) AS cnt FROM client_invoices WHERE status IN ('overdue','sent') AND due_date < NOW()`),
      ex(sql`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`),
    ]);

    // Monthly revenue for current year (bar chart)
    const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const monthlyChart = await Promise.all(MONTHS.map(async (name, idx) => {
      const m = String(idx + 1).padStart(2, "0");
      const from = `${year}-${m}-01`;
      const [rv, inv] = await Promise.all([
        ex(sql`SELECT COALESCE(SUM(amount),0) AS v FROM revenues WHERE date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
        ex(sql`SELECT COALESCE(SUM(total),0) AS v FROM client_invoices WHERE status='paid' AND created_at >= ${from}::timestamp AND created_at < ${from}::timestamp + interval '1 month'`),
      ]);
      return { month: name, revenue: parseFloat(String(rv.v||0)) + parseFloat(String(inv.v||0)) };
    }));

    // Recent activity
    const recentActivity = await exAll(sql`
      SELECT 'case' AS type, title AS label, status, created_at FROM cases
      UNION ALL
      SELECT 'contract' AS type, title AS label, status, created_at FROM contracts
      ORDER BY created_at DESC LIMIT 10
    `);

    res.json({
      cases: { total: Number(totalCases.cnt||0), open: Number(openCases.cnt||0), closed: Number(closedCases.cnt||0) },
      contracts: { total: Number(totalContracts.cnt||0), signed: Number(signedContracts.cnt||0) },
      revenue: { total: parseFloat(String(totalRevenue.total||0)), monthly: parseFloat(String(monthlyRevenue.total||0)) },
      expenses: parseFloat(String(totalExpenses.total||0)),
      overdueInvoices: Number(overdueInvoices.cnt||0),
      monthlyChart,
      recentActivity,
    });
  } catch (e: any) {
    console.error("enhanced-stats:", e);
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   PLATFORM CASES
══════════════════════════════════════════════════════ */
router.get("/admin/cases", adminOnly, async (req, res) => {
  try {
    const { status, search } = req.query as any;
    const exAll = async (q: any) => { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); };

    let rows = await exAll(sql`
      SELECT id, title, case_type, status, client_name, assigned_to, created_at
      FROM cases ORDER BY created_at DESC LIMIT 500
    `);
    if (status && status !== "all") rows = rows.filter((r: any) => r.status === status);
    if (search) rows = rows.filter((r: any) => r.title?.includes(search) || r.client_name?.includes(search));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   PLATFORM CONTRACTS
══════════════════════════════════════════════════════ */
router.get("/admin/contracts", adminOnly, async (req, res) => {
  try {
    const { status, search } = req.query as any;
    const exAll = async (q: any) => { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); };

    let rows = await exAll(sql`
      SELECT id, title, type, status, ai_generated, risk_score, signed_at, created_at
      FROM contracts ORDER BY created_at DESC LIMIT 500
    `);
    if (status && status !== "all") rows = rows.filter((r: any) => r.status === status);
    if (search) rows = rows.filter((r: any) => r.title?.includes(search));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   PLATFORM FINANCE STATS
══════════════════════════════════════════════════════ */
router.get("/admin/finance-stats", adminOnly, async (req, res) => {
  try {
    const ex = async (q: any) => { const r = await db.execute(q) as any; return (Array.isArray(r) ? r[0] : r?.rows?.[0]) ?? {}; };
    const exAll = async (q: any) => { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); };
    const n = (v: any) => parseFloat(String(v ?? 0)) || 0;

    const [revRow, invRow, expRow, paidInv, overdueInv, pendingInv] = await Promise.all([
      ex(sql`SELECT COALESCE(SUM(amount),0) AS total FROM revenues`),
      ex(sql`SELECT COALESCE(SUM(total),0) AS total FROM client_invoices WHERE status='paid'`),
      ex(sql`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`),
      ex(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amt FROM client_invoices WHERE status='paid'`),
      ex(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amt FROM client_invoices WHERE status='overdue' OR (status='sent' AND due_date < NOW())`),
      ex(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS amt FROM client_invoices WHERE status='sent' AND (due_date IS NULL OR due_date >= NOW())`),
    ]);

    // Monthly breakdown last 6 months
    const monthly = await Promise.all(Array.from({length: 6}, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); d.setDate(1);
      const from = d.toISOString().split("T")[0];
      const name = d.toLocaleDateString("ar-SA", { month: "short" });
      return Promise.all([
        ex(sql`SELECT COALESCE(SUM(amount),0) AS v FROM revenues WHERE date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
        ex(sql`SELECT COALESCE(SUM(total),0) AS v FROM client_invoices WHERE status='paid' AND created_at >= ${from}::timestamp AND created_at < ${from}::timestamp + interval '1 month'`),
        ex(sql`SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE date >= ${from}::date AND date < ${from}::date + interval '1 month'`),
      ]).then(([r, inv, exp]) => ({ month: name, revenue: n(r.v)+n(inv.v), expenses: n(exp.v) }));
    }));

    // Top expense categories
    const expCats = await exAll(sql`SELECT category, COALESCE(SUM(amount),0) AS total FROM expenses GROUP BY category ORDER BY total DESC LIMIT 6`);

    // Recent invoices
    const recentInvoices = await exAll(sql`SELECT id, invoice_number, total, status, due_date, created_at FROM client_invoices ORDER BY created_at DESC LIMIT 10`);

    res.json({
      kpi: {
        totalRevenue: n(revRow.total) + n(invRow.total),
        totalExpenses: n(expRow.total),
        netProfit: n(revRow.total) + n(invRow.total) - n(expRow.total),
        paidInvoices: { count: Number(paidInv.cnt||0), amount: n(paidInv.amt) },
        overdueInvoices: { count: Number(overdueInv.cnt||0), amount: n(overdueInv.amt) },
        pendingInvoices: { count: Number(pendingInv.cnt||0), amount: n(pendingInv.amt) },
      },
      monthly,
      expenseCategories: expCats.map((r: any) => ({ name: r.category||"أخرى", value: n(r.total) })),
      recentInvoices,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   SECURITY / AUDIT LOGS
══════════════════════════════════════════════════════ */
router.get("/admin/audit-logs", adminOnly, async (req, res) => {
  try {
    const { type = "all", limit = "100" } = req.query as any;
    const exAll = async (q: any) => { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); };

    const [auditRows, loginRows] = await Promise.all([
      exAll(sql`SELECT id, user_id, user_full_name, action, resource, resource_id, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 200`),
      exAll(sql`SELECT id, user_id, email, full_name, ip_address, browser, os, device_type, status, created_at FROM login_logs ORDER BY created_at DESC LIMIT 200`),
    ]);

    const loginStats = await exAll(sql`
      SELECT status, COUNT(*) AS cnt FROM login_logs GROUP BY status
    `);

    res.json({ auditLogs: auditRows, loginLogs: loginRows, loginStats });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   WEBSITE CMS
══════════════════════════════════════════════════════ */
router.get("/admin/website", adminOnly, async (_req, res) => {
  try {
    const exAll = async (q: any) => { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); };
    const rows = await exAll(sql`SELECT key, value FROM platform_settings WHERE key LIKE 'website_%' ORDER BY key`);
    const map: Record<string, any> = {};
    rows.forEach((r: any) => { map[r.key] = r.value; });
    res.json(map);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/admin/website", adminOnly, async (req, res) => {
  try {
    const entries = Object.entries(req.body) as [string, any][];
    for (const [key, value] of entries) {
      const wKey = key.startsWith("website_") ? key : `website_${key}`;
      await db.execute(sql`
        INSERT INTO platform_settings (key, value, updated_at) VALUES (${wKey}, ${String(value)}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${String(value)}, updated_at = NOW()
      `);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   PLATFORM SAAS BILLING OVERVIEW
══════════════════════════════════════════════════════ */
router.get("/admin/billing/overview", adminOnly, async (_req, res) => {
  try {
    const stats = await db.execute(sql`
      SELECT
        COUNT(*)::int                                           AS total_invoices,
        COUNT(*) FILTER (WHERE status = 'paid')::int           AS paid_count,
        COUNT(*) FILTER (WHERE status = 'unpaid')::int         AS unpaid_count,
        COUNT(*) FILTER (WHERE status = 'overdue')::int        AS overdue_count,
        COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)   AS total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE status='unpaid'),0) AS pending_revenue,
        COALESCE(SUM(amount) FILTER (WHERE status='overdue'),0) AS overdue_revenue
      FROM platform_billing_invoices
    `);

    const byPlan = await db.execute(sql`
      SELECT plan_id, plan_name,
             COUNT(*)::int                                      AS invoice_count,
             COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) AS revenue,
             COUNT(*) FILTER (WHERE status='paid')::int        AS paid_count,
             COUNT(*) FILTER (WHERE status='unpaid')::int      AS unpaid_count
      FROM platform_billing_invoices
      GROUP BY plan_id, plan_name
      ORDER BY revenue DESC
    `);

    const monthly = await db.execute(sql`
      SELECT TO_CHAR(issue_date,'YYYY-MM') AS month,
             COALESCE(SUM(amount) FILTER (WHERE status='paid'),0) AS revenue,
             COUNT(*)::int AS invoices
      FROM platform_billing_invoices
      WHERE issue_date >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(issue_date,'YYYY-MM')
      ORDER BY month ASC
    `);

    const recent = await db.execute(sql`
      SELECT id, plan_id, plan_name, amount, currency, status, issue_date, due_date, paid_at
      FROM platform_billing_invoices
      ORDER BY created_at DESC
      LIMIT 15
    `);

    const statsRow = ((stats as any)?.rows ?? [])[0] ?? {};
    res.json({
      total_invoices:  parseInt(statsRow.total_invoices  ?? 0),
      paid_count:      parseInt(statsRow.paid_count      ?? 0),
      unpaid_count:    parseInt(statsRow.unpaid_count    ?? 0),
      overdue_count:   parseInt(statsRow.overdue_count   ?? 0),
      total_revenue:   parseFloat(statsRow.total_revenue   ?? 0),
      pending_revenue: parseFloat(statsRow.pending_revenue ?? 0),
      overdue_revenue: parseFloat(statsRow.overdue_revenue ?? 0),
      by_plan: (byPlan  as any)?.rows ?? [],
      monthly: (monthly as any)?.rows ?? [],
      recent:  (recent  as any)?.rows ?? [],
    });
  } catch (e: any) {
    console.error("[admin/billing/overview]", e);
    res.status(500).json({ error: e.message });
  }
});

/* ── تسديد فاتورة من لوحة الإدارة ──────────────────── */
router.post("/admin/billing/pay/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`
      UPDATE platform_billing_invoices
      SET status = 'paid', paid_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   MULTI-TENANT GLOBAL DASHBOARD
   —————————————————————————————————————————————————————————————————
   All endpoints below are super-admin only.
   They aggregate across ALL tenants (law offices).
══════════════════════════════════════════════════════════════════ */

/* ── GET /api/admin/tenants — list all offices + plan + revenue ── */
router.get("/admin/tenants", adminOnly, async (_req, res) => {
  try {
    const tenants = await db.execute(sql`
      SELECT
        op.id::text              AS id,
        op.name                  AS name,
        op.email                 AS email,
        op.plan                  AS plan,
        op.stripe_customer_id    AS stripe_customer_id,
        op.created_at            AS created_at,
        COALESCE(m.member_count, 0)::int AS member_count,
        COALESCE(l.gross_total, 0)::numeric AS gross_total,
        COALESCE(l.net_total,   0)::numeric AS net_total,
        COALESCE(l.stripe_fee_total, 0)::numeric AS stripe_fee_total,
        COALESCE(l.platform_fee_total, 0)::numeric AS platform_fee_total,
        COALESCE(l.tx_count, 0)::int AS tx_count
      FROM office_page op
      LEFT JOIN (
        SELECT office_id, COUNT(*) AS member_count
        FROM office_members WHERE status = 'active'
        GROUP BY office_id
      ) m ON m.office_id = op.id::text
      LEFT JOIN (
        SELECT
          office_id,
          SUM(amount)       AS gross_total,
          SUM(net_amount)   AS net_total,
          SUM(stripe_fee)   AS stripe_fee_total,
          SUM(platform_fee) AS platform_fee_total,
          COUNT(*)          AS tx_count
        FROM office_ledger WHERE type = 'credit'
        GROUP BY office_id
      ) l ON l.office_id = op.id::text
      ORDER BY op.created_at DESC
    `);

    const rows = (tenants as any)?.rows ?? [];
    return res.json({
      total: rows.length,
      tenants: rows.map((r: any) => ({
        id:               r.id,
        name:             r.name,
        email:            r.email,
        plan:             r.plan ?? "free",
        stripeCustomerId: r.stripe_customer_id,
        createdAt:        r.created_at,
        memberCount:      Number(r.member_count),
        revenue: {
          gross:       parseFloat(r.gross_total ?? "0"),
          net:         parseFloat(r.net_total ?? "0"),
          stripeFee:   parseFloat(r.stripe_fee_total ?? "0"),
          platformFee: parseFloat(r.platform_fee_total ?? "0"),
          transactions: Number(r.tx_count),
        },
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/admin/tenants/revenue — global revenue breakdown ── */
router.get("/admin/tenants/revenue", adminOnly, async (_req, res) => {
  try {
    /* Platform-wide totals */
    const totals = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount),0)::numeric       AS gross,
        COALESCE(SUM(platform_fee),0)::numeric AS platform_fee,
        COALESCE(SUM(stripe_fee),0)::numeric   AS stripe_fee,
        COALESCE(SUM(net_amount),0)::numeric   AS net,
        COUNT(*)::int                          AS transactions,
        COUNT(DISTINCT office_id)::int         AS paying_offices
      FROM office_ledger WHERE type = 'credit'
    `);
    const t = ((totals as any)?.rows ?? [])[0] ?? {};

    /* Top 10 tenants by revenue */
    const topTenants = await db.execute(sql`
      SELECT
        l.office_id,
        op.name,
        op.plan,
        SUM(l.amount)::numeric       AS gross,
        SUM(l.net_amount)::numeric   AS net,
        COUNT(*)::int                AS transactions
      FROM office_ledger l
      LEFT JOIN office_page op ON op.id::text = l.office_id
      WHERE l.type = 'credit'
      GROUP BY l.office_id, op.name, op.plan
      ORDER BY gross DESC
      LIMIT 10
    `);

    /* Monthly trend (last 12 months) across all tenants */
    const monthly = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM')     AS month,
        SUM(amount)::numeric               AS gross,
        SUM(platform_fee)::numeric         AS platform_fee,
        SUM(stripe_fee)::numeric           AS stripe_fee,
        SUM(net_amount)::numeric           AS net,
        COUNT(*)::int                      AS transactions,
        COUNT(DISTINCT office_id)::int     AS active_offices
      FROM office_ledger
      WHERE type = 'credit'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    /* Plan distribution */
    const planDist = await db.execute(sql`
      SELECT plan, COUNT(*)::int AS count
      FROM office_page
      GROUP BY plan ORDER BY count DESC
    `);

    return res.json({
      totals: {
        gross:          parseFloat(t.gross ?? "0"),
        platformFee:    parseFloat(t.platform_fee ?? "0"),
        stripeFee:      parseFloat(t.stripe_fee ?? "0"),
        net:            parseFloat(t.net ?? "0"),
        transactions:   Number(t.transactions ?? 0),
        payingOffices:  Number(t.paying_offices ?? 0),
      },
      topTenants: ((topTenants as any)?.rows ?? []).map((r: any) => ({
        officeId:     r.office_id,
        name:         r.name ?? r.office_id,
        plan:         r.plan ?? "free",
        gross:        parseFloat(r.gross),
        net:          parseFloat(r.net),
        transactions: Number(r.transactions),
      })),
      monthly: ((monthly as any)?.rows ?? []).map((r: any) => ({
        month:         r.month,
        gross:         parseFloat(r.gross),
        platformFee:   parseFloat(r.platform_fee),
        stripeFee:     parseFloat(r.stripe_fee),
        net:           parseFloat(r.net),
        transactions:  Number(r.transactions),
        activeOffices: Number(r.active_offices),
      })),
      planDistribution: ((planDist as any)?.rows ?? []),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/admin/tenants/:id — single tenant detail ── */
router.get("/admin/tenants/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const office = await db.execute(sql`
      SELECT id::text, name, email, plan, stripe_customer_id, domain,
             owner_user_id, created_at, updated_at
      FROM office_page WHERE id::text = ${id} LIMIT 1
    `);
    const officeRow = ((office as any)?.rows ?? [])[0];
    if (!officeRow) return res.status(404).json({ error: "المكتب غير موجود" });

    const members = await db.execute(sql`
      SELECT om.user_id, om.role, om.status, om.created_at,
             u.email, u.full_name
      FROM office_members om
      LEFT JOIN users u ON u.id = om.user_id
      WHERE om.office_id = ${id}
      ORDER BY om.created_at ASC
    `);

    const entitlements = await db.execute(sql`
      SELECT key, plan, "limit", used FROM office_entitlements
      WHERE office_id = ${id} ORDER BY key
    `);

    const ledger = await db.execute(sql`
      SELECT amount, platform_fee, stripe_fee, net_amount, ref, created_at
      FROM office_ledger WHERE office_id = ${id} AND type='credit'
      ORDER BY created_at DESC LIMIT 10
    `);

    return res.json({
      office:       officeRow,
      members:      (members as any)?.rows ?? [],
      entitlements: (entitlements as any)?.rows ?? [],
      recentLedger: (ledger as any)?.rows ?? [],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /api/admin/tenants/:id/plan — change tenant plan ── */
router.post("/admin/tenants/:id/plan", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body as { plan: string };
    if (!plan) return res.status(400).json({ error: "الباقة مطلوبة" });

    const { provisionTenant } = await import("../services/tenantProvisioning");
    await provisionTenant({ officeId: id, plan, email: "admin@adala.ai" });

    res.json({ ok: true, officeId: id, plan });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /api/admin/tenants/:id/members — add user to office ── */
router.post("/admin/tenants/:id/members", adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role = "member" } = req.body as { userId: string; role?: string };
    if (!userId) return res.status(400).json({ error: "userId مطلوب" });

    await db.execute(sql`
      INSERT INTO office_members (office_id, user_id, role, status)
      VALUES (${id}, ${userId}, ${role}, 'active')
      ON CONFLICT (office_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'
    `);
    res.json({ ok: true, officeId: id, userId, role });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
