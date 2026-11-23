import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import {
  db, casesTable, documentsTable, aiTasksTable, usersTable,
  clientInvoicesTable as invoicesTable, clientsTable, contractsTable, messagesTable,
  rolesTable, invitationsTable, auditLogsTable,
} from "@workspace/db";
import { desc, eq, and, gte, sql, count, sum } from "drizzle-orm";

const router = Router();

/* ── Full Firm Overview ───────────────────────────── */
router.get("/firm-admin/overview", requireAuthWithTenant, async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [cases, users, _inv, clients, contracts, aiTasks, docs, messages] = await Promise.all([
      db.select().from(casesTable),
      db.select().from(usersTable),
      db.select().from(invoicesTable),
      db.select().from(clientsTable),
      db.select().from(contractsTable),
      db.select().from(aiTasksTable),
      db.select().from(documentsTable),
      db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)).limit(20),
    ]);
    const invoices = _inv as any[];

    // KPIs
    const activeCases = cases.filter(c => ["open","in_progress"].includes(c.status)).length;
    const closedCases = cases.filter(c => c.status === "closed").length;
    const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0);
    const outstanding = invoices.filter(i => !["paid","cancelled"].includes(i.status)).reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0);
    const activeUsers = users.filter(u => u.status === "active").length;
    const aiDone = aiTasks.filter(t => t.status === "done").length;

    // Month-over-month
    const casesThisMonth = cases.filter(c => c.createdAt >= startOfMonth).length;
    const casesLastMonth = cases.filter(c => c.createdAt >= startOfLastMonth && c.createdAt < endOfLastMonth).length;
    const revenueThisMonth = invoices.filter(i => i.status === "paid" && new Date(i.createdAt) >= startOfMonth).reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0);
    const revenueLastMonth = invoices.filter(i => i.status === "paid" && new Date(i.createdAt) >= startOfLastMonth && new Date(i.createdAt) < endOfLastMonth).reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0);
    const clientsThisMonth = clients.filter(c => c.createdAt >= startOfMonth).length;
    const successRate = cases.length > 0 ? Math.round((closedCases / cases.length) * 100) : 0;

    // Case by status
    const caseByStatus = {
      open: cases.filter(c => c.status === "open").length,
      in_progress: cases.filter(c => c.status === "in_progress").length,
      closed: cases.filter(c => c.status === "closed").length,
      on_hold: cases.filter(c => c.status === "on_hold").length,
    };

    // Case by type (top 6)
    const caseByType: Record<string, number> = {};
    for (const c of cases) {
      if (c.caseType) caseByType[c.caseType] = (caseByType[c.caseType] ?? 0) + 1;
    }
    const topTypes = Object.entries(caseByType)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    // Monthly revenue last 6 months
    const monthlyRevenue: Record<string, number> = {};
    const monthlyCases: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString("ar-SA", { month: "short" });
      monthlyRevenue[key] = 0;
      monthlyCases[key] = 0;
    }
    invoices.filter(i => i.status === "paid").forEach(inv => {
      const d = new Date(inv.createdAt);
      const mo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      if (d >= mo) {
        const key = d.toLocaleDateString("ar-SA", { month: "short" });
        if (monthlyRevenue[key] !== undefined) monthlyRevenue[key] += (inv.total ?? inv.amount ?? 0) / 100;
      }
    });
    cases.forEach(c => {
      const d = new Date(c.createdAt);
      const mo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      if (d >= mo) {
        const key = d.toLocaleDateString("ar-SA", { month: "short" });
        if (monthlyCases[key] !== undefined) monthlyCases[key]++;
      }
    });
    const charts = Object.keys(monthlyRevenue).map(month => ({
      month,
      revenue: Math.round(monthlyRevenue[month]),
      cases: monthlyCases[month] ?? 0,
    }));

    // Per-lawyer performance
    const ROLE_LABELS: Record<string, string> = { admin: "مدير", lawyer: "محامٍ", paralegal: "مساعد", viewer: "مراقب" };
    const lawyerStats = users.map(u => {
      const userCases = cases.filter(c => c.assignedTo === u.id || c.assignedTo === (u as any).clerkId);
      const userInvoices = invoices.filter(i => i.status === "paid");
      const userAI = aiTasks.filter(t => (t as any).userId === u.id || (t as any).userId === (u as any).clerkId);
      return {
        id: u.id, name: u.fullName ?? u.email, email: u.email,
        role: u.role, roleLabel: ROLE_LABELS[u.role ?? "viewer"] ?? u.role,
        status: u.status,
        totalCases: userCases.length,
        activeCases: userCases.filter(c => ["open","in_progress"].includes(c.status)).length,
        closedCases: userCases.filter(c => c.status === "closed").length,
        aiTasks: userAI.length,
        avatar: u.fullName ? u.fullName.slice(0, 2) : (u.email?.slice(0, 2) ?? "؟"),
      };
    });

    // Recent activity from audit logs
    let recentActivity: any[] = [];
    try {
      recentActivity = await db.select().from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt)).limit(15);
    } catch {}

    // Invoice summary
    const invoiceSummary = {
      total: invoices.length,
      paid: invoices.filter(i => i.status === "paid").length,
      pending: invoices.filter(i => i.status === "pending").length,
      overdue: invoices.filter(i => i.status === "overdue").length,
      totalAmount: invoices.reduce((s, i) => s + (i.total ?? i.amount ?? 0), 0) / 100,
      paidAmount: totalRevenue / 100,
      outstandingAmount: outstanding / 100,
    };

    // Expiring contracts
    const in30Days = new Date(now); in30Days.setDate(now.getDate() + 30);
    const expiringContracts = contracts.filter(c => {
      const exp = c.expiresAt ?? (c as any).endDate;
      if (!exp) return false;
      const d = new Date(exp);
      return d > now && d <= in30Days;
    }).map(c => ({ id: c.id, title: c.title, expiresAt: (c as any).expiresAt ?? (c as any).endDate }));

    // Recent cases
    const recentCases = cases
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map(c => ({ id: c.id, title: c.title, status: c.status, caseType: c.caseType, createdAt: c.createdAt }));

    // Recent invoices
    const recentInvoices = invoices
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(i => ({ id: i.id, title: i.title, total: (i.total ?? i.amount ?? 0) / 100, status: i.status, createdAt: i.createdAt }));

    res.json({
      kpis: {
        activeCases, closedCases, totalCases: cases.length,
        totalRevenue: totalRevenue / 100, outstanding: outstanding / 100,
        totalClients: clients.length, clientsThisMonth,
        activeUsers, totalUsers: users.length,
        aiDone, totalAiTasks: aiTasks.length,
        totalDocuments: docs.length, successRate,
        casesThisMonth, casesLastMonth,
        revenueThisMonth: revenueThisMonth / 100, revenueLastMonth: revenueLastMonth / 100,
      },
      caseByStatus,
      topTypes,
      charts,
      lawyerStats,
      invoiceSummary,
      expiringContracts,
      recentCases,
      recentInvoices,
      recentActivity,
    });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

export default router;
