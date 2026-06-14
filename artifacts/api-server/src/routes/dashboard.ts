import { Router } from "express";
import { db, casesTable, documentsTable, aiTasksTable, usersTable, messagesTable, clientInvoicesTable as invoicesTable, clientsTable, contractsTable } from "@workspace/db";
import { sql, desc, gte, and, eq } from "drizzle-orm";

const router = Router();

// ─── GET /dashboard/overview ──────────────────────────────────────────────────
router.get("/dashboard/overview", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const in7Days      = new Date(now); in7Days.setDate(now.getDate() + 7);
    const in30Days     = new Date(now); in30Days.setDate(now.getDate() + 30);

    const [cases, docs, tasks, users, _inv, clients, _con] = await Promise.all([
      db.select().from(casesTable),
      db.select().from(documentsTable),
      db.select().from(aiTasksTable),
      db.select().from(usersTable),
      db.select().from(invoicesTable),
      db.select().from(clientsTable),
      db.select().from(contractsTable),
    ]);
    const invoices = _inv as any[];
    const contracts = _con as any[];

    // KPI Stats
    const activeCases    = cases.filter(c => ["open","in_progress"].includes(c.status)).length;
    const totalCases     = cases.length;
    const totalClients   = clients.length;
    const paidRevenue    = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0);
    const outstanding    = invoices.filter(i => !["paid","cancelled"].includes(i.status)).reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0);
    const overdueInvoices = invoices.filter(i => i.status === "overdue");
    const aiCompleted    = tasks.filter(t => t.status === "done").length;
    const casesThisMonth = cases.filter(c => c.createdAt >= startOfMonth).length;
    const clientsThisMonth = clients.filter(c => c.createdAt >= startOfMonth).length;

    // Smart Alerts
    const alerts: any[] = [];

    if (overdueInvoices.length > 0) {
      const total = overdueInvoices.reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0);
      alerts.push({
        type: "warning", icon: "receipt",
        title: `${overdueInvoices.length} فاتورة متأخرة`,
        body: `إجمالي المستحقات: ${(total / 100).toLocaleString("ar-SA")} ر.س`,
        action: "/invoices",
      });
    }

    const expiringContracts = contracts.filter(c => {
      if (!c.expiresAt && !c.endDate) return false;
      const exp = new Date((c.expiresAt ?? c.endDate) as Date);
      return exp > now && exp <= in30Days;
    });
    if (expiringContracts.length > 0) {
      alerts.push({
        type: "info", icon: "file",
        title: `${expiringContracts.length} عقد ينتهي خلال 30 يوم`,
        body: expiringContracts.slice(0, 2).map((c: any) => c.title).join(" • "),
        action: "/contracts",
      });
    }

    const pendingCases = cases.filter(c => c.status === "open").length;
    if (pendingCases > 0) {
      alerts.push({
        type: "primary", icon: "scale",
        title: `${pendingCases} قضية مفتوحة`,
        body: "تحتاج إلى متابعة ومعالجة",
        action: "/cases",
      });
    }

    // Upcoming calendar events
    let upcomingEvents: any[] = [];
    try {
      const evRows = await db.execute(sql`
        SELECT * FROM events
        WHERE start_at >= NOW() AND start_at <= NOW() + INTERVAL '7 days'
        ORDER BY start_at ASC LIMIT 5
      `);
      upcomingEvents = evRows.rows ?? [];
    } catch {}

    // Today's events
    let todayEvents: any[] = [];
    try {
      const todayRows = await db.execute(sql`
        SELECT * FROM events
        WHERE DATE(start_at) = CURRENT_DATE
        ORDER BY start_at ASC
      `);
      todayEvents = todayRows.rows ?? [];
    } catch {}

    // Recent activity
    const recentCases = cases.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3);
    const recentInvoices = invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

    // Performance metrics
    const completedCases = cases.filter(c => c.status === "closed").length;
    const successRate    = totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0;

    // Month-by-month revenue (last 6 months)
    const monthlyData: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("ar-SA", { month: "short" });
      monthlyData[key] = 0;
    }
    invoices.filter(i => i.status === "paid").forEach(inv => {
      const d  = new Date(inv.createdAt);
      const mo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      if (d >= mo) {
        const key = d.toLocaleDateString("ar-SA", { month: "short" });
        monthlyData[key] = (monthlyData[key] ?? 0) + ((inv.total ?? inv.amount ?? 0) / 100);
      }
    });
    const revenueChart = Object.entries(monthlyData).map(([month, revenue]) => ({ month, revenue }));

    res.json({
      kpis: { activeCases, totalCases, totalClients, paidRevenue, outstanding, aiCompleted, casesThisMonth, clientsThisMonth, successRate },
      alerts,
      upcomingEvents,
      todayEvents,
      recentCases: recentCases.map(c => ({ id: c.id, title: c.title, status: c.status, caseType: c.caseType, createdAt: c.createdAt })),
      recentInvoices: recentInvoices.map(i => ({ id: i.id, title: i.title, total: i.total ?? i.amount, status: i.status })),
      revenueChart,
    });
  } catch (e: any) {
    console.error("dashboard/overview:", e);
    res.json({ kpis: {}, alerts: [], upcomingEvents: [], todayEvents: [], recentCases: [], recentInvoices: [], revenueChart: [] });
  }
});

// Keep old endpoints for backward compatibility
router.get("/dashboard/stats", async (req, res) => {
  try {
    const [cases, docs, tasks, users, _inv2] = await Promise.all([
      db.select().from(casesTable),
      db.select().from(documentsTable),
      db.select().from(aiTasksTable),
      db.select().from(usersTable),
      db.select().from(invoicesTable),
    ]);
    const invoices = _inv2 as any[];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    res.json({
      totalCases: cases.length,
      openCases: cases.filter(c => ["open","in_progress"].includes(c.status)).length,
      totalDocuments: docs.length,
      aiTasksCompleted: tasks.filter(t => t.status === "done").length,
      activeUsers: users.filter(u => u.status === "active").length,
      monthlyRevenue: invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount ?? 0), 0),
      casesThisMonth: cases.filter(c => c.createdAt >= startOfMonth).length,
      docsThisMonth: docs.filter(d => d.createdAt >= startOfMonth).length,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const [cases, docs, tasks, msgs] = await Promise.all([
      db.select().from(casesTable).orderBy(desc(casesTable.createdAt)).limit(5),
      db.select().from(documentsTable).orderBy(desc(documentsTable.createdAt)).limit(5),
      db.select().from(aiTasksTable).orderBy(desc(aiTasksTable.createdAt)).limit(5),
      db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)).limit(5),
    ]);
    const activity = [
      ...cases.map(c => ({ id: `case-${c.id}`, type: "case_created", description: `قضية جديدة: ${c.title}`, createdAt: c.createdAt.toISOString() })),
      ...docs.map(d => ({ id: `doc-${d.id}`, type: "document_uploaded", description: `مستند: ${d.fileName ?? d.fileType}`, createdAt: d.createdAt.toISOString() })),
      ...tasks.map(t => ({ id: `task-${t.id}`, type: "ai_task_completed", description: `مهمة ذكاء: ${t.type}`, createdAt: t.createdAt.toISOString() })),
      ...msgs.map(m => ({ id: `msg-${m.id}`, type: "message_sent", description: `رسالة ${m.direction === "inbound" ? "واردة" : "صادرة"}`, createdAt: m.createdAt.toISOString() })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15);
    res.json(activity);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/case-breakdown", async (req, res) => {
  try {
    const cases = await db.select().from(casesTable);
    const byType: Record<string, number> = {};
    for (const c of cases) byType[c.caseType] = (byType[c.caseType] ?? 0) + 1;
    res.json({ byType: Object.entries(byType).map(([label, count]) => ({ label, count })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── GET /dashboard/executive — مركز القيادة التنفيذي ───────────────────── */
router.get("/dashboard/executive", async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const in3Days      = new Date(now); in3Days.setDate(now.getDate() + 3);

    const [cases, invoices, clients, employees] = await Promise.all([
      db.select().from(casesTable),
      db.select().from(invoicesTable).then(r => r as any[]),
      db.select().from(clientsTable),
      db.execute(sql`SELECT * FROM employees`).then(r => r.rows ?? []).catch(() => []),
    ]);

    // Revenue metrics
    const todayRevenue  = (invoices as any[]).filter((i: any) => i.status === "paid" && new Date(i.createdAt) >= startOfToday)
      .reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0) / 100), 0);
    const monthRevenue  = (invoices as any[]).filter((i: any) => i.status === "paid" && new Date(i.createdAt) >= startOfMonth)
      .reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0) / 100), 0);
    const outstanding   = (invoices as any[]).filter((i: any) => !["paid","cancelled"].includes(i.status))
      .reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0) / 100), 0);
    const overdueCount  = (invoices as any[]).filter((i: any) => i.status === "overdue").length;
    const paidCount     = (invoices as any[]).filter((i: any) => i.status === "paid").length;
    const totalInvCount = (invoices as any[]).filter((i: any) => i.status !== "cancelled").length;
    const collectionRate = totalInvCount > 0 ? Math.round((paidCount / totalInvCount) * 100) : 0;

    // Cases
    const activeCases   = cases.filter(c => ["open","in_progress"].includes(c.status)).length;
    const criticalCases = cases.filter(c => {
      if (!["open","in_progress"].includes(c.status)) return false;
      if (!c.nextHearingDate) return false;
      const d = new Date(c.nextHearingDate as any);
      return d >= now && d <= in3Days;
    }).length;

    // Clients
    const newClientsThisWeek = clients.filter(c => new Date(c.createdAt) >= startOfWeek).length;

    // AI usage
    let aiUsageThisMonth = 0;
    try {
      const aiR = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM ai_tasks WHERE created_at >= ${startOfMonth.toISOString()}
      `);
      aiUsageThisMonth = Number((aiR.rows?.[0] as any)?.cnt ?? 0);
    } catch {}

    // Active employees
    const activeEmployees = (employees as any[]).filter((e: any) => e.status === "active").length;

    // System health score (simple heuristic)
    let healthScore = 100;
    if (overdueCount > 5)  healthScore -= 20;
    if (criticalCases > 3) healthScore -= 15;
    if (outstanding > 50000) healthScore -= 10;
    const healthStatus = healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : "attention";

    res.json({
      todayRevenue,
      monthRevenue,
      outstanding,
      overdueCount,
      collectionRate,
      activeCases,
      criticalCases,
      newClientsThisWeek,
      aiUsageThisMonth,
      activeEmployees,
      healthScore,
      healthStatus,
    });
  } catch (e: any) {
    console.error("dashboard/executive:", e);
    res.json({ todayRevenue: 0, monthRevenue: 0, outstanding: 0, overdueCount: 0, collectionRate: 0, activeCases: 0, criticalCases: 0, newClientsThisWeek: 0, aiUsageThisMonth: 0, activeEmployees: 0, healthScore: 100, healthStatus: "excellent" });
  }
});

export default router;
