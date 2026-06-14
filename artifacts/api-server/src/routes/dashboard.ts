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

/* ─── GET /dashboard/intelligence — Office AI Intelligence ──────────────── */
router.get("/dashboard/intelligence", async (req, res) => {
  try {
    const now = new Date();
    const start7  = new Date(now); start7.setDate(now.getDate() - 7);
    const start30 = new Date(now); start30.setDate(now.getDate() - 30);
    const in72h   = new Date(now); in72h.setDate(now.getDate() + 3);

    const [cases, invoices, clients, contracts] = await Promise.all([
      db.select().from(casesTable).then(r => r as any[]),
      db.select().from(invoicesTable).then(r => r as any[]),
      db.select().from(clientsTable).then(r => r as any[]),
      db.select().from(contractsTable).then(r => r as any[]),
    ]);

    /* AI usage */
    let aiMonth = 0;
    try {
      const r = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM ai_tasks WHERE created_at >= ${start30.toISOString()}
      `);
      aiMonth = Number((r.rows?.[0] as any)?.cnt ?? 0);
    } catch {}

    /* Login frequency */
    let loginCount7 = 0;
    try {
      const r = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM login_logs WHERE created_at >= ${start7.toISOString()}
      `);
      loginCount7 = Number((r.rows?.[0] as any)?.cnt ?? 0);
    } catch {}

    /* Docs last 30 days */
    let docsMonth = 0;
    try {
      const r = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM documents WHERE created_at >= ${start30.toISOString()}
      `);
      docsMonth = Number((r.rows?.[0] as any)?.cnt ?? 0);
    } catch {}

    /* ── Score calculations ── */
    const activeInv = invoices.filter((i: any) => i.status !== "cancelled");
    const paidInv   = invoices.filter((i: any) => i.status === "paid");
    const overdueInv= invoices.filter((i: any) => i.status === "overdue" || (i.due_date && new Date(i.due_date) < now && i.status === "unpaid"));
    const activeCases = cases.filter((c: any) => ["open","in_progress"].includes(c.status));
    const stale7 = activeCases.filter((c: any) => new Date(c.updatedAt ?? c.created_at ?? 0) < start7);
    const critical = activeCases.filter((c: any) => c.nextHearingDate && new Date(c.nextHearingDate) <= in72h);

    // Engagement (0-100)
    const engagementScore = Math.min(100, Math.round(
      Math.min(aiMonth, 30) * 1 +          // AI usage → max 30
      Math.min(loginCount7, 7) * 5 +        // Logins → max 35
      Math.min(docsMonth, 10) * 1.5 +       // Docs → max 15
      (cases.length > 0 ? 10 : 0) +         // Has cases
      (clients.length > 0 ? 10 : 0)         // Has clients
    ));

    // Collection (0-100)
    const collectionScore = activeInv.length > 0
      ? Math.round((paidInv.length / activeInv.length) * 100)
      : 100;

    // Activity (0-100) — cases updated in last 7 days
    const activityScore = activeCases.length > 0
      ? Math.round(((activeCases.length - stale7.length) / activeCases.length) * 100)
      : 100;

    // AI utilization (0-100)
    const aiScore = Math.min(100, Math.round(aiMonth * 5));

    // Risk (0-100, higher = safer)
    let riskScore = 100;
    riskScore -= Math.min(overdueInv.length * 12, 50);
    riskScore -= Math.min(critical.length * 10, 30);
    const outstanding = activeInv.filter((i: any) => i.status !== "paid").reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0) / 100), 0);
    if (outstanding > 100_000) riskScore -= 20;
    else if (outstanding > 50_000) riskScore -= 10;
    riskScore = Math.max(0, riskScore);

    // Office score (weighted)
    const officeScore = Math.round(
      engagementScore * 0.20 +
      collectionScore * 0.30 +
      activityScore   * 0.20 +
      aiScore         * 0.15 +
      riskScore       * 0.15
    );

    const tier = officeScore >= 85 ? "ممتاز" : officeScore >= 65 ? "متقدم" : officeScore >= 40 ? "نشط" : "ناشئ";
    const tierEn = officeScore >= 85 ? "Excellent" : officeScore >= 65 ? "Advanced" : officeScore >= 40 ? "Active" : "Emerging";

    /* ── Smart Actions ── */
    const smartActions: any[] = [];

    if (critical.length > 0) {
      smartActions.push({
        priority: 1, urgent: true,
        type: "critical_session",
        title: `${critical.length} جلسة قضائية خلال 72 ساعة`,
        body: critical.slice(0, 2).map((c: any) => c.title).join(" · "),
        href: "/cases",
        icon: "gavel",
      });
    }

    if (overdueInv.length > 0) {
      const total = overdueInv.reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0) / 100), 0);
      smartActions.push({
        priority: overdueInv.length > 3 ? 1 : 2, urgent: overdueInv.length > 5,
        type: "overdue_invoices",
        title: `${overdueInv.length} فاتورة متأخرة — ${total.toLocaleString("ar-SA")} ر.س`,
        body: "أرسل تذكيرات الدفع لتحسين معدل التحصيل",
        href: "/invoices",
        icon: "receipt",
      });
    }

    if (stale7.length > 0) {
      smartActions.push({
        priority: 2, urgent: false,
        type: "stale_cases",
        title: `${stale7.length} قضية بدون تحديث منذ 7 أيام`,
        body: "تابع تقدم هذه القضايا وأضف آخر المستجدات",
        href: "/cases",
        icon: "scale",
      });
    }

    const expiringContracts = contracts.filter((c: any) => {
      const exp = c.expiresAt ?? c.endDate;
      if (!exp) return false;
      const d = new Date(exp);
      return d > now && d <= new Date(now.getTime() + 30 * 86400000);
    });
    if (expiringContracts.length > 0) {
      smartActions.push({
        priority: 2, urgent: false,
        type: "expiring_contracts",
        title: `${expiringContracts.length} عقد ينتهي خلال 30 يوم`,
        body: "جدّد العقود قبل انتهاء صلاحيتها",
        href: "/contracts",
        icon: "file",
      });
    }

    if (aiScore < 20 && cases.length > 0) {
      smartActions.push({
        priority: 3, urgent: false,
        type: "ai_low_usage",
        title: "استخدم الذكاء الاصطناعي لتسريع عملك",
        body: "جرّب لخّص قضية أو أنشئ مستنداً قانونياً بالذكاء الاصطناعي",
        href: "/ai-hub",
        icon: "sparkles",
      });
    }

    /* ── Client Risk Matrix ── */
    const clientRisks = clients.slice(0, 12).map((cl: any) => {
      const clInv = invoices.filter((i: any) => i.client_id === cl.id);
      const clCases = cases.filter((c: any) => c.client_id === cl.id && ["open","in_progress"].includes(c.status));
      const unpaid = clInv.filter((i: any) => !["paid","cancelled"].includes(i.status))
        .reduce((s: number, i: any) => s + ((i.total ?? i.amount ?? 0) / 100), 0);
      const overdue = clInv.filter((i: any) => i.status === "overdue").length;
      const lastActivity = [
        ...(clCases.map((c: any) => new Date(c.updatedAt ?? c.created_at ?? 0).getTime())),
        ...(clInv.map((i: any) => new Date(i.createdAt ?? 0).getTime())),
      ].reduce((max, t) => Math.max(max, t), 0);
      const daysSince = lastActivity > 0 ? Math.round((Date.now() - lastActivity) / 86400000) : 999;

      let risk = "low";
      if (overdue > 0 || unpaid > 20000) risk = "high";
      else if (unpaid > 5000 || daysSince > 30) risk = "medium";

      return {
        id: cl.id,
        name: cl.fullName ?? cl.name ?? "—",
        activeCases: clCases.length,
        unpaidAmount: Math.round(unpaid),
        overdueCount: overdue,
        daysSince: daysSince < 999 ? daysSince : null,
        risk,
      };
    }).sort((a: any, b: any) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.risk as keyof typeof order] ?? 3) - (order[b.risk as keyof typeof order] ?? 3);
    });

    res.json({
      scores: { engagement: engagementScore, collection: collectionScore, activity: activityScore, ai: aiScore, risk: riskScore },
      officeScore,
      tier,
      tierEn,
      smartActions: smartActions.sort((a, b) => a.priority - b.priority).slice(0, 5),
      clientRisks,
      stats: { activeCases: activeCases.length, overdueInv: overdueInv.length, stale: stale7.length, critical: critical.length },
    });
  } catch (e: any) {
    console.error("dashboard/intelligence:", e);
    res.json({
      scores: { engagement: 50, collection: 50, activity: 50, ai: 0, risk: 80 },
      officeScore: 50, tier: "نشط", tierEn: "Active",
      smartActions: [], clientRisks: [], stats: {},
    });
  }
});

export default router;
