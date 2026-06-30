import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db, casesTable, clientInvoicesTable as invoicesTable, clientsTable } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";
import { cache } from "../../core/cache";

const router = Router();

/* ─── Helper: safe db.execute rows ───────────────────────────── */
async function safeRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* ─────────────────────────────────────────────────────────────────
   GET /dashboard/summary  ← NEW — fast < 200ms endpoint
   Returns COUNT aggregates only; never fetches full tables.
   Cached per office for 60 seconds.
───────────────────────────────────────────────────────────────── */
router.get("/dashboard/summary", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  const cacheKey = `dashboard:summary:${tenantId}`;

  const hit = cache.get<object>(cacheKey);
  if (hit) { res.json({ ...hit, cached: true }); return; }

  try {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);

    const [kpiRows, alertRows, recentCaseRows, recentInvRows, chartRows, evRows] = await Promise.all([
      /* KPIs — all COUNT/SUM in DB, zero JS aggregation */
      safeRows(sql`
        SELECT
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId})::int                                      AS total_cases,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND status IN ('open','in_progress'))::int AS active_cases,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND status = 'closed')::int                AS closed_cases,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND created_at >= ${startOfMonth})::int    AS cases_this_month,
          (SELECT COUNT(*) FROM clients WHERE office_id = ${tenantId})::int                                    AS total_clients,
          (SELECT COUNT(*) FROM clients WHERE office_id = ${tenantId} AND created_at >= ${startOfMonth})::int  AS clients_this_month,
          (SELECT COALESCE(SUM(total),0) FROM client_invoices WHERE office_id = ${tenantId} AND status = 'paid')::float        AS paid_revenue,
          (SELECT COALESCE(SUM(total),0) FROM client_invoices WHERE office_id = ${tenantId} AND status NOT IN ('paid','cancelled'))::float AS outstanding,
          (SELECT COUNT(*) FROM client_invoices WHERE office_id = ${tenantId} AND status = 'overdue')::int     AS overdue_count,
          (SELECT COALESCE(SUM(total),0) FROM client_invoices WHERE office_id = ${tenantId} AND status = 'overdue')::float AS overdue_total
      `),
      /* Alert data (just counts — no full rows) */
      safeRows(sql`
        SELECT
          (SELECT COUNT(*) FROM contracts
           WHERE office_id = ${tenantId}
             AND (expires_at IS NOT NULL OR end_date IS NOT NULL)
             AND COALESCE(expires_at, end_date) BETWEEN NOW() AND NOW() + INTERVAL '30 days')::int AS expiring_contracts,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND status = 'open')::int AS open_cases
      `),
      /* 3 most recent cases — indexed by created_at */
      safeRows(sql`
        SELECT id, title, status, case_type, created_at
        FROM cases WHERE office_id = ${tenantId}
        ORDER BY created_at DESC LIMIT 3
      `),
      /* 3 most recent invoices */
      safeRows(sql`
        SELECT id, title, total, status
        FROM client_invoices WHERE office_id = ${tenantId}
        ORDER BY created_at DESC LIMIT 3
      `),
      /* 6-month revenue chart — pure SQL aggregation */
      safeRows(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COALESCE(SUM(total),0)::float AS revenue
        FROM client_invoices
        WHERE office_id = ${tenantId}
          AND status = 'paid'
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY 1 ORDER BY 1
      `),
      /* Upcoming events next 7 days */
      safeRows(sql`
        SELECT id, title, start_at, event_type
        FROM events
        WHERE office_id = ${tenantId}
          AND start_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        ORDER BY start_at ASC LIMIT 5
      `),
    ]);

    const k   = kpiRows[0] ?? {};
    const al  = alertRows[0] ?? {};
    const totalCases = parseInt(k.total_cases ?? "0");
    const closedCases = parseInt(k.closed_cases ?? "0");

    const alerts: any[] = [];
    if (parseInt(k.overdue_count ?? "0") > 0)
      alerts.push({ type: "warning", icon: "receipt",
        title: `${k.overdue_count} فاتورة متأخرة`,
        body: `المستحقات: ${(parseFloat(k.overdue_total ?? "0") / 100).toLocaleString("ar-SA")} ر.س`,
        action: "/invoices" });
    if (parseInt(al.expiring_contracts ?? "0") > 0)
      alerts.push({ type: "info", icon: "file",
        title: `${al.expiring_contracts} عقد ينتهي خلال 30 يوم`, body: "", action: "/contracts" });
    if (parseInt(al.open_cases ?? "0") > 0)
      alerts.push({ type: "primary", icon: "scale",
        title: `${al.open_cases} قضية مفتوحة`, body: "تحتاج إلى متابعة", action: "/cases" });

    const result = {
      kpis: {
        totalCases,
        activeCases:      parseInt(k.active_cases ?? "0"),
        totalClients:     parseInt(k.total_clients ?? "0"),
        paidRevenue:      parseFloat(k.paid_revenue ?? "0") / 100,
        outstanding:      parseFloat(k.outstanding ?? "0") / 100,
        casesThisMonth:   parseInt(k.cases_this_month ?? "0"),
        clientsThisMonth: parseInt(k.clients_this_month ?? "0"),
        successRate:      totalCases > 0 ? Math.round((closedCases / totalCases) * 100) : 0,
        aiCompleted:      0,
      },
      alerts,
      recentCases:    recentCaseRows.map((c: any) => ({ id: c.id, title: c.title, status: c.status, caseType: c.case_type, createdAt: c.created_at })),
      recentInvoices: recentInvRows.map((i: any) => ({ id: i.id, title: i.title, total: i.total, status: i.status })),
      revenueChart:   chartRows.map((r: any) => ({ month: r.month, revenue: parseFloat(r.revenue) / 100 })),
      upcomingEvents: evRows,
      todayEvents:    [],
    };

    cache.set(cacheKey, result, 60); // 60s cache
    res.json({ ...result, cached: false });
  } catch (e: any) {
    res.json({ kpis: {}, alerts: [], recentCases: [], recentInvoices: [], revenueChart: [], upcomingEvents: [], todayEvents: [], cached: false });
  }
});

// ─── GET /dashboard/overview  (kept for backward compat — now delegates to summary) ─
router.get("/dashboard/overview", requireAuthWithTenant, async (req, res) => {
  // Reuse the summary logic — same data shape, clients already use this endpoint
  const tenantId = (req as any).tenantId as string;
  const cacheKey = `dashboard:summary:${tenantId}`;

  const hit = cache.get<object>(cacheKey);
  if (hit) { res.json({ ...hit, cached: true }); return; }

  // Forward internally to summary logic by re-running the same query
  try {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);

    const [kpiRows, alertRows, recentCaseRows, recentInvRows, chartRows, evRows, todayRows] = await Promise.all([
      safeRows(sql`
        SELECT
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId})::int                                      AS total_cases,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND status IN ('open','in_progress'))::int AS active_cases,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND status = 'closed')::int                AS closed_cases,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND created_at >= ${startOfMonth})::int    AS cases_this_month,
          (SELECT COUNT(*) FROM clients WHERE office_id = ${tenantId})::int                                    AS total_clients,
          (SELECT COUNT(*) FROM clients WHERE office_id = ${tenantId} AND created_at >= ${startOfMonth})::int  AS clients_this_month,
          (SELECT COALESCE(SUM(total),0) FROM client_invoices WHERE office_id = ${tenantId} AND status = 'paid')::float        AS paid_revenue,
          (SELECT COALESCE(SUM(total),0) FROM client_invoices WHERE office_id = ${tenantId} AND status NOT IN ('paid','cancelled'))::float AS outstanding,
          (SELECT COUNT(*) FROM client_invoices WHERE office_id = ${tenantId} AND status = 'overdue')::int     AS overdue_count,
          (SELECT COALESCE(SUM(total),0) FROM client_invoices WHERE office_id = ${tenantId} AND status = 'overdue')::float AS overdue_total
      `),
      safeRows(sql`
        SELECT
          (SELECT COUNT(*) FROM contracts
           WHERE office_id = ${tenantId}
             AND COALESCE(expires_at, end_date) BETWEEN NOW() AND NOW() + INTERVAL '30 days')::int AS expiring_contracts,
          (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND status = 'open')::int AS open_cases
      `),
      safeRows(sql`SELECT id, title, status, case_type, created_at FROM cases WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 3`),
      safeRows(sql`SELECT id, title, total, status FROM client_invoices WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 3`),
      safeRows(sql`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month, COALESCE(SUM(total),0)::float AS revenue
        FROM client_invoices WHERE office_id = ${tenantId} AND status = 'paid' AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY 1 ORDER BY 1
      `),
      safeRows(sql`SELECT id, title, start_at, event_type FROM events WHERE office_id = ${tenantId} AND start_at BETWEEN NOW() AND NOW() + INTERVAL '7 days' ORDER BY start_at ASC LIMIT 5`),
      safeRows(sql`SELECT id, title, start_at, event_type FROM events WHERE office_id = ${tenantId} AND DATE(start_at) = CURRENT_DATE ORDER BY start_at ASC LIMIT 10`),
    ]);

    const k = kpiRows[0] ?? {};
    const al = alertRows[0] ?? {};
    const totalCases = parseInt(k.total_cases ?? "0");
    const closedCases = parseInt(k.closed_cases ?? "0");

    const alerts: any[] = [];
    if (parseInt(k.overdue_count ?? "0") > 0)
      alerts.push({ type: "warning", icon: "receipt", title: `${k.overdue_count} فاتورة متأخرة`, body: `المستحقات: ${(parseFloat(k.overdue_total ?? "0") / 100).toLocaleString("ar-SA")} ر.س`, action: "/invoices" });
    if (parseInt(al.expiring_contracts ?? "0") > 0)
      alerts.push({ type: "info", icon: "file", title: `${al.expiring_contracts} عقد ينتهي خلال 30 يوم`, body: "", action: "/contracts" });
    if (parseInt(al.open_cases ?? "0") > 0)
      alerts.push({ type: "primary", icon: "scale", title: `${al.open_cases} قضية مفتوحة`, body: "تحتاج إلى متابعة", action: "/cases" });

    const result = {
      kpis: {
        totalCases,
        activeCases:      parseInt(k.active_cases ?? "0"),
        totalClients:     parseInt(k.total_clients ?? "0"),
        paidRevenue:      parseFloat(k.paid_revenue ?? "0") / 100,
        outstanding:      parseFloat(k.outstanding ?? "0") / 100,
        casesThisMonth:   parseInt(k.cases_this_month ?? "0"),
        clientsThisMonth: parseInt(k.clients_this_month ?? "0"),
        successRate:      totalCases > 0 ? Math.round((closedCases / totalCases) * 100) : 0,
        aiCompleted:      0,
      },
      alerts,
      recentCases:    recentCaseRows.map((c: any) => ({ id: c.id, title: c.title, status: c.status, caseType: c.case_type, createdAt: c.created_at })),
      recentInvoices: recentInvRows.map((i: any) => ({ id: i.id, title: i.title, total: i.total, status: i.status })),
      revenueChart:   chartRows.map((r: any) => ({ month: r.month, revenue: parseFloat(r.revenue) / 100 })),
      upcomingEvents: evRows,
      todayEvents:    todayRows,
    };
    cache.set(cacheKey, result, 60);
    res.json({ ...result, cached: false });
  } catch {
    res.json({ kpis: {}, alerts: [], recentCases: [], recentInvoices: [], revenueChart: [], upcomingEvents: [], todayEvents: [], cached: false });
  }
});

// Keep old endpoints for backward compatibility — rewritten to use SQL aggregation
router.get("/dashboard/stats", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rows = await safeRows(sql`
      SELECT
        (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId})::int                                      AS total_cases,
        (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND status IN ('open','in_progress'))::int AS open_cases,
        (SELECT COUNT(*) FROM cases WHERE office_id = ${tenantId} AND created_at >= ${startOfMonth})::int    AS cases_this_month,
        (SELECT COUNT(*) FROM documents WHERE office_id = ${tenantId})::int                                  AS total_documents,
        (SELECT COUNT(*) FROM documents WHERE office_id = ${tenantId} AND created_at >= ${startOfMonth})::int AS docs_this_month,
        (SELECT COUNT(*) FROM ai_tasks WHERE office_id = ${tenantId} AND status = 'done')::int               AS ai_tasks_completed,
        (SELECT COUNT(*) FROM users WHERE office_id = ${tenantId} AND status = 'active')::int                AS active_users,
        (SELECT COALESCE(SUM(total),0) FROM client_invoices WHERE office_id = ${tenantId} AND status = 'paid' AND created_at >= ${startOfMonth})::float AS monthly_revenue
    `);
    const k = rows[0] ?? {};
    res.json({
      totalCases:       parseInt(k.total_cases ?? "0"),
      openCases:        parseInt(k.open_cases ?? "0"),
      totalDocuments:   parseInt(k.total_documents ?? "0"),
      aiTasksCompleted: parseInt(k.ai_tasks_completed ?? "0"),
      activeUsers:      parseInt(k.active_users ?? "0"),
      monthlyRevenue:   parseFloat(k.monthly_revenue ?? "0") / 100,
      casesThisMonth:   parseInt(k.cases_this_month ?? "0"),
      docsThisMonth:    parseInt(k.docs_this_month ?? "0"),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/recent-activity", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  try {
    const [cases, docs, tasks, msgs] = await Promise.all([
      safeRows(sql`SELECT id, title, created_at FROM cases WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 5`),
      safeRows(sql`SELECT id, file_name, file_type, created_at FROM documents WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 5`),
      safeRows(sql`SELECT id, type, created_at FROM ai_tasks WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 5`),
      safeRows(sql`SELECT id, direction, created_at FROM office_messages WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 5`),
    ]);
    const activity = [
      ...cases.map((c: any) => ({ id: `case-${c.id}`, type: "case_created",       description: `قضية جديدة: ${c.title}`,                               createdAt: c.created_at })),
      ...docs.map((d: any)  => ({ id: `doc-${d.id}`,  type: "document_uploaded",   description: `مستند: ${d.file_name ?? d.file_type}`,                  createdAt: d.created_at })),
      ...tasks.map((t: any) => ({ id: `task-${t.id}`, type: "ai_task_completed",   description: `مهمة ذكاء: ${t.type}`,                                  createdAt: t.created_at })),
      ...msgs.map((m: any)  => ({ id: `msg-${m.id}`,  type: "message_sent",        description: `رسالة ${m.direction === "inbound" ? "واردة" : "صادرة"}`, createdAt: m.created_at })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15);
    res.json(activity);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/dashboard/case-breakdown", requireAuthWithTenant, async (req, res) => {
  try {
    const cases = await db.select().from(casesTable);
    const byType: Record<string, number> = {};
    for (const c of cases) byType[c.caseType] = (byType[c.caseType] ?? 0) + 1;
    res.json({ byType: Object.entries(byType).map(([label, count]) => ({ label, count })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─── GET /dashboard/executive — مركز القيادة التنفيذي ───────────────────── */
router.get("/dashboard/executive", requireAuthWithTenant, async (req, res) => {
  try {
    /* SECURITY: all queries scoped to authenticated tenant only */
    const tenantId = (req as any).tenantId as string;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek  = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const in3Days      = new Date(now.getTime() + 3 * 86400_000).toISOString();

    const [invMetrics, caseMetrics, clientMetrics, empMetrics, aiMetrics] = await Promise.all([
      db.execute(sql`
        SELECT
          COALESCE(SUM(total) FILTER (WHERE status='paid'  AND created_at >= ${startOfToday}::timestamptz), 0) AS today_revenue,
          COALESCE(SUM(total) FILTER (WHERE status='paid'  AND created_at >= ${startOfMonth}::timestamptz), 0) AS month_revenue,
          COALESCE(SUM(total) FILTER (WHERE status NOT IN ('paid','cancelled')), 0)                            AS outstanding,
          COUNT(*)           FILTER (WHERE status='overdue')                                                   AS overdue_count,
          COUNT(*)           FILTER (WHERE status='paid')                                                      AS paid_count,
          COUNT(*)           FILTER (WHERE status != 'cancelled')                                              AS total_count
        FROM client_invoices WHERE office_id = ${tenantId}
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('open','in_progress'))                                           AS active_cases,
          COUNT(*) FILTER (WHERE status IN ('open','in_progress')
            AND next_hearing_date >= ${now.toISOString()}::timestamptz
            AND next_hearing_date <= ${in3Days}::timestamptz)                                                AS critical_cases
        FROM cases WHERE office_id = ${tenantId}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS new_this_week
        FROM clients WHERE office_id = ${tenantId} AND created_at >= ${startOfWeek}::timestamptz
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS active_employees
        FROM employees WHERE office_id = ${tenantId} AND status = 'active'
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS cnt FROM ai_tasks
        WHERE office_id = ${tenantId} AND created_at >= ${startOfMonth}::timestamptz
      `).catch(() => ({ rows: [{ cnt: 0 }] })),
    ]);

    const toNum = (v: any) => Number(v ?? 0);
    const inv  = (invMetrics as any).rows?.[0] ?? {};
    const cas  = (caseMetrics as any).rows?.[0] ?? {};
    const cli  = (clientMetrics as any).rows?.[0] ?? {};
    const emp  = (empMetrics as any).rows?.[0] ?? {};
    const ai   = (aiMetrics as any).rows?.[0] ?? {};

    const overdueCount   = toNum(inv.overdue_count);
    const paidCount      = toNum(inv.paid_count);
    const totalInvCount  = toNum(inv.total_count);
    const criticalCases  = toNum(cas.critical_cases);
    const outstanding    = toNum(inv.outstanding);
    const collectionRate = totalInvCount > 0 ? Math.round((paidCount / totalInvCount) * 100) : 0;

    let healthScore = 100;
    if (overdueCount > 5)    healthScore -= 20;
    if (criticalCases > 3)   healthScore -= 15;
    if (outstanding > 50000) healthScore -= 10;

    res.json({
      todayRevenue:     toNum(inv.today_revenue),
      monthRevenue:     toNum(inv.month_revenue),
      outstanding,
      overdueCount,
      collectionRate,
      activeCases:      toNum(cas.active_cases),
      criticalCases,
      newClientsThisWeek: toNum(cli.new_this_week),
      aiUsageThisMonth:   toNum(ai.cnt),
      activeEmployees:    toNum(emp.active_employees),
      healthScore,
      healthStatus: healthScore >= 80 ? "excellent" : healthScore >= 60 ? "good" : "attention",
    });
  } catch {
    res.json({ todayRevenue: 0, monthRevenue: 0, outstanding: 0, overdueCount: 0, collectionRate: 0, activeCases: 0, criticalCases: 0, newClientsThisWeek: 0, aiUsageThisMonth: 0, activeEmployees: 0, healthScore: 100, healthStatus: "excellent" });
  }
});

/* ─── GET /dashboard/intelligence — Office AI Intelligence ──────────────── */
router.get("/dashboard/intelligence", requireAuthWithTenant, async (req, res) => {
  try {
    const now = new Date();
    const start7  = new Date(now); start7.setDate(now.getDate() - 7);
    const start30 = new Date(now); start30.setDate(now.getDate() - 30);
    const in72h   = new Date(now); in72h.setDate(now.getDate() + 3);

    const tenantId2 = (req as any).tenantId as string;
    const [cases, invoices, clients] = await Promise.all([
      db.select().from(casesTable).then(r => r as any[]),
      db.select().from(invoicesTable).then(r => r as any[]),
      db.select().from(clientsTable).then(r => r as any[]),
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
    const critical = activeCases.filter((c: any) => (c as any).nextHearingDate && new Date((c as any).nextHearingDate) <= in72h);

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

    let expiringContractsCount = 0;
    try {
      const cRows = await safeRows(sql`
        SELECT COUNT(*)::int AS cnt FROM contracts
        WHERE office_id = ${tenantId2}
          AND COALESCE(expires_at, end_date) BETWEEN NOW() AND NOW() + INTERVAL '30 days'
      `);
      expiringContractsCount = parseInt((cRows[0] as any)?.cnt ?? "0");
    } catch {}
    if (expiringContractsCount > 0) {
      smartActions.push({
        priority: 2, urgent: false,
        type: "expiring_contracts",
        title: `${expiringContractsCount} عقد ينتهي خلال 30 يوم`,
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
        res.json({
      scores: { engagement: 50, collection: 50, activity: 50, ai: 0, risk: 80 },
      officeScore: 50, tier: "نشط", tierEn: "Active",
      smartActions: [], clientRisks: [], stats: {},
    });
  }
});

export default router;
