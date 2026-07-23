/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-non-null-assertion -- pre-existing lint debt; schema authority */
import { requireAuth, requireSuperAdmin} from "../../middlewares/requireAuth";
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
import { getUncachableStripeClient } from "../../stripeClient";

const router = Router();
const adminOnly = requireSuperAdmin;

/** Coerce Drizzle NUMERIC (string) → JSON number for Batch-1 money fields. */
function moneyNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── Clerk Backend Client (lazy) ──────────────────── */
let _clerk: ReturnType<typeof createClerkClient> | null = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

/* ── Platform Owner / Super-Admin Guard ───────────── */
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
    totalCost: moneyNum(totalCost.total),
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
  const { id } = req.params as Record<string, string>;

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
        const { invalidateFeatureCache } = await import("../../middleware/feature-gate.js");
        invalidateFeatureCache();
      }
    } catch (e) {
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
  const { id } = req.params as Record<string, string>;
  const updated = await db.update(usersTable).set(req.body).where(eq(usersTable.id, id)).returning();
  res.json(updated[0]);
});

/* ══════════════════════════════════════════════════════
   PLANS — managed exclusively by planCms.ts
   (GET/DELETE here were duplicates; planCms.ts is authoritative)
══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   DISCOUNT CODES
══════════════════════════════════════════════════════ */
function serializeDiscount(row: typeof discountCodesTable.$inferSelect) {
  return { ...row, value: moneyNum(row.value) };
}

router.get("/admin/discounts", adminOnly, async (_req, res) => {
  const codes = await db.select().from(discountCodesTable).orderBy(desc(discountCodesTable.createdAt));
  res.json(codes.map(serializeDiscount));
});

router.post("/admin/discounts", adminOnly, async (req, res) => {
  const body = { ...req.body };
  if (body.value != null) body.value = String(body.value);
  const code = await db.insert(discountCodesTable).values(body).returning();
  res.json(serializeDiscount(code[0]));
});

router.patch("/admin/discounts/:id", adminOnly, async (req, res) => {
  const body = { ...req.body };
  if (body.value != null) body.value = String(body.value);
  const updated = await db.update(discountCodesTable).set(body).where(eq(discountCodesTable.id, String(req.params.id))).returning();
  res.json(updated[0] ? serializeDiscount(updated[0]) : updated[0]);
});

router.delete("/admin/discounts/:id", adminOnly, async (req, res) => {
  await db.delete(discountCodesTable).where(eq(discountCodesTable.id, String(req.params.id)));
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
  res.json(keys.map((k) => ({ ...k, totalCost: moneyNum(k.totalCost) })));
});

router.post("/admin/ai-keys", adminOnly, async (req, res) => {
  const { provider, keyLabel, keyValue } = req.body;
  const keyMasked = keyValue.slice(0, 8) + "..." + keyValue.slice(-4);
  const keyHash = Buffer.from(keyValue).toString("base64");
  const key = await db.insert(aiApiKeysTable).values({ provider, keyLabel, keyHash, keyMasked }).returning();
  res.json({ ...key[0], keyHash: undefined, totalCost: moneyNum(key[0].totalCost) });
});

router.patch("/admin/ai-keys/:id", adminOnly, async (req, res) => {
  const { isActive } = req.body;
  const updated = await db.update(aiApiKeysTable).set({ isActive }).where(eq(aiApiKeysTable.id, String(req.params.id))).returning();
  res.json(
    updated[0]
      ? {
          ...updated[0],
          totalCost: moneyNum(updated[0].totalCost),
        }
      : updated[0],
  );
});

router.delete("/admin/ai-keys/:id", adminOnly, async (req, res) => {
  await db.delete(aiApiKeysTable).where(eq(aiApiKeysTable.id, String(req.params.id)));
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
  const { key } = req.params as Record<string, string>;
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
  const updated = await db.update(departmentsTable).set(req.body).where(eq(departmentsTable.id, String(req.params.id))).returning();
  res.json(updated[0]);
});

router.delete("/admin/departments/:id", adminOnly, async (req, res) => {
  await db.delete(departmentsTable).where(eq(departmentsTable.id, String(req.params.id)));
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
  await db.delete(jobTitlesTable).where(eq(jobTitlesTable.id, String(req.params.id)));
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
  const updated = await db.update(legalSystemsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(legalSystemsTable.id, String(req.params.id))).returning();
  res.json(updated[0]);
});

router.delete("/admin/legal-systems/:id", adminOnly, async (req, res) => {
  await db.delete(legalSystemsTable).where(eq(legalSystemsTable.id, String(req.params.id)));
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════════
   SUPPORT TICKETS
══════════════════════════════════════════════════════ */
router.get("/admin/support", adminOnly, async (_req, res) => {
  const tickets = await db.select().from(supportTicketsTable).orderBy(desc(supportTicketsTable.createdAt));
  res.json(tickets);
});

router.post("/admin/support", requireAuth, async (req, res) => {
  const ticket = await db.insert(supportTicketsTable).values(req.body).returning();
  res.json(ticket[0]);
});

router.patch("/admin/support/:id", adminOnly, async (req, res) => {
  const { id } = req.params as Record<string, string>;
  const data: any = { ...req.body, updatedAt: new Date() };
  if (req.body.status === "resolved" && !data.resolvedAt) data.resolvedAt = new Date();
  const updated = await db.update(supportTicketsTable).set(data).where(eq(supportTicketsTable.id, id)).returning();
  res.json(updated[0]);
});

router.get("/admin/support/:id/messages", adminOnly, async (req, res) => {
  try {
    const messages = await db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.ticketId, String(req.params.id)))
      .orderBy(supportMessagesTable.createdAt);
    res.json(messages);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/admin/support/:id/reply", adminOnly, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
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
  res.json({
    logs: logs.map((l) => ({ ...l, cost: moneyNum(l.cost) })),
    summary: summary.map((s) => ({
      ...s,
      totalCost: moneyNum(s.totalCost),
      totalUnits: s.totalUnits == null ? 0 : Number(s.totalUnits),
    })),
  });
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
        res.status(500).json({ error: e.message });
  }
});

/* ── تسديد فاتورة من لوحة الإدارة ──────────────────── */
router.post("/admin/billing/pay/:id", adminOnly, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
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
    const { id } = req.params as Record<string, string>;

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
    const { id } = req.params as Record<string, string>;
    const { plan } = req.body as { plan: string };
    if (!plan) return res.status(400).json({ error: "الباقة مطلوبة" });

    const { provisionTenant } = await import("../../services/tenantProvisioning");
    await provisionTenant({ officeId: id, plan, email: "admin@adala.ai" });

    res.json({ ok: true, officeId: id, plan });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /api/admin/tenants/:id/members — add user to office ── */
router.post("/admin/tenants/:id/members", adminOnly, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
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

/* ══════════════════════════════════════════════════════════════════
   GLOBAL CONTROL CENTER — RISK ENGINE
   GET /api/admin/risk
   Returns a risk score for every tenant (office) based on:
   • No revenue + high AI usage  → HIGH RISK
   • Free plan + any AI spend    → MEDIUM RISK
   • Past-due notifications       → HIGH RISK
   • Paid plan + no usage         → LOW/CHURNING
══════════════════════════════════════════════════════════════════ */
router.get("/admin/risk", adminOnly, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        op.id::text               AS office_id,
        op.name                   AS name,
        op.plan                   AS plan,
        op.email                  AS email,
        COALESCE(l.gross,0)       AS revenue,
        COALESCE(l.tx_count,0)    AS tx_count,
        COALESCE(c.balance,0)     AS ai_credits_used,
        COALESCE(pn.fail_count,0) AS payment_failures
      FROM office_page op
      LEFT JOIN (
        SELECT office_id,
               SUM(amount)::numeric AS gross,
               COUNT(*)::int        AS tx_count
        FROM office_ledger WHERE type='credit' GROUP BY office_id
      ) l ON l.office_id = op.id::text
      LEFT JOIN (
        SELECT office_id,
               GREATEST(0, monthly_allowance - balance)::int AS balance
        FROM office_ai_credits
      ) c ON c.office_id = op.id::text
      LEFT JOIN (
        SELECT office_id, COUNT(*)::int AS fail_count
        FROM plan_notifications
        WHERE type='downgrade' AND title ILIKE '%فشل%'
        GROUP BY office_id
      ) pn ON pn.office_id = op.id::text
      ORDER BY op.created_at DESC
    `);

    const tenants = ((rows as any)?.rows ?? []).map((r: any) => {
      const revenue       = parseFloat(r.revenue ?? "0");
      const aiUsed        = Number(r.ai_credits_used ?? 0);
      const failures      = Number(r.payment_failures ?? 0);
      const plan          = (r.plan ?? "free") as string;

      let risk = 0;
      const reasons: string[] = [];

      if (revenue === 0 && aiUsed > 20)  { risk += 70; reasons.push("استخدام AI بلا إيرادات"); }
      if (plan === "free" && aiUsed > 50) { risk += 40; reasons.push("خطة مجانية + استهلاك AI مرتفع"); }
      if (plan !== "free" && revenue < 50){ risk += 30; reasons.push("اشتراك مدفوع + إيرادات منخفضة"); }
      if (failures >= 3)                  { risk += 60; reasons.push(`${failures} محاولات دفع فاشلة`); }
      if (failures >= 1 && failures < 3)  { risk += 20; reasons.push("محاولة دفع فاشلة"); }

      const level = risk >= 70 ? "HIGH" : risk >= 40 ? "MEDIUM" : "LOW";

      return {
        officeId:        r.office_id,
        name:            r.name ?? r.office_id,
        plan,
        email:           r.email,
        revenue,
        txCount:         Number(r.tx_count),
        aiUsed,
        paymentFailures: failures,
        riskScore:       Math.min(risk, 100),
        riskLevel:       level,
        reasons,
      };
    });

    const summary = {
      high:   tenants.filter((t: any) => t.riskLevel === "HIGH").length,
      medium: tenants.filter((t: any) => t.riskLevel === "MEDIUM").length,
      low:    tenants.filter((t: any) => t.riskLevel === "LOW").length,
    };

    res.json({ summary, tenants: tenants.sort((a: any, b: any) => b.riskScore - a.riskScore) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   GLOBAL CONTROL CENTER — GROWTH INSIGHTS
   GET /api/admin/growth
══════════════════════════════════════════════════════════════════ */
router.get("/admin/growth", adminOnly, async (_req, res) => {
  try {
    /* Plan distribution */
    const planDist = await db.execute(sql`
      SELECT plan, COUNT(*)::int AS cnt FROM office_page GROUP BY plan ORDER BY cnt DESC
    `);
    const planRows = (planDist as any)?.rows ?? [];
    const total = planRows.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const paid  = planRows.filter((r: any) => r.plan && r.plan !== "free").reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const free  = total - paid;
    const conversionRate = total > 0 ? parseFloat(((paid / total) * 100).toFixed(1)) : 0;

    /* Monthly new offices (last 12 months) */
    const monthlyNew = await db.execute(sql`
      SELECT TO_CHAR(created_at,'YYYY-MM') AS month, COUNT(*)::int AS new_offices
      FROM office_page
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month ORDER BY month ASC
    `);

    /* MRR trend (from ledger, last 12 months) */
    const mrrTrend = await db.execute(sql`
      SELECT TO_CHAR(created_at,'YYYY-MM') AS month,
             SUM(amount)::numeric          AS mrr,
             SUM(net_amount)::numeric      AS net,
             COUNT(DISTINCT office_id)::int AS paying_offices
      FROM office_ledger
      WHERE type='credit' AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month ORDER BY month ASC
    `);

    /* Plan upgrade/downgrade events */
    const planChanges = await db.execute(sql`
      SELECT type, COUNT(*)::int AS cnt
      FROM plan_notifications
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY type
    `);

    res.json({
      summary: {
        totalOffices:      total,
        paidOffices:       paid,
        freeOffices:       free,
        conversionRate,
        conversionRatePct: `${conversionRate}%`,
      },
      planDistribution: planRows.map((r: any) => ({
        plan: r.plan ?? "free",
        count: Number(r.cnt),
        pct: total > 0 ? parseFloat(((Number(r.cnt) / total) * 100).toFixed(1)) : 0,
      })),
      monthlyNewOffices: (monthlyNew as any)?.rows ?? [],
      mrrTrend: ((mrrTrend as any)?.rows ?? []).map((r: any) => ({
        month:         r.month,
        mrr:           parseFloat(r.mrr ?? "0"),
        net:           parseFloat(r.net ?? "0"),
        payingOffices: Number(r.paying_offices),
      })),
      recentPlanChanges: ((planChanges as any)?.rows ?? []),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   GLOBAL CONTROL CENTER — AI ANALYTICS
   GET /api/admin/ai-analytics
══════════════════════════════════════════════════════════════════ */
router.get("/admin/ai-analytics", adminOnly, async (_req, res) => {
  try {
    /* Global AI usage totals from usage_logs */
    const totals = await db.execute(sql`
      SELECT
        COUNT(*)::int          AS total_calls,
        COALESCE(SUM(units),0)::int  AS total_units,
        COALESCE(SUM(cost),0)::numeric AS total_cost
      FROM usage_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    const t = ((totals as any)?.rows ?? [])[0] ?? {};

    /* Per-feature breakdown */
    const byFeature = await db.execute(sql`
      SELECT feature,
             COUNT(*)::int         AS calls,
             SUM(units)::int       AS units,
             SUM(cost)::numeric    AS cost
      FROM usage_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY feature ORDER BY calls DESC LIMIT 10
    `);

    /* Daily trend (last 14 days) */
    const dailyTrend = await db.execute(sql`
      SELECT TO_CHAR(created_at,'MM-DD') AS day,
             COUNT(*)::int               AS calls,
             SUM(units)::int             AS units
      FROM usage_logs
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY day ORDER BY day ASC
    `);

    /* Per-office AI credits remaining */
    const officeCredits = await db.execute(sql`
      SELECT oc.office_id, oc.office_name, oc.balance,
             oc.monthly_allowance,
             CASE WHEN oc.monthly_allowance > 0
               THEN ROUND(((oc.monthly_allowance - oc.balance)::numeric / oc.monthly_allowance) * 100)
               ELSE 0 END AS usage_pct
      FROM office_ai_credits oc
      ORDER BY usage_pct DESC LIMIT 20
    `);

    /* AI credit transactions — recent spend */
    const recentSpend = await db.execute(sql`
      SELECT at2.office_id,
             COUNT(*)::int                         AS tx_count,
             COALESCE(SUM(ABS(at2.amount)),0)::int AS total_spent
      FROM ai_credit_transactions at2
      WHERE at2.created_at >= NOW() - INTERVAL '30 days'
        AND at2.amount < 0
      GROUP BY at2.office_id
      ORDER BY total_spent DESC LIMIT 10
    `);

    res.json({
      summary: {
        totalCalls:  Number(t.total_calls ?? 0),
        totalUnits:  Number(t.total_units ?? 0),
        totalCostUSD: parseFloat(t.total_cost ?? "0"),
      },
      byFeature:    ((byFeature  as any)?.rows ?? []).map((r: any) => ({
        feature: r.feature,
        calls:   Number(r.calls),
        units:   Number(r.units),
        cost:    parseFloat(r.cost ?? "0"),
      })),
      dailyTrend:   ((dailyTrend as any)?.rows ?? []),
      officeCredits: ((officeCredits as any)?.rows ?? []).map((r: any) => ({
        officeId:    r.office_id,
        officeName:  r.office_name ?? r.office_id,
        balance:     Number(r.balance),
        allowance:   Number(r.monthly_allowance),
        usagePct:    Number(r.usage_pct),
      })),
      topSpenders: ((recentSpend as any)?.rows ?? []).map((r: any) => ({
        officeId:   r.office_id,
        txCount:    Number(r.tx_count),
        totalSpent: Number(r.total_spent),
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   TRIAL MANAGEMENT
══════════════════════════════════════════════════════ */

/* GET /api/admin/trials — list all trialing (+ recently expired) subscriptions */
router.get("/admin/trials", adminOnly, async (_req, res) => {
  try {
    let stripe: any;
    try { stripe = await getUncachableStripeClient(); } catch {
      return res.json({ configured: false, trials: [], stats: {} });
    }

    /* Fetch trialing subs */
    const [trialingSubs, activeSubs] = await Promise.all([
      stripe.subscriptions.list({ status: "trialing", limit: 100, expand: ["data.customer"] }),
      stripe.subscriptions.list({ status: "active",   limit: 100, expand: ["data.customer"] }),
    ]);

    /* Office lookup by customer_id */
    const offices = await db.execute(sql`
      SELECT id, name, plan, stripe_customer_id FROM office_page
    `);
    const officeMap: Record<string, any> = {};
    for (const o of ((offices as any)?.rows ?? [])) {
      if (o.stripe_customer_id) officeMap[o.stripe_customer_id] = o;
    }

    const now = Math.floor(Date.now() / 1000);

    const mapSub = (s: any, status: "trialing" | "converted" | "active") => {
      const custId = typeof s.customer === "string" ? s.customer : s.customer?.id;
      const office = officeMap[custId] ?? null;
      const trialEnd = s.trial_end ?? null;
      const trialStart = s.trial_start ?? s.start_date ?? null;
      const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400)) : null;
      return {
        subId:       s.id,
        status,
        customerId:  custId,
        officeName:  office?.name ?? s.customer?.email ?? custId ?? "—",
        officePlan:  office?.plan ?? (s.metadata?.plan ?? "—"),
        trialStart,
        trialEnd,
        daysLeft,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        amount:      (s.items?.data?.[0]?.price?.unit_amount ?? 0) / 100,
        currency:    s.items?.data?.[0]?.price?.currency ?? "sar",
      };
    };

    const trialing = trialingSubs.data.map((s: any) => mapSub(s, "trialing"));

    /* Active subs that recently came out of trial (had trial_end in past 30 days) */
    const converted = activeSubs.data
      .filter((s: any) => s.trial_end && s.trial_end < now && s.trial_end > now - 30 * 86400)
      .map((s: any) => mapSub(s, "converted"));

    const urgentCount    = trialing.filter((t: any) => t.daysLeft !== null && t.daysLeft <= 7).length;
    const conversionRate = trialing.length + converted.length > 0
      ? Math.round((converted.length / (trialing.length + converted.length)) * 100) : 0;

    res.json({
      configured: true,
      trials: [...trialing, ...converted],
      stats: {
        active:         trialing.length,
        urgent:         urgentCount,
        converted:      converted.length,
        conversionRate,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/admin/trials/:subId/extend — extend trial by N days */
router.post("/admin/trials/:subId/extend", adminOnly, async (req, res) => {
  const { subId } = req.params as Record<string, string>;
  const { days = 14 } = req.body as { days?: number };
  try {
    const stripe = await getUncachableStripeClient();
    const sub = await stripe.subscriptions.retrieve(subId);
    const currentEnd = (sub as any).trial_end ?? Math.floor(Date.now() / 1000);
    const newEnd = Math.max(currentEnd, Math.floor(Date.now() / 1000)) + days * 86400;
    await stripe.subscriptions.update(subId, { trial_end: newEnd } as any);
    res.json({ ok: true, newTrialEnd: newEnd, daysAdded: days });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/admin/trials/:subId/cancel — end trial immediately */
router.post("/admin/trials/:subId/cancel", adminOnly, async (req, res) => {
  const { subId } = req.params as Record<string, string>;
  try {
    const stripe = await getUncachableStripeClient();
    await stripe.subscriptions.update(subId, { trial_end: "now" } as any);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   LANDING PAGE VARIANT
══════════════════════════════════════════════════════ */
router.get("/admin/landing-variant", adminOnly, async (_req, res) => {
  try {
    const r = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'landing_variant' LIMIT 1`) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    res.json({ variant: rows[0]?.value ?? "original" });
  } catch { res.json({ variant: "original" }); }
});

router.put("/admin/landing-variant", adminOnly, async (req, res) => {
  try {
    const { variant } = req.body as { variant: string };
    if (!["original","bento","stripe","hubspot"].includes(variant))
      return res.status(400).json({ error: "variant غير صالح" });
    await db.execute(sql`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES ('landing_variant', ${variant}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${variant}, updated_at = NOW()
    `);
    res.json({ ok: true, variant });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* Public — used by landing.tsx */
router.get("/landing-variant", async (_req, res) => {
  try {
    const r = await db.execute(sql`SELECT value FROM platform_settings WHERE key = 'landing_variant' LIMIT 1`) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    res.json({ variant: rows[0]?.value ?? "original" });
  } catch { res.json({ variant: "original" }); }
});

/* ══════════════════════════════════════════════════════════
   BANKRUPTCY SUPER ADMIN ROUTES  (isSuperAdmin — adminOnly)
══════════════════════════════════════════════════════════ */

async function ensureSystemAuditLogs() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_audit_logs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id TEXT NOT NULL,
      office_id     TEXT,
      action_type   TEXT NOT NULL,
      resource_type TEXT,
      resource_id   TEXT,
      reason        TEXT,
      ip_address    TEXT,
      metadata      JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sys_audit_admin  ON system_audit_logs(admin_user_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sys_audit_office ON system_audit_logs(office_id, created_at DESC)`);
}
ensureSystemAuditLogs().catch(() => {});

function saAll(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function saOne(r: any): any   { return saAll(r)[0] ?? null; }

/* GET /admin/bankruptcy/stats — global KPIs */
router.get("/admin/bankruptcy/stats", adminOnly, async (req: any, res) => {
  try {
    const [cases, reqs, creditors, claims, assets, tasks, alerts, templates, workflows] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='open') AS open, COUNT(*) FILTER (WHERE status='closed') AS closed, COUNT(DISTINCT office_id) AS offices FROM bankruptcy_cases`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='ready_for_filing') AS ready, COUNT(*) FILTER (WHERE status='converted_to_case') AS converted, AVG(readiness_score)::INT AS avg_readiness, AVG(eligibility_score)::INT AS avg_eligibility FROM bk_opening_requests`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total FROM bk_creditors`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='approved') AS approved, SUM(claim_amount)::NUMERIC AS total_amount FROM bk_claims`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total, SUM(estimated_value)::NUMERIC AS total_value FROM bk_assets`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='overdue') AS overdue FROM bk_tasks`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE severity='critical') AS critical FROM bk_alerts WHERE status='active'`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total FROM bk_templates`).then(saOne),
      db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='completed') AS completed FROM bk_workflows`).then(saOne),
    ]);
    res.json({ cases, opening_requests: reqs, creditors, claims, assets, tasks, alerts, templates, workflows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/bankruptcy/offices — per-office breakdown */
router.get("/admin/bankruptcy/offices", adminOnly, async (_req, res) => {
  try {
    const rows = saAll(await db.execute(sql`
      SELECT
        bc.office_id,
        op.name        AS office_name,
        COUNT(DISTINCT bc.id)   AS cases_count,
        COUNT(DISTINCT bor.id)  AS opening_requests_count,
        COUNT(DISTINCT bt.id)   FILTER (WHERE bt.status='overdue') AS overdue_tasks,
        COUNT(DISTINCT ba.id)   FILTER (WHERE ba.status='active') AS active_alerts,
        MAX(bc.created_at)      AS last_case_at
      FROM bankruptcy_cases bc
      LEFT JOIN office_page op     ON op.office_id = bc.office_id
      LEFT JOIN bk_opening_requests bor ON bor.office_id = bc.office_id
      LEFT JOIN bk_tasks bt        ON bt.office_id = bc.office_id
      LEFT JOIN bk_alerts ba       ON ba.office_id = bc.office_id
      GROUP BY bc.office_id, op.name
      ORDER BY cases_count DESC
      LIMIT 100
    `));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/bankruptcy/cases — all cases across all offices */
router.get("/admin/bankruptcy/cases", adminOnly, async (req: any, res) => {
  const { office_id, status, q, limit = "50", offset = "0" } = req.query as Record<string, string>;
  try {
    const rows = saAll(await db.execute(sql`
      SELECT bc.*, op.name AS office_name,
        (SELECT COUNT(*) FROM bk_creditors cr WHERE cr.case_id=bc.id) AS creditors_count,
        (SELECT COUNT(*) FROM bk_claims cl WHERE cl.case_id=bc.id) AS claims_count,
        (SELECT COUNT(*) FROM bk_assets a WHERE a.case_id=bc.id) AS assets_count
      FROM bankruptcy_cases bc
      LEFT JOIN office_page op ON op.office_id = bc.office_id
      WHERE 1=1
        ${office_id ? sql`AND bc.office_id = ${office_id}` : sql``}
        ${status ? sql`AND bc.status = ${status}` : sql``}
        ${q ? sql`AND (bc.debtor_name ILIKE ${"%" + q + "%"} OR bc.case_number ILIKE ${"%" + q + "%"})` : sql``}
      ORDER BY bc.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/bankruptcy/opening-requests — all opening requests across all offices */
router.get("/admin/bankruptcy/opening-requests", adminOnly, async (req: any, res) => {
  const { office_id, status, q } = req.query as Record<string, string>;
  try {
    const rows = saAll(await db.execute(sql`
      SELECT bor.*, op.name AS office_name
      FROM bk_opening_requests bor
      LEFT JOIN office_page op ON op.office_id = bor.office_id
      WHERE 1=1
        ${office_id ? sql`AND bor.office_id = ${office_id}` : sql``}
        ${status ? sql`AND bor.status = ${status}` : sql``}
        ${q ? sql`AND (bor.company_name ILIKE ${"%" + q + "%"} OR bor.request_number ILIKE ${"%" + q + "%"})` : sql``}
      ORDER BY bor.created_at DESC
      LIMIT 100
    `));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/bankruptcy/audit-logs */
router.get("/admin/bankruptcy/audit-logs", adminOnly, async (req: any, res) => {
  const { office_id, action_type, limit = "50" } = req.query as Record<string, string>;
  try {
    const rows = saAll(await db.execute(sql`
      SELECT sal.*, op.name AS office_name
      FROM system_audit_logs sal
      LEFT JOIN office_page op ON op.office_id = sal.office_id
      WHERE (sal.resource_type LIKE 'bankruptcy%' OR sal.action_type LIKE 'bankruptcy%' OR sal.metadata::text LIKE '%bankruptcy%')
        ${office_id ? sql`AND sal.office_id = ${office_id}` : sql``}
        ${action_type ? sql`AND sal.action_type = ${action_type}` : sql``}
      ORDER BY sal.created_at DESC
      LIMIT ${Number(limit)}
    `));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/bankruptcy/audit-logs — record SA access */
router.post("/admin/bankruptcy/audit-logs", adminOnly, async (req: any, res) => {
  const adminId = req.auth?.userId as string;
  const { office_id, action_type, resource_type, resource_id, reason, metadata } = req.body ?? {};
  if (!action_type) return res.status(400).json({ error: "action_type مطلوب" });
  try {
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
    await db.execute(sql`
      INSERT INTO system_audit_logs (admin_user_id, office_id, action_type, resource_type, resource_id, reason, ip_address, metadata)
      VALUES (${adminId}, ${office_id ?? null}, ${action_type}, ${resource_type ?? null}, ${resource_id ?? null},
              ${reason ?? null}, ${ip}, ${metadata ? JSON.stringify(metadata) : null}::jsonb)
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════
   BANKRUPTCY EOC — Enterprise Operations Center
══════════════════════════════════════════════════════════ */

/* bk_emergency_locks schema is owned by artifacts/api-server/migrations/014_bankruptcy_schema.sql. */

async function eocAudit(adminId: string, ip: string, officeId: string | null, action: string, meta?: object) {
  await db.execute(sql`
    INSERT INTO system_audit_logs (admin_user_id, office_id, action_type, resource_type, metadata, ip_address)
    VALUES (${adminId}, ${officeId ?? null}, ${action}, 'bankruptcy_eoc',
            ${meta ? JSON.stringify(meta) : null}::jsonb, ${ip})
  `).catch(() => {});
}

/* ── EOC: Health Center ── */
router.get("/admin/bankruptcy/eoc/health", adminOnly, async (_req, res) => {
  try {
    const rows = saAll(await db.execute(sql`
      SELECT
        bc.office_id,
        op.name                                                                              AS office_name,
        COUNT(DISTINCT bc.id)::int                                                           AS total_cases,
        COUNT(DISTINCT bc.id) FILTER (WHERE bc.status = 'open')::int                        AS open_cases,
        COUNT(DISTINCT bc.id) FILTER (WHERE bc.status = 'closed')::int                      AS closed_cases,
        COUNT(DISTINCT bt.id) FILTER (WHERE bt.status = 'overdue')::int                     AS overdue_tasks,
        COUNT(DISTINCT bt.id) FILTER (WHERE bt.status NOT IN ('completed','cancelled'))::int AS active_tasks,
        COUNT(DISTINCT ba.id) FILTER (WHERE ba.status = 'active' AND ba.severity = 'critical')::int AS critical_alerts,
        COUNT(DISTINCT ba.id) FILTER (WHERE ba.status = 'active')::int                      AS active_alerts,
        COUNT(DISTINCT bcl.id) FILTER (WHERE bcl.status = 'pending')::int                   AS pending_claims,
        COUNT(DISTINCT bcl.id)::int                                                          AS total_claims,
        MAX(bc.updated_at)                                                                   AS last_activity,
        GREATEST(0,
          100
          - LEAST(30, COUNT(DISTINCT bt.id) FILTER (WHERE bt.status = 'overdue') * 5)
          - LEAST(40, COUNT(DISTINCT ba.id) FILTER (WHERE ba.status = 'active' AND ba.severity = 'critical') * 10)
          - CASE WHEN MAX(bc.updated_at) < NOW() - INTERVAL '30 days' THEN 15 ELSE 0 END
          - CASE WHEN COUNT(DISTINCT bc.id) FILTER (WHERE bc.status = 'open') > 10 THEN 10 ELSE 0 END
        )::int                                                                               AS health_score
      FROM bankruptcy_cases bc
      LEFT JOIN office_page op  ON op.id::text = bc.office_id
      LEFT JOIN bk_tasks bt     ON bt.case_id  = bc.id::uuid
      LEFT JOIN bk_alerts ba    ON ba.case_id  = bc.id::uuid
      LEFT JOIN bk_claims bcl   ON bcl.case_id = bc.id::uuid
      GROUP BY bc.office_id, op.name
      ORDER BY health_score ASC
    `));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── EOC: Revenue Center ── */
router.get("/admin/bankruptcy/eoc/revenue", adminOnly, async (_req, res) => {
  try {
    const [summary, byPlan, monthly, offices] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(DISTINCT op.id)::int                                                         AS total_offices,
          COUNT(DISTINCT op.id) FILTER (WHERE op.plan NOT IN ('free','trial') AND op.plan IS NOT NULL)::int AS paid_offices,
          COUNT(DISTINCT op.id) FILTER (WHERE op.plan = 'trial')::int                        AS trial_offices,
          COUNT(DISTINCT op.id) FILTER (WHERE op.plan IS NULL OR op.plan = 'free')::int      AS free_offices,
          COALESCE(SUM(l.total_credit),0)::numeric                                           AS total_revenue,
          COALESCE(AVG(l.total_credit) FILTER (WHERE l.total_credit > 0),0)::numeric         AS avg_revenue_per_office
        FROM office_page op
        LEFT JOIN (
          SELECT office_id, SUM(amount) AS total_credit
          FROM office_ledger WHERE type = 'credit'
          GROUP BY office_id
        ) l ON l.office_id = op.id::text
      `).then(saOne),
      db.execute(sql`
        SELECT COALESCE(op.plan,'free') AS plan_slug,
               COUNT(*)::int AS office_count,
               COALESCE(SUM(l.total_credit),0)::numeric AS revenue
        FROM office_page op
        LEFT JOIN (
          SELECT office_id, SUM(amount) AS total_credit
          FROM office_ledger WHERE type = 'credit'
          GROUP BY office_id
        ) l ON l.office_id = op.id::text
        GROUP BY op.plan
        ORDER BY office_count DESC
      `).then(saAll),
      db.execute(sql`
        SELECT TO_CHAR(created_at,'YYYY-MM') AS month,
               COALESCE(SUM(amount),0)::numeric AS revenue,
               COUNT(DISTINCT office_id)::int AS offices
        FROM office_ledger WHERE type = 'credit' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at,'YYYY-MM')
        ORDER BY month ASC
      `).then(saAll),
      db.execute(sql`
        SELECT op.id::text AS office_id, op.name, COALESCE(op.plan,'free') AS plan,
               COALESCE(l.total_credit,0)::numeric AS revenue,
               op.created_at
        FROM office_page op
        LEFT JOIN (
          SELECT office_id, SUM(amount) AS total_credit FROM office_ledger WHERE type='credit' GROUP BY office_id
        ) l ON l.office_id = op.id::text
        ORDER BY revenue DESC LIMIT 20
      `).then(saAll),
    ]);
    res.json({ summary, by_plan: byPlan, monthly, top_offices: offices });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── EOC: AI Analytics ── */
router.get("/admin/bankruptcy/eoc/ai-analytics", adminOnly, async (_req, res) => {
  try {
    const [summary, perOffice, daily] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int                                                         AS total_transactions,
          COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0),0)::int          AS total_credits_used,
          COUNT(DISTINCT office_id)::int                                        AS offices_using_ai,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS transactions_30d,
          COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0 AND created_at >= NOW() - INTERVAL '30 days'),0)::int AS credits_used_30d
        FROM ai_credit_transactions
      `).then(saOne),
      db.execute(sql`
        SELECT t.office_id, op.name AS office_name,
               oc.balance                                                              AS current_balance,
               oc.monthly_allowance,
               COUNT(t.id)::int                                                        AS total_transactions,
               COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.amount < 0),0)::int        AS credits_used,
               COUNT(t.id) FILTER (WHERE t.created_at >= NOW() - INTERVAL '30 days')::int AS transactions_30d
        FROM ai_credit_transactions t
        LEFT JOIN office_page op ON op.id::text = t.office_id
        LEFT JOIN office_ai_credits oc ON oc.office_id = t.office_id
        GROUP BY t.office_id, op.name, oc.balance, oc.monthly_allowance
        ORDER BY credits_used DESC
        LIMIT 30
      `).then(saAll),
      db.execute(sql`
        SELECT TO_CHAR(created_at,'YYYY-MM-DD') AS day,
               COUNT(*)::int                    AS transactions,
               COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0),0)::int AS credits_used
        FROM ai_credit_transactions
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY TO_CHAR(created_at,'YYYY-MM-DD')
        ORDER BY day ASC
      `).then(saAll),
    ]);
    res.json({ summary, per_office: perOffice, daily });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── EOC: Storage & Backups ── */
router.get("/admin/bankruptcy/eoc/storage", adminOnly, async (_req, res) => {
  try {
    const [storageSummary, perOffice, backupSummary, recentBackups] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int                                   AS total_files,
          COALESCE(SUM(file_size),0)::bigint              AS total_bytes,
          COUNT(*) FILTER (WHERE is_archived)::int        AS archived_count,
          COUNT(*) FILTER (WHERE is_deleted)::int         AS deleted_count,
          COUNT(DISTINCT office_id)::int                  AS offices_with_files,
          COALESCE(MAX(file_size),0)::bigint              AS largest_file_bytes
        FROM storage_files
      `).then(saOne),
      db.execute(sql`
        SELECT sf.office_id, op.name AS office_name,
               COUNT(sf.id)::int AS files_count,
               COALESCE(SUM(sf.file_size),0)::bigint AS used_bytes,
               COALESCE(q.max_bytes, 1073741824)::bigint AS max_bytes
        FROM storage_files sf
        LEFT JOIN office_page op ON op.id::text = sf.office_id
        LEFT JOIN office_storage_quota q ON q.office_id = sf.office_id
        WHERE NOT sf.is_deleted
        GROUP BY sf.office_id, op.name, q.max_bytes
        ORDER BY used_bytes DESC
        LIMIT 20
      `).then(saAll),
      db.execute(sql`
        SELECT
          COUNT(*)::int                                        AS total_jobs,
          COUNT(*) FILTER (WHERE status = 'completed')::int   AS completed_jobs,
          COUNT(*) FILTER (WHERE status = 'failed')::int      AS failed_jobs,
          COUNT(*) FILTER (WHERE status = 'running')::int     AS running_jobs,
          COALESCE(SUM(size_bytes) FILTER (WHERE status='completed'),0)::bigint AS total_backup_bytes,
          MAX(completed_at) FILTER (WHERE status = 'completed') AS last_successful_backup,
          COUNT(DISTINCT office_id)::int                       AS offices_backed_up
        FROM backup_jobs
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `).then(saOne),
      db.execute(sql`
        SELECT bj.office_id, op.name AS office_name, bj.type, bj.status,
               bj.size_bytes, bj.completed_at, bj.created_at
        FROM backup_jobs bj
        LEFT JOIN office_page op ON op.id::text = bj.office_id
        ORDER BY bj.created_at DESC
        LIMIT 30
      `).then(saAll),
    ]);
    res.json({ storage: storageSummary, per_office: perOffice, backup: backupSummary, recent_backups: recentBackups });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── EOC: Emergency — list active locks ── */
router.get("/admin/bankruptcy/eoc/emergency", adminOnly, async (_req, res) => {
  try {
    const locks = saAll(await db.execute(sql`
      SELECT el.*, op.name AS office_name
      FROM bk_emergency_locks el
      LEFT JOIN office_page op ON op.id::text = el.office_id
      WHERE el.is_active = TRUE
        AND (el.expires_at IS NULL OR el.expires_at > NOW())
      ORDER BY el.created_at DESC
    `));
    const history = saAll(await db.execute(sql`
      SELECT el.*, op.name AS office_name
      FROM bk_emergency_locks el
      LEFT JOIN office_page op ON op.id::text = el.office_id
      WHERE el.is_active = FALSE OR (el.expires_at IS NOT NULL AND el.expires_at <= NOW())
      ORDER BY el.created_at DESC LIMIT 20
    `));
    res.json({ active: locks, history });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── EOC: Emergency — apply lock/freeze ── */
router.post("/admin/bankruptcy/eoc/emergency", adminOnly, async (req: any, res) => {
  const adminId = req.auth?.userId as string;
  const { office_id, lock_type, target_id, reason, expires_hours } = req.body ?? {};
  if (!office_id || !lock_type || !reason) return res.status(400).json({ error: "office_id, lock_type, reason مطلوبون" });
  try {
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
    const expiresAt = expires_hours ? sql`NOW() + (${Number(expires_hours)} || ' hours')::interval` : sql`NULL`;
    const row = saOne(await db.execute(sql`
      INSERT INTO bk_emergency_locks (office_id, lock_type, target_id, reason, locked_by, expires_at)
      VALUES (${office_id}, ${lock_type}, ${target_id ?? null}, ${reason}, ${adminId}, ${expiresAt})
      RETURNING *
    `));
    await eocAudit(adminId, ip, office_id, `bankruptcy.emergency.${lock_type}`, { lock_type, target_id, reason });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ── EOC: Emergency — release lock ── */
router.delete("/admin/bankruptcy/eoc/emergency/:id", adminOnly, async (req: any, res) => {
  const adminId = req.auth?.userId as string;
  const { id } = req.params as Record<string, string>;
  try {
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
    const row = saOne(await db.execute(sql`
      UPDATE bk_emergency_locks
      SET is_active = FALSE, released_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `));
    if (row) await eocAudit(adminId, ip, row.office_id, "bankruptcy.emergency.release", { lock_id: id });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
