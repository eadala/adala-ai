import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import { callAI } from "./aiChat";
import * as os from "os";

const router = Router();
const devCmd = requireSuperAdmin;

let _clerk: ReturnType<typeof createClerkClient> | null = null;
const getClerk = () => {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
};
/* ── GET /dev-commander/scan ─────────────────────────────────────────────── */
router.get("/dev-commander/scan", devCmd, async (_req, res) => {
  try {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPct = Math.round((1 - freeMem / totalMem) * 100);
    const cpuLoad = os.loadavg()[0];

    const [
      tableStats,
      recentErrors,
      nullCounts,
      dbStats,
      tenantCount,
      eventStats,
    ] = await Promise.all([
      // Table sizes + row counts
      db.execute(sql`
        SELECT schemaname, tablename,
               pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
               n_live_tup as rows
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),

      // Recent error events from system_events
      db.execute(sql`
        SELECT event_type, COUNT(*) as count, MAX(created_at) as last_at
        FROM system_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND event_type ILIKE '%error%'
        GROUP BY event_type ORDER BY count DESC LIMIT 10
      `).catch(() => ({ rows: [] })),

      // NULL office_id in critical tables
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM cases WHERE office_id IS NULL)::int as cases_null,
          (SELECT COUNT(*) FROM clients WHERE office_id IS NULL)::int as clients_null,
          (SELECT COUNT(*) FROM contracts WHERE office_id IS NULL)::int as contracts_null,
          (SELECT COUNT(*) FROM client_invoices WHERE office_id IS NULL)::int as invoices_null,
          (SELECT COUNT(*) FROM employees WHERE office_id IS NULL)::int as employees_null
      `).catch(() => ({ rows: [{ cases_null:0, clients_null:0, contracts_null:0, invoices_null:0, employees_null:0 }] })),

      // DB connection info
      db.execute(sql`
        SELECT COUNT(*) as active_connections
        FROM pg_stat_activity WHERE state = 'active'
      `).catch(() => ({ rows: [{ active_connections: 0 }] })),

      // Office count
      db.execute(sql`
        SELECT
          COUNT(DISTINCT op.id) as offices,
          COUNT(DISTINCT om.user_id) as users,
          (SELECT COUNT(*) FROM cases) as total_cases,
          (SELECT COUNT(*) FROM client_invoices WHERE status != 'paid') as unpaid_invoices
        FROM office_page op
        LEFT JOIN office_members om ON om.office_id::text = op.id::text
      `).catch(() => ({ rows: [{ offices: 0, users: 0, total_cases: 0, unpaid_invoices: 0 }] })),

      // Event bus stats
      db.execute(sql`
        SELECT event_type, COUNT(*) as count
        FROM system_events
        WHERE created_at > NOW() - INTERVAL '1 hour'
        GROUP BY event_type ORDER BY count DESC LIMIT 10
      `).catch(() => ({ rows: [] })),
    ]);

    const nullRow = nullCounts.rows[0] as any ?? {};
    const tenantRow = tenantCount.rows[0] as any ?? {};
    const dbRow = dbStats.rows[0] as any ?? {};

    const diagnostics = {
      timestamp: new Date().toISOString(),
      system: {
        memoryUsedPct: memPct,
        memoryHeapMB: Math.round(mem.heapUsed / 1024 / 1024),
        memoryHeapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        cpuLoad1m: Math.round(cpuLoad * 100) / 100,
        nodeEnv: process.env.NODE_ENV ?? "unknown",
        uptime: Math.round(process.uptime() / 60),
      },
      database: {
        activeConnections: Number(dbRow.active_connections ?? 0),
        tables: (tableStats.rows as any[]).map(r => ({
          name: r.tablename, size: r.size, rows: Number(r.rows ?? 0),
        })),
      },
      tenantIsolation: {
        casesNull: Number(nullRow.cases_null ?? 0),
        clientsNull: Number(nullRow.clients_null ?? 0),
        contractsNull: Number(nullRow.contracts_null ?? 0),
        invoicesNull: Number(nullRow.invoices_null ?? 0),
        employeesNull: Number(nullRow.employees_null ?? 0),
        isolationScore: 100, // will be recalculated
      },
      platform: {
        offices: Number(tenantRow.offices ?? 0),
        users: Number(tenantRow.users ?? 0),
        totalCases: Number(tenantRow.total_cases ?? 0),
        unpaidInvoices: Number(tenantRow.unpaid_invoices ?? 0),
      },
      recentErrors: (recentErrors.rows as any[]).map(r => ({
        type: r.event_type, count: Number(r.count), lastAt: r.last_at,
      })),
      eventStats: (eventStats.rows as any[]).map(r => ({
        type: r.event_type, count: Number(r.count),
      })),
    };

    // Calculate isolation score
    const nullTotal = diagnostics.tenantIsolation.casesNull +
      diagnostics.tenantIsolation.clientsNull +
      diagnostics.tenantIsolation.contractsNull +
      diagnostics.tenantIsolation.invoicesNull +
      diagnostics.tenantIsolation.employeesNull;
    diagnostics.tenantIsolation.isolationScore = nullTotal === 0 ? 100 : Math.max(0, 100 - nullTotal * 2);

    // AI analysis
    const aiPrompt = `بناءً على بيانات التشخيص التالية من منصة عدالة AI، حلل الوضع وأعطِ:
1. ملخص صحة المنصة (جملة واحدة)
2. أهم 3 مشاكل مكتشفة (إن وجدت) بتصنيف الخطورة
3. 3 توصيات عملية فورية

بيانات التشخيص:
- استهلاك الذاكرة: ${diagnostics.system.memoryUsedPct}%
- حمل المعالج: ${diagnostics.system.cpuLoad1m}
- مدة التشغيل: ${diagnostics.system.uptime} دقيقة
- عدد المكاتب: ${diagnostics.platform.offices}
- المستخدمون: ${diagnostics.platform.users}
- إجمالي القضايا: ${diagnostics.platform.totalCases}
- فواتير غير مدفوعة: ${diagnostics.platform.unpaidInvoices}
- عزل البيانات: ${diagnostics.tenantIsolation.isolationScore}%
- أخطاء حديثة: ${diagnostics.recentErrors.length > 0 ? JSON.stringify(diagnostics.recentErrors) : 'لا توجد'}
- سجلات NULL للمكاتب: cases=${diagnostics.tenantIsolation.casesNull}, clients=${diagnostics.tenantIsolation.clientsNull}

أجب باختصار ووضوح. استخدم 🔴🟠🟡🟢 لتصنيف الخطورة.`;

    let aiAnalysis = "";
    try {
      const { reply } = await callAI(
        "أنت Development Commander لمنصة عدالة AI. تحلل بيانات التشخيص وتقدم تقارير تقنية موجزة.",
        aiPrompt
      );
      aiAnalysis = reply;
    } catch { aiAnalysis = "تعذر التحليل الذكي — راجع البيانات يدوياً."; }

    res.json({ diagnostics, aiAnalysis });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /dev-commander/proposals ───────────────────────────────────────── */
router.get("/dev-commander/proposals", devCmd, async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const rows = await db.execute(sql`
      SELECT * FROM dev_commander_proposals
      WHERE status = ${String(status)}
      ORDER BY created_at DESC LIMIT 50
    `);
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /dev-commander/proposals ──────────────────────────────────────── */
router.post("/dev-commander/proposals", devCmd, async (req, res) => {
  try {
    const { title, description, severity, category, affected, fix_type, fix_payload } = req.body;
    const row = await db.execute(sql`
      INSERT INTO dev_commander_proposals (id, title, description, severity, category, affected, fix_type, fix_payload)
      VALUES (gen_random_uuid()::text, ${title}, ${description}, ${severity ?? "medium"},
              ${category}, ${affected ?? null}, ${fix_type}, ${fix_payload ? JSON.stringify(fix_payload) : null}::jsonb)
      RETURNING *
    `);
    res.json(row.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /dev-commander/proposals/:id/approve ──────────────────────────── */
router.post("/dev-commander/proposals/:id/approve", devCmd, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const auth = getAuth(req);

    const rows = await db.execute(sql`SELECT * FROM dev_commander_proposals WHERE id = ${id}`);
    const proposal = rows.rows[0] as any;
    if (!proposal) return res.status(404).json({ error: "الاقتراح غير موجود" });
    if (proposal.status !== "pending") return res.status(400).json({ error: "الاقتراح لم يعد معلقاً" });

    let result = "تم الاعتماد";
    // Execute safe fix types automatically
    if (proposal.fix_type === "sql_safe" && proposal.fix_payload?.query) {
      try {
        await db.execute(sql.raw(proposal.fix_payload.query));
        result = "تم التنفيذ: استعلام SQL آمن";
      } catch (sqlErr: any) {
        result = `فشل التنفيذ: ${sqlErr.message}`;
      }
    }

    await db.execute(sql`
      UPDATE dev_commander_proposals
      SET status = 'approved', approved_by = ${auth?.userId ?? "unknown"},
          approved_at = NOW(), executed_at = NOW(), result = ${result}
      WHERE id = ${id}
    `);

    // Log to audit_logs
    await db.execute(sql`
      INSERT INTO audit_logs (id, user_id, action, resource, resource_id, details, created_at)
      VALUES (gen_random_uuid()::text, ${auth?.userId ?? "unknown"}, 'dev_proposal_approved',
              'dev_commander_proposals', ${id}, ${JSON.stringify({ title: proposal.title, fix_type: proposal.fix_type, result })}::jsonb, NOW())
    `).catch(() => {});

    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /dev-commander/proposals/:id/reject ───────────────────────────── */
router.post("/dev-commander/proposals/:id/reject", devCmd, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const auth = getAuth(req);
    const { reason } = req.body;
    await db.execute(sql`
      UPDATE dev_commander_proposals
      SET status = 'rejected', approved_by = ${auth?.userId ?? "unknown"},
          approved_at = NOW(), result = ${reason ?? "رُفض من المشرف"}
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /dev-commander/ai-analyze ────────────────────────────────────── */
router.post("/dev-commander/ai-analyze", devCmd, async (req, res) => {
  try {
    const { message, diagnostics } = req.body;
    const systemPrompt = `أنت Development Commander لمنصة عدالة AI.
لديك بيانات التشخيص الكاملة للمنصة. مهمتك: تحليل المشاكل، اقتراح الحلول، لكن لا تنفذ أي شيء بدون موافقة.
إذا اقترحت إصلاحاً برمجياً، اذكره بوضوح في الشكل التالي:
[PROPOSAL]
العنوان: ...
الوصف: ...
الخطورة: حرجة/عالية/متوسطة/منخفضة
الفئة: database/security/performance/frontend/backend
المتأثر: ...
[/PROPOSAL]`;

    const context = diagnostics ? `\n\nبيانات التشخيص:\n${JSON.stringify(diagnostics, null, 2)}` : "";
    const { reply } = await callAI(systemPrompt, message + context);

    // Auto-extract proposals from AI reply
    const proposalMatches = reply.match(/\[PROPOSAL\]([\s\S]*?)\[\/PROPOSAL\]/g) ?? [];
    const proposals = proposalMatches.map((m: string) => {
      const body = m.replace(/\[PROPOSAL\]|\[\/PROPOSAL\]/g, "").trim();
      const get = (key: string) => body.match(new RegExp(`${key}:\\s*(.+)`))?.[1]?.trim() ?? "";
      return {
        title: get("العنوان"), description: get("الوصف"),
        severity: { "حرجة": "critical", "عالية": "high", "متوسطة": "medium", "منخفضة": "low" }[get("الخطورة")] ?? "medium",
        category: get("الفئة"), affected: get("المتأثر"), fix_type: "manual",
      };
    });

    res.json({ reply, proposals });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
