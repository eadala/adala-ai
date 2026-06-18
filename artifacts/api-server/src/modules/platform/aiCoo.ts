import { Router } from "express";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "../ai/aiChat";

const router = Router();

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

router.get("/ai-coo/overview", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const [casesRaw, casesStatusRaw, employeesRaw, invoicesRaw, tasksRaw, tasksOverdueRaw] =
      await Promise.all([
        db.execute(sql`
          SELECT
            COUNT(*)::int                                                                    AS total,
            COUNT(CASE WHEN status NOT IN ('closed','won','lost') THEN 1 END)::int          AS active,
            COUNT(CASE WHEN next_hearing_date < NOW()
                        AND status NOT IN ('closed','won','lost') THEN 1 END)::int          AS overdue
          FROM cases WHERE office_id = ${tenantId}
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT status, COUNT(*)::int AS cnt
          FROM cases WHERE office_id = ${tenantId}
          GROUP BY status
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT e.id, e.full_name, e.job_title, e.department,
                 COUNT(c.id)::int AS case_count
          FROM employees e
          LEFT JOIN cases c
            ON c.assigned_to = e.id::text
           AND c.status NOT IN ('closed','won','lost')
           AND c.office_id = ${tenantId}
          WHERE e.office_id = ${tenantId} AND e.status = 'active'
          GROUP BY e.id, e.full_name, e.job_title, e.department
          ORDER BY case_count DESC
          LIMIT 20
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT
            COUNT(*)::int                                                                AS total,
            COUNT(CASE WHEN status = 'paid'    THEN 1 END)::int                        AS paid_count,
            COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int                        AS overdue_count,
            COUNT(CASE WHEN status = 'pending' THEN 1 END)::int                        AS pending_count,
            COALESCE(SUM(CASE WHEN status = 'paid'
              AND created_at >= DATE_TRUNC('month', NOW()) THEN total ELSE 0 END),0)::float AS monthly_revenue,
            COALESCE(SUM(CASE WHEN status = 'overdue' THEN total ELSE 0 END),0)::float AS overdue_amount,
            COALESCE(SUM(total),0)::float                                               AS total_amount
          FROM client_invoices WHERE office_id = ${tenantId}
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT priority, COUNT(*)::int AS cnt
          FROM tasks WHERE office_id = ${tenantId} AND status != 'done'
          GROUP BY priority
        `).catch(() => ({ rows: [] })),

        db.execute(sql`
          SELECT COUNT(*)::int AS cnt
          FROM tasks
          WHERE office_id = ${tenantId}
            AND status != 'done'
            AND due_date < CURRENT_DATE
        `).catch(() => ({ rows: [] })),
      ]);

    /* ── Cases ── */
    const cr = ((casesRaw.rows ?? [])[0] ?? {}) as any;
    const totalCases  = parseInt(cr.total  ?? 0);
    const activeCases = parseInt(cr.active ?? 0);
    const overdueCases = parseInt(cr.overdue ?? 0);
    const byStatus: Record<string, number> = {};
    for (const r of (casesStatusRaw.rows ?? []) as any[]) byStatus[r.status] = r.cnt;
    const casesScore = clamp(totalCases === 0 ? 100 : 100 - (overdueCases / Math.max(totalCases, 1)) * 160);

    /* ── HR ── */
    const empRows = (employeesRaw.rows ?? []) as any[];
    const totalEmp   = empRows.length;
    const highLoadEmp = empRows.filter(e => e.case_count >= 15).length;
    const medLoadEmp  = empRows.filter(e => e.case_count >= 8 && e.case_count < 15).length;
    const hrScore = clamp(totalEmp === 0 ? 100 : 100 - (highLoadEmp / Math.max(totalEmp, 1)) * 130);
    const employees = empRows.slice(0, 12).map(e => ({
      id:        e.id,
      name:      e.full_name  ?? "موظف",
      title:     e.job_title  ?? "",
      dept:      e.department ?? "",
      caseCount: e.case_count ?? 0,
      load:      e.case_count >= 15 ? "high" : e.case_count >= 8 ? "medium" : "low",
    }));

    /* ── Finance ── */
    const fr = ((invoicesRaw.rows ?? [])[0] ?? {}) as any;
    const monthlyRevenue = parseFloat(fr.monthly_revenue ?? 0);
    const overdueAmount  = parseFloat(fr.overdue_amount  ?? 0);
    const totalAmount    = parseFloat(fr.total_amount    ?? 0);
    const paidCount      = parseInt(fr.paid_count    ?? 0);
    const overdueCount   = parseInt(fr.overdue_count ?? 0);
    const pendingCount   = parseInt(fr.pending_count ?? 0);
    const finScore = clamp(totalAmount === 0 ? 100 : 100 - (overdueAmount / Math.max(totalAmount, 1)) * 220);

    /* ── Tasks ── */
    const taskRows = (tasksRaw.rows ?? []) as any[];
    const byPriority: Record<string, number> = {};
    let totalTasks = 0, urgentTasks = 0;
    for (const r of taskRows) { byPriority[r.priority] = r.cnt; totalTasks += r.cnt; if (r.priority === "urgent") urgentTasks += r.cnt; }
    const overdueTasks = parseInt(((tasksOverdueRaw.rows ?? [])[0] as any)?.cnt ?? 0);
    const tasksScore = clamp(totalTasks === 0 ? 100 : 100 - (overdueTasks / Math.max(totalTasks, 1)) * 160);

    const healthScore = Math.round((casesScore + hrScore + finScore + tasksScore) / 4);

    /* ── Alerts ── */
    const alerts: { level: string; domain: string; message: string }[] = [];
    if (overdueCases > 0)   alerts.push({ level: overdueCases > 5   ? "critical" : "warning", domain: "cases",   message: `${overdueCases} قضية تجاوزت تاريخ الجلسة — مراجعة فورية مطلوبة` });
    if (highLoadEmp  > 0)   alerts.push({ level: highLoadEmp  > 3   ? "critical" : "warning", domain: "hr",      message: `${highLoadEmp} موظف بضغط عالٍ (أكثر من 15 قضية نشطة)` });
    if (overdueAmount > 0)  alerts.push({ level: overdueAmount > 15000 ? "critical" : "warning", domain: "finance", message: `فواتير متأخرة بقيمة ${overdueAmount.toLocaleString("ar-SA")} ريال` });
    if (overdueTasks > 0)   alerts.push({ level: overdueTasks > 10  ? "critical" : "warning", domain: "tasks",   message: `${overdueTasks} مهمة تجاوزت تاريخ الاستحقاق` });
    if (urgentTasks  > 0)   alerts.push({ level: "warning", domain: "tasks",   message: `${urgentTasks} مهمة عاجلة تنتظر التنفيذ` });
    if (pendingCount > 5)   alerts.push({ level: "warning", domain: "finance", message: `${pendingCount} فاتورة معلقة لم تُسدَّد بعد` });
    if (healthScore >= 85)  alerts.push({ level: "info",    domain: "overview", message: `الأداء التشغيلي ممتاز — المنظومة تعمل بكفاءة عالية` });

    /* ── AI Summary ── */
    let aiSummary = "";
    let recommendations: string[] = [];
    try {
      const prompt = `أنت نظام AI COO (مدير تنفيذي ذكي) لمكتب محاماة. بناءً على البيانات التشغيلية التالية:

• القضايا: ${totalCases} إجمالي | ${activeCases} نشطة | ${overdueCases} متأخرة
• الموظفون: ${totalEmp} موظف نشط | ${highLoadEmp} بضغط عالٍ | ${medLoadEmp} بضغط متوسط
• المالية: ${monthlyRevenue.toLocaleString("ar-SA")} ريال إيرادات هذا الشهر | ${overdueAmount.toLocaleString("ar-SA")} ريال فواتير متأخرة
• المهام: ${totalTasks} مهمة نشطة | ${overdueTasks} متأخرة | ${urgentTasks} عاجلة
• درجة الصحة التشغيلية: ${healthScore}/100

قدّم:
1. ملخصاً تنفيذياً (3 جمل فقط) عن الوضع العام
2. أبرز 3 توصيات قابلة للتنفيذ، ابدأ كل توصية بـ "•"

أجب باللغة العربية فقط، بأسلوب مدير تنفيذي موجز واحترافي.`;

      const raw = await callAI({ prompt, maxTokens: 350, temperature: 0.35 });
      const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
      const recIdx = lines.findIndex(l => l.startsWith("•") || l.match(/^\d\./));
      if (recIdx > 0) {
        aiSummary = lines.slice(0, recIdx).join(" ");
        recommendations = lines.filter(l => l.startsWith("•") || l.match(/^\d\./))
          .map(l => l.replace(/^[•\d\.]\s*/, "").trim()).filter(Boolean);
      } else {
        aiSummary = lines.join(" ");
      }
    } catch {
      aiSummary = healthScore >= 80
        ? `المنظومة التشغيلية تعمل بكفاءة عالية بدرجة صحة ${healthScore}/100.`
        : `درجة الصحة التشغيلية ${healthScore}/100 — توجد نقاط تحتاج مراجعة.`;
      recommendations = [
        overdueCases   > 0 ? `مراجعة القضايا المتأخرة (${overdueCases} قضية)` : null,
        highLoadEmp    > 0 ? `إعادة توزيع القضايا على الموظفين المثقلين` : null,
        overdueAmount  > 0 ? `متابعة تحصيل الفواتير المتأخرة` : null,
      ].filter(Boolean) as string[];
    }

    res.json({
      healthScore,
      domains: {
        cases:   { score: casesScore,  total: totalCases, active: activeCases, overdue: overdueCases, byStatus },
        hr:      { score: hrScore,     total: totalEmp,   highLoad: highLoadEmp, medLoad: medLoadEmp, employees },
        finance: { score: finScore,    monthlyRevenue, overdueAmount, totalAmount, paidCount, overdueCount, pendingCount },
        tasks:   { score: tasksScore,  total: totalTasks, overdue: overdueTasks, urgent: urgentTasks, byPriority },
      },
      alerts,
      aiSummary,
      recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/ai-coo/ask", requireAuthWithTenant, async (req, res) => {
  const { question, context } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: "السؤال مطلوب" });
  try {
    const prompt = `أنت نظام AI COO لمكتب محاماة — مستشار تنفيذي ذكي.
${context ? `السياق التشغيلي الحالي:\n${context}\n` : ""}
سؤال المدير: ${question}

أجب بشكل مختصر واحترافي (3-5 جمل) باللغة العربية.`;
    const reply = await callAI({ prompt, maxTokens: 280, temperature: 0.45 });
    res.json({ reply: reply.trim() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
