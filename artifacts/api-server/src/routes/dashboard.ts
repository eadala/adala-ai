import { Router } from "express";
import { db, casesTable, documentsTable, aiTasksTable, usersTable, messagesTable, invoicesTable } from "@workspace/db";
import { eq, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const [cases, docs, tasks, users, invoices] = await Promise.all([
      db.select().from(casesTable),
      db.select().from(documentsTable),
      db.select().from(aiTasksTable),
      db.select().from(usersTable),
      db.select().from(invoicesTable),
    ]);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const totalCases = cases.length;
    const openCases = cases.filter((c) => c.status === "open" || c.status === "in_progress").length;
    const totalDocuments = docs.length;
    const aiTasksCompleted = tasks.filter((t) => t.status === "done").length;
    const activeUsers = users.filter((u) => u.status === "active").length;
    const monthlyRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const casesThisMonth = cases.filter((c) => c.createdAt >= startOfMonth).length;
    const docsThisMonth = docs.filter((d) => d.createdAt >= startOfMonth).length;
    res.json({ totalCases, openCases, totalDocuments, aiTasksCompleted, activeUsers, monthlyRevenue, casesThisMonth, docsThisMonth });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const [cases, docs, tasks, msgs] = await Promise.all([
      db.select().from(casesTable).orderBy(casesTable.createdAt).limit(5),
      db.select().from(documentsTable).orderBy(documentsTable.createdAt).limit(5),
      db.select().from(aiTasksTable).orderBy(aiTasksTable.createdAt).limit(5),
      db.select().from(messagesTable).orderBy(messagesTable.createdAt).limit(5),
    ]);
    const activity = [
      ...cases.map((c) => ({ id: `case-${c.id}`, type: "case", description: `قضية جديدة: ${c.title}`, entityId: c.id, createdAt: c.createdAt.toISOString() })),
      ...docs.map((d) => ({ id: `doc-${d.id}`, type: "document", description: `مستند مرفوع: ${d.fileName ?? d.fileType}`, entityId: d.id, createdAt: d.createdAt.toISOString() })),
      ...tasks.map((t) => ({ id: `task-${t.id}`, type: "ai_task", description: `مهمة ذكاء اصطناعي: ${t.type} — ${t.status}`, entityId: t.id, createdAt: t.createdAt.toISOString() })),
      ...msgs.map((m) => ({ id: `msg-${m.id}`, type: "message", description: `رسالة ${m.channel} ${m.direction === "inbound" ? "واردة" : "صادرة"}`, entityId: m.id, createdAt: m.createdAt.toISOString() })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15);
    res.json(activity);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/dashboard/case-breakdown", async (req, res) => {
  try {
    const cases = await db.select().from(casesTable);
    const statusMap: Record<string, string> = { open: "مفتوحة", in_progress: "قيد التنفيذ", closed: "مغلقة" };
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const c of cases) {
      const label = statusMap[c.status] ?? c.status;
      byStatus[label] = (byStatus[label] ?? 0) + 1;
      byType[c.caseType] = (byType[c.caseType] ?? 0) + 1;
    }
    res.json({
      byStatus: Object.entries(byStatus).map(([label, count]) => ({ label, count })),
      byType: Object.entries(byType).map(([label, count]) => ({ label, count })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
