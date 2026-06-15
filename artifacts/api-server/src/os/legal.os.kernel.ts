/**
 * Legal OS Kernel v3 — القلب الموحّد لنظام التشغيل القانوني
 * ────────────────────────────────────────────────────────────
 * يجمع بيانات حقيقية من كل طبقات النظام في snapshot واحد.
 * Safe, parallel queries with individual fallbacks.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getSystemState }   from "../hardening/production.lock";
import { getIsolationStats } from "../isolation/tenant.scope";

/* ── Types ────────────────────────────────────────── */
export interface OSLayer {
  id:      string;
  nameAr:  string;
  icon:    string;
  status:  "operational" | "degraded" | "offline";
  metrics: Record<string, number | string>;
}

export interface ActiveProcess {
  id:         string;
  title:      string;
  caseType:   string;
  state:      string;
  clientName: string;
  tasks:      number;
  messages:   number;
  createdAt:  string;
}

export interface EventBusEntry {
  id:        string;
  eventType: string;
  title:     string;
  body:      string;
  caseId:    string;
  createdAt: string;
}

export interface OSKernelSnapshot {
  timestamp:   string;
  systemMode:  string;
  healthScore: number;
  layers:      OSLayer[];
  processes:   ActiveProcess[];
  eventBus:    EventBusEntry[];
  alerts:      { critical: number; warning: number; info: number };
  ai: {
    pendingApprovals: number;
    totalInsights:    number;
    lastAnalysis:     string | null;
  };
  finance: {
    totalRevenue:    number;
    totalExpenses:   number;
    pendingInvoices: number;
    balance:         number;
  };
}

/* ── Helpers ──────────────────────────────────────── */
async function sq<T>(q: any, fallback: T): Promise<T> {
  try {
    const r = await db.execute(q);
    return ((r.rows ?? r) as unknown) as T;
  } catch {
    return fallback;
  }
}

const n = (v: any): number => Number(v ?? 0);

/* ── Main export ──────────────────────────────────── */
export async function getKernelSnapshot(officeId?: string): Promise<OSKernelSnapshot> {
  const tf  = officeId ? sql`AND office_id = ${officeId}` : sql``;
  const tf0 = officeId ? sql`WHERE office_id = ${officeId}` : sql`WHERE 1=1`;

  /* ── Parallel DB fetch ───────────────────────────── */
  const [
    caseRows, taskRows, clientRows, invoiceRows,
    revenueRows, expenseRows, aiLogRows,
    timelineRows, aiInsightRows, sysEventRows,
    processCases,
  ] = await Promise.all([

    /* cases summary */
    sq<any[]>(sql`
      SELECT
        COUNT(*)::int                                                         AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int                        AS open,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int                 AS in_progress,
        COUNT(*) FILTER (WHERE status = 'closed')::int                      AS closed,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last7days
      FROM cases WHERE 1=1 ${tf}
    `, [{}]),

    /* tasks summary */
    sq<any[]>(sql`
      SELECT
        COUNT(*)::int                                                                       AS total,
        COUNT(*) FILTER (WHERE status = 'todo')::int                                      AS todo,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int                               AS in_progress,
        COUNT(*) FILTER (WHERE status = 'done')::int                                      AS done,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done')::int                AS overdue
      FROM tasks WHERE 1=1 ${tf}
    `, [{}]),

    /* clients */
    sq<any[]>(sql`SELECT COUNT(*)::int AS total FROM clients ${tf0}`, [{}]),

    /* invoices */
    sq<any[]>(sql`
      SELECT
        COUNT(*)::int                                     AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending,
        COALESCE(SUM(amount), 0)::numeric                AS total_amount
      FROM client_invoices WHERE 1=1 ${tf}
    `, [{}]),

    /* revenues */
    sq<any[]>(sql`SELECT COALESCE(SUM(amount),0)::numeric AS total FROM revenues WHERE 1=1 ${tf}`, [{}]),

    /* expenses */
    sq<any[]>(sql`SELECT COALESCE(SUM(amount),0)::numeric AS total FROM expenses WHERE 1=1 ${tf}`, [{}]),

    /* AI assistant logs */
    sq<any[]>(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h')::int AS today
      FROM ai_assistant_logs WHERE 1=1 ${tf}
    `, [{}]),

    /* recent timeline events (event bus) */
    sq<any[]>(sql`
      SELECT id, case_id, entry_type, title, description, happened_at
      FROM case_timeline WHERE 1=1 ${tf}
      ORDER BY happened_at DESC LIMIT 12
    `, []),

    /* AI insights (with safe sub-query for pending approvals) */
    sq<any[]>(sql`
      SELECT
        COUNT(*)::int AS total,
        MAX(created_at) AS last_analysis
      FROM case_ai_insights WHERE 1=1 ${tf}
    `, [{}]),

    /* system events */
    sq<any[]>(sql`
      SELECT severity, COUNT(*)::int AS n
      FROM system_events
      WHERE created_at > NOW() - INTERVAL '24h'
      GROUP BY severity
    `, []),

    /* active processes — non-closed cases with linked counts */
    sq<any[]>(sql`
      SELECT
        c.id, c.title, c.case_type, c.status, c.client_name, c.created_at,
        (SELECT COUNT(*)::int FROM tasks      WHERE case_id::text = c.id)  AS task_count,
        (SELECT COUNT(*)::int FROM case_messages WHERE case_id = c.id)     AS msg_count
      FROM cases c
      WHERE c.status != 'closed' ${tf}
      ORDER BY c.created_at DESC
      LIMIT 15
    `, []),
  ]);

  /* ── Unpack ──────────────────────────────────────── */
  const c   = caseRows[0]    ?? {};
  const t   = taskRows[0]    ?? {};
  const cl  = clientRows[0]  ?? {};
  const inv = invoiceRows[0] ?? {};
  const rev = revenueRows[0] ?? {};
  const exp = expenseRows[0] ?? {};
  const ai  = aiLogRows[0]   ?? {};
  const ins = aiInsightRows[0] ?? {};

  const revenue  = n(rev.total);
  const expenses = n(exp.total);

  const alertMap: Record<string, number> = {};
  for (const row of sysEventRows as any[]) alertMap[(row as any).severity] = n((row as any).n);

  /* ── Count pending AI approvals safely ───────────── */
  let pendingApprovals = 0;
  try {
    const paQuery = officeId
      ? sql`
          SELECT SUM(jsonb_array_length(auto_tasks) - (
            SELECT COUNT(*) FROM jsonb_array_elements(auto_tasks) t2
            WHERE (t2->>'status') != 'pending_approval'
          ))::int AS cnt
          FROM case_ai_insights WHERE office_id = ${officeId}
        `
      : sql`SELECT 0::int AS cnt`;
    const paRows = await sq<any[]>(paQuery, [{ cnt: 0 }]);
    pendingApprovals = n(paRows[0]?.cnt);
  } catch { /* fallback 0 */ }

  /* ── Processes ───────────────────────────────────── */
  const processes: ActiveProcess[] = (processCases as any[]).map(r => ({
    id:         r.id,
    title:      r.title      ?? "قضية بلا عنوان",
    caseType:   r.case_type  ?? "civil",
    state:      r.status,
    clientName: r.client_name ?? "—",
    tasks:      n(r.task_count),
    messages:   n(r.msg_count),
    createdAt:  r.created_at,
  }));

  /* ── Event bus ───────────────────────────────────── */
  const eventBus: EventBusEntry[] = (timelineRows as any[]).map(r => ({
    id:        r.id,
    eventType: r.entry_type  ?? "note",
    title:     r.title       ?? "",
    body:      r.description ?? "",
    caseId:    r.case_id,
    createdAt: r.happened_at,
  }));

  /* ── OS Layers ───────────────────────────────────── */
  const isolStats = getIsolationStats();
  const sysState  = getSystemState();

  const layers: OSLayer[] = [
    {
      id: "case-layer", nameAr: "طبقة القضايا", icon: "⚖️",
      status: "operational",
      metrics: {
        الإجمالي:    n(c.total),
        مفتوحة:      n(c.open),
        قيد_التنفيذ: n(c.in_progress),
        مغلقة:       n(c.closed),
      },
    },
    {
      id: "client-layer", nameAr: "سجل الموكّلين", icon: "👤",
      status: "operational",
      metrics: { الإجمالي: n(cl.total) },
    },
    {
      id: "finance-layer", nameAr: "المحرك المالي", icon: "💰",
      status: (revenue - expenses) < 0 ? "degraded" : "operational",
      metrics: {
        الإيرادات: revenue,
        المصروفات: expenses,
        الرصيد:    revenue - expenses,
      },
    },
    {
      id: "task-layer", nameAr: "محرك المهام", icon: "✅",
      status: n(t.overdue) > 5 ? "degraded" : "operational",
      metrics: {
        الإجمالي: n(t.total),
        معلقة:    n(t.todo),
        منجزة:    n(t.done),
        متأخرة:   n(t.overdue),
      },
    },
    {
      id: "ai-layer", nameAr: "طبقة الذكاء", icon: "🧠",
      status: "operational",
      metrics: {
        تحليلات:      n(ins.total),
        موافقة_منتظرة: pendingApprovals,
        جلسات_AI:    n(ai.total),
      },
    },
    {
      id: "invoice-layer", nameAr: "الفواتير", icon: "🧾",
      status: n(inv.pending) > 10 ? "degraded" : "operational",
      metrics: {
        الإجمالي:  n(inv.total),
        معلقة:     n(inv.pending),
        القيمة:    n(inv.total_amount),
      },
    },
    {
      id: "isolation-layer", nameAr: "طبقة العزل", icon: "🔐",
      status: (isolStats.leakCount ?? 0) > 0 ? "degraded" : "operational",
      metrics: { تسرب: isolStats.leakCount ?? 0, مسدود: isolStats.totalBlocked ?? 0 },
    },
    {
      id: "hardening-layer", nameAr: "قفل الإنتاج", icon: "🛡️",
      status: sysState.mode === "safe_mode" ? "degraded" : "operational",
      metrics: { الوضع: sysState.mode },
    },
  ];

  /* ── Health Score ─────────────────────────────────── */
  const degradedCnt  = layers.filter(l => l.status === "degraded").length;
  const offlineCnt   = layers.filter(l => l.status === "offline").length;
  const overduePen   = Math.min(15, n(t.overdue) * 2);
  const criticalPen  = Math.min(20, (alertMap["critical"] ?? 0) * 5);
  const healthScore  = Math.max(
    20,
    100 - degradedCnt * 8 - offlineCnt * 20 - overduePen - criticalPen,
  );

  return {
    timestamp:  new Date().toISOString(),
    systemMode: sysState.mode ?? "stable",
    healthScore,
    layers,
    processes,
    eventBus,
    alerts: {
      critical: alertMap["critical"] ?? 0,
      warning:  alertMap["warning"]  ?? 0,
      info:     alertMap["info"]     ?? 0,
    },
    ai: {
      pendingApprovals,
      totalInsights: n(ins.total),
      lastAnalysis:  ins.last_analysis ?? null,
    },
    finance: {
      totalRevenue:    revenue,
      totalExpenses:   expenses,
      pendingInvoices: n(inv.pending),
      balance:         revenue - expenses,
    },
  };
}
