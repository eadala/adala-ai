/**
 * Adala AI — Multi-Agent Runtime Engine
 * محرك الوكلاء الذكيين — طبقة التشغيل المستقلة
 *
 * Agents: Legal | Finance | Risk | System | HR
 * Orchestrator resolves conflicts → AUTO_EXECUTE | RECOMMEND | REQUIRE_APPROVAL
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth, createClerkClient } from "@clerk/express";
import * as os from "os";

const router = Router();
export default router;

/* ── helpers ── */
function sqlRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
async function q(query: any): Promise<any[]> {
  try { return sqlRows(await db.execute(query)); } catch { return []; }
}

let _clerk: any = null;
function getClerk() {
  if (!_clerk) _clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk;
}

async function isSuperAdmin(req: any): Promise<boolean> {
  const auth = getAuth(req);
  if (!auth?.userId) return false;
  try {
    const user = await getClerk().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const meta = user.publicMetadata as any;
    const owner = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    return (!!owner && email === owner) || meta?.role === "super_admin";
  } catch { return false; }
}

async function agentOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req)))
    return res.status(403).json({ error: "غير مصرح — نظام الوكلاء لمالك المنصة فقط" });
  next();
}

/* ═══════════════════════════════════════════════════
   DB SETUP
═══════════════════════════════════════════════════ */
(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_agents (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        name_ar     TEXT NOT NULL,
        type        TEXT NOT NULL,
        description TEXT,
        status      TEXT DEFAULT 'active',
        last_run    TIMESTAMPTZ,
        run_count   INTEGER DEFAULT 0,
        memory      JSONB DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS agent_actions (
        id           BIGSERIAL PRIMARY KEY,
        agent_id     TEXT NOT NULL,
        event_type   TEXT NOT NULL,
        decision     TEXT NOT NULL,
        title        TEXT NOT NULL,
        body         TEXT,
        payload      JSONB DEFAULT '{}',
        severity     TEXT DEFAULT 'info',
        status       TEXT DEFAULT 'pending',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        resolved_at  TIMESTAMPTZ
      );

      INSERT INTO ai_agents (id, name, name_ar, type, description) VALUES
        ('legal',   'Legal Agent',   'الوكيل القانوني', 'legal',   'يراقب القضايا والمواعيد والمستندات القانونية'),
        ('finance', 'Finance Agent', 'الوكيل المالي',   'finance', 'يراقب الفواتير والتدفق المالي والتحصيل'),
        ('risk',    'Risk Agent',    'وكيل المخاطر',    'risk',    'يحسب درجة المخاطرة ويكتشف الأنماط غير الطبيعية'),
        ('system',  'System Agent',  'وكيل النظام',     'system',  'يراقب أداء المنصة والأخطاء والموارد'),
        ('hr',      'HR Agent',      'وكيل الموارد البشرية', 'hr', 'يراقب الأداء والحضور وتوزيع المهام')
      ON CONFLICT (id) DO NOTHING;
    `);
  } catch {}
})();

/* ═══════════════════════════════════════════════════
   AGENT RUNNERS
═══════════════════════════════════════════════════ */

type AgentDecision = "AUTO_EXECUTE" | "RECOMMEND" | "REQUIRE_APPROVAL";
interface AgentResult {
  agentId:    string;
  eventType:  string;
  title:      string;
  body:       string;
  severity:   "critical" | "high" | "medium" | "low" | "info";
  decision:   AgentDecision;
  payload:    any;
}

/* ── Legal Agent ── */
async function runLegalAgent(): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  try {
    // Approaching deadlines (next 72h)
    const upcoming = await q(sql`
      SELECT c.id, c.title, c.next_session_date, o.name AS office
      FROM cases c
      LEFT JOIN offices o ON o.id = c.office_id
      WHERE c.next_session_date BETWEEN NOW() AND NOW() + INTERVAL '72 hours'
        AND c.status = 'open'
    `);
    for (const c of upcoming) {
      const hrs = Math.round((new Date(c.next_session_date).getTime() - Date.now()) / 3600000);
      results.push({
        agentId: "legal", eventType: "CASE_SESSION_APPROACHING",
        title: `جلسة قضية خلال ${hrs} ساعة`,
        body: `"${c.title}" — مكتب: ${c.office ?? "غير محدد"} • الجلسة بعد ${hrs} ساعة`,
        severity: hrs < 24 ? "critical" : "high",
        decision: "RECOMMEND",
        payload: { caseId: c.id, hoursLeft: hrs },
      });
    }

    // Cases with no update for 30+ days
    const stale = await q(sql`
      SELECT c.id, c.title, c.updated_at, o.name AS office
      FROM cases c
      LEFT JOIN offices o ON o.id = c.office_id
      WHERE c.status = 'open'
        AND c.updated_at < NOW() - INTERVAL '30 days'
      LIMIT 10
    `);
    for (const c of stale) {
      const days = Math.round((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
      results.push({
        agentId: "legal", eventType: "CASE_STALE",
        title: `قضية بدون تحديث ${days} يوم`,
        body: `"${c.title}" لم تُحدَّث منذ ${days} يوماً — مكتب: ${c.office ?? "غير محدد"}`,
        severity: days > 60 ? "high" : "medium",
        decision: "RECOMMEND",
        payload: { caseId: c.id, daysSinceUpdate: days },
      });
    }
  } catch {}
  return results;
}

/* ── Finance Agent ── */
async function runFinanceAgent(): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  try {
    // Overdue invoices > 7 days
    const overdue = await q(sql`
      SELECT i.id, i.invoice_number, i.total_amount, i.due_date, o.name AS office
      FROM client_invoices i
      LEFT JOIN offices o ON o.id = i.office_id
      WHERE i.status IN ('unpaid', 'overdue')
        AND i.due_date < NOW() - INTERVAL '7 days'
      ORDER BY i.total_amount DESC
      LIMIT 15
    `);
    for (const inv of overdue) {
      const days = Math.round((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
      const amt  = Number(inv.total_amount ?? 0);
      results.push({
        agentId: "finance", eventType: "INVOICE_OVERDUE",
        title: `فاتورة متأخرة ${days} يوم — ${amt.toLocaleString("ar-SA")} ر.س`,
        body: `رقم ${inv.invoice_number} • مكتب: ${inv.office ?? "غير محدد"} • تأخير ${days} يوم`,
        severity: days > 30 ? "critical" : amt > 10000 ? "high" : "medium",
        decision: amt > 50000 ? "REQUIRE_APPROVAL" : "AUTO_EXECUTE",
        payload: { invoiceId: inv.id, amount: amt, daysOverdue: days },
      });
    }

    // High outstanding per office
    const outstanding = await q(sql`
      SELECT o.id, o.name,
        SUM(i.total_amount) FILTER (WHERE i.status IN ('unpaid','overdue')) AS total_out
      FROM offices o
      LEFT JOIN client_invoices i ON i.office_id = o.id
      GROUP BY o.id, o.name
      HAVING SUM(i.total_amount) FILTER (WHERE i.status IN ('unpaid','overdue')) > 50000
      ORDER BY total_out DESC
      LIMIT 5
    `);
    for (const off of outstanding) {
      const amt = Number(off.total_out ?? 0);
      results.push({
        agentId: "finance", eventType: "HIGH_OUTSTANDING",
        title: `مستحقات عالية — ${amt.toLocaleString("ar-SA")} ر.س`,
        body: `مكتب "${off.name}" لديه مستحقات بقيمة ${amt.toLocaleString("ar-SA")} ر.س`,
        severity: "high",
        decision: "REQUIRE_APPROVAL",
        payload: { officeId: off.id, officeName: off.name, outstanding: amt },
      });
    }
  } catch {}
  return results;
}

/* ── Risk Agent ── */
async function runRiskAgent(): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  try {
    // Composite risk: cases with session + no documents + overdue invoices
    const highRisk = await q(sql`
      SELECT
        c.id, c.title, c.office_id, o.name AS office,
        c.next_session_date,
        (SELECT COUNT(*) FROM case_documents cd WHERE cd.case_id = c.id) AS doc_count,
        (SELECT COUNT(*) FROM client_invoices i WHERE i.case_id = c.id AND i.status IN ('unpaid','overdue')) AS overdue_inv
      FROM cases c
      LEFT JOIN offices o ON o.id = c.office_id
      WHERE c.status = 'open'
        AND c.next_session_date IS NOT NULL
        AND c.next_session_date < NOW() + INTERVAL '7 days'
      LIMIT 10
    `);
    for (const c of highRisk) {
      const docs    = Number(c.doc_count ?? 0);
      const overdueInv = Number(c.overdue_inv ?? 0);
      let riskScore = 50;
      if (docs === 0) riskScore += 30;
      if (overdueInv > 0) riskScore += 20;
      if (riskScore >= 80) {
        results.push({
          agentId: "risk", eventType: "HIGH_RISK_CASE",
          title: `قضية عالية المخاطرة — درجة ${riskScore}%`,
          body: `"${c.title}" • وثائق: ${docs} • فواتير متأخرة: ${overdueInv} • جلسة قريبة`,
          severity: riskScore >= 90 ? "critical" : "high",
          decision: "RECOMMEND",
          payload: { caseId: c.id, riskScore, docs, overdueInv },
        });
      }
    }

    // Offices with no login in 14+ days
    const dormant = await q(sql`
      SELECT o.id, o.name,
        MAX(ll.created_at) AS last_login
      FROM offices o
      LEFT JOIN login_logs ll ON ll.office_id = o.id
      WHERE o.subscription_plan NOT IN ('free') OR o.subscription_plan IS NULL
      GROUP BY o.id, o.name
      HAVING MAX(ll.created_at) < NOW() - INTERVAL '14 days'
         OR  MAX(ll.created_at) IS NULL
      LIMIT 10
    `).catch(() => []);
    for (const off of dormant) {
      results.push({
        agentId: "risk", eventType: "OFFICE_DORMANT",
        title: `مكتب غير نشط — ${off.name}`,
        body: `مكتب "${off.name}" لم يسجل دخولاً منذ أكثر من 14 يوماً`,
        severity: "medium",
        decision: "RECOMMEND",
        payload: { officeId: off.id, officeName: off.name },
      });
    }
  } catch {}
  return results;
}

/* ── System Agent ── */
async function runSystemAgent(): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  try {
    const mem = process.memoryUsage();
    const usedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const totalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const pct = Math.round((usedMB / totalMB) * 100);

    if (pct > 85) {
      results.push({
        agentId: "system", eventType: "HIGH_MEMORY",
        title: `استخدام ذاكرة مرتفع — ${pct}%`,
        body: `خادم API يستخدم ${usedMB}MB من ${totalMB}MB (${pct}%)`,
        severity: pct > 95 ? "critical" : "high",
        decision: "RECOMMEND",
        payload: { usedMB, totalMB, pct },
      });
    }

    const load = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    if (load > cpuCount * 0.8) {
      results.push({
        agentId: "system", eventType: "HIGH_CPU_LOAD",
        title: `حمل CPU مرتفع — ${load.toFixed(2)}`,
        body: `متوسط الحمل ${load.toFixed(2)} على ${cpuCount} معالج`,
        severity: load > cpuCount ? "critical" : "high",
        decision: "RECOMMEND",
        payload: { load, cpuCount },
      });
    }

    // DB: check for orphaned records / data integrity
    const [orphan] = await q(sql`
      SELECT COUNT(*) AS cnt FROM cases c
      WHERE NOT EXISTS (SELECT 1 FROM offices o WHERE o.id = c.office_id)
    `).catch(() => [{ cnt: 0 }]);
    if (Number(orphan?.cnt ?? 0) > 0) {
      results.push({
        agentId: "system", eventType: "DB_INTEGRITY",
        title: `${orphan.cnt} قضية بدون مكتب (orphaned records)`,
        body: `تحقق من قاعدة البيانات — ${orphan.cnt} سجل معلق بدون ارتباط`,
        severity: "high",
        decision: "REQUIRE_APPROVAL",
        payload: { count: Number(orphan.cnt) },
      });
    }
  } catch {}
  return results;
}

/* ── Orchestrator ── */
async function orchestrate(actions: AgentResult[]): Promise<void> {
  if (actions.length === 0) return;
  try {
    for (const a of actions) {
      // Dedup: don't insert same event_type for same payload.id within 24h
      const key = JSON.stringify({ type: a.eventType, id: a.payload?.caseId ?? a.payload?.invoiceId ?? a.payload?.officeId ?? "" });
      const existing = await q(sql`
        SELECT id FROM agent_actions
        WHERE event_type = ${a.eventType}
          AND payload->>'caseId'    IS NOT DISTINCT FROM ${a.payload?.caseId    ? String(a.payload.caseId)    : null}
          AND payload->>'invoiceId' IS NOT DISTINCT FROM ${a.payload?.invoiceId ? String(a.payload.invoiceId) : null}
          AND payload->>'officeId'  IS NOT DISTINCT FROM ${a.payload?.officeId  ? String(a.payload.officeId)  : null}
          AND created_at > NOW() - INTERVAL '24 hours'
          AND status = 'pending'
        LIMIT 1
      `).catch(() => []);
      if (existing.length > 0) continue;

      await db.execute(sql`
        INSERT INTO agent_actions (agent_id, event_type, decision, title, body, severity, payload)
        VALUES (
          ${a.agentId}, ${a.eventType}, ${a.decision},
          ${a.title}, ${a.body}, ${a.severity},
          ${JSON.stringify(a.payload)}::jsonb
        )
      `).catch(() => {});
    }
  } catch {}
}

/* ═══════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════ */

/* GET /agents/status */
router.get("/agents/status", agentOnly, async (_req, res) => {
  try {
    const agents = await q(sql`SELECT * FROM ai_agents ORDER BY name_ar`);
    const pending = await q(sql`
      SELECT agent_id, COUNT(*) AS cnt
      FROM agent_actions
      WHERE status = 'pending'
      GROUP BY agent_id
    `);
    const pendingMap: Record<string, number> = {};
    for (const p of pending) pendingMap[p.agent_id] = Number(p.cnt ?? 0);

    const recentActions = await q(sql`
      SELECT aa.*, ag.name_ar AS agent_name_ar
      FROM agent_actions aa
      LEFT JOIN ai_agents ag ON ag.id = aa.agent_id
      ORDER BY aa.created_at DESC
      LIMIT 30
    `);

    const stats = await q(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
        COUNT(*) FILTER (WHERE severity = 'high')     AS high_sev
      FROM agent_actions
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    res.json({
      agents: agents.map((a: any) => ({ ...a, pendingActions: pendingMap[a.id] ?? 0 })),
      recentActions,
      stats: stats[0] ?? {},
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /agents/run — run all agents */
router.post("/agents/run", agentOnly, async (_req, res) => {
  const start = Date.now();
  try {
    const [legal, finance, risk, system] = await Promise.allSettled([
      runLegalAgent(),
      runFinanceAgent(),
      runRiskAgent(),
      runSystemAgent(),
    ]);

    const allActions: AgentResult[] = [
      ...(legal.status   === "fulfilled" ? legal.value   : []),
      ...(finance.status === "fulfilled" ? finance.value : []),
      ...(risk.status    === "fulfilled" ? risk.value    : []),
      ...(system.status  === "fulfilled" ? system.value  : []),
    ];

    await orchestrate(allActions);

    // Update last_run
    await db.execute(sql`
      UPDATE ai_agents SET last_run = NOW(), run_count = run_count + 1
      WHERE id IN ('legal','finance','risk','system','hr')
    `).catch(() => {});

    res.json({
      success:   true,
      elapsed:   Date.now() - start,
      found:     allActions.length,
      breakdown: {
        legal:   (legal.status   === "fulfilled" ? legal.value   : []).length,
        finance: (finance.status === "fulfilled" ? finance.value : []).length,
        risk:    (risk.status    === "fulfilled" ? risk.value    : []).length,
        system:  (system.status  === "fulfilled" ? system.value  : []).length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /agents/:id/run — run specific agent */
router.post("/agents/:id/run", agentOnly, async (req, res) => {
  const agentId = req.params.id;
  const start = Date.now();
  try {
    let actions: AgentResult[] = [];
    if      (agentId === "legal")   actions = await runLegalAgent();
    else if (agentId === "finance") actions = await runFinanceAgent();
    else if (agentId === "risk")    actions = await runRiskAgent();
    else if (agentId === "system")  actions = await runSystemAgent();
    else return res.status(404).json({ error: "وكيل غير موجود" });

    await orchestrate(actions);
    await db.execute(sql`
      UPDATE ai_agents SET last_run = NOW(), run_count = run_count + 1 WHERE id = ${agentId}
    `).catch(() => {});

    res.json({ success: true, elapsed: Date.now() - start, found: actions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /agents/actions/:id/resolve */
router.post("/agents/actions/:id/resolve", agentOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  try {
    await db.execute(sql`
      UPDATE agent_actions SET status = 'resolved', resolved_at = NOW() WHERE id = ${id}
    `);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /agents/actions — paginated list */
router.get("/agents/actions", agentOnly, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const agentId = req.query.agent as string | undefined;
  const severity = req.query.severity as string | undefined;
  try {
    const rows = await q(sql`
      SELECT aa.*, ag.name_ar AS agent_name_ar
      FROM agent_actions aa
      LEFT JOIN ai_agents ag ON ag.id = aa.agent_id
      WHERE (${agentId ?? null} IS NULL OR aa.agent_id = ${agentId ?? ""})
        AND (${severity ?? null} IS NULL OR aa.severity = ${severity ?? ""})
      ORDER BY aa.created_at DESC
      LIMIT ${limit}
    `);
    res.json({ actions: rows, total: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
