/**
 * Legal OS Kernel — القلب الذي يوحّد كل الأنظمة
 * ───────────────────────────────────────────────
 * يجمع:
 *  • أعداد لحظية من كل الطبقات (Cases/Finance/Tasks/AI/Alerts)
 *  • حالة المنصة الموحّدة
 *  • Process Registry (قضايا نشطة كـ "processes")
 *  • System Health Score
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getSystemState } from "../hardening/production.lock";
import { getIsolationStats } from "../isolation/tenant.scope";

export interface OSLayer {
  id:      string;
  name:    string;
  nameAr:  string;
  status:  "operational" | "degraded" | "offline";
  metrics: Record<string, number | string>;
}

export interface OSKernelSnapshot {
  timestamp:   string;
  systemMode:  string;
  healthScore: number;
  layers:      OSLayer[];
  processes:   ActiveProcess[];
  alerts:      { critical: number; warning: number; info: number };
}

export interface ActiveProcess {
  id:      string;
  type:    "case";
  title:   string;
  state:   string;
  officeId: string;
  createdAt: string;
}

async function safeQuery<T>(q: any, fallback: T): Promise<T> {
  try { const r = await db.execute(q); return ((r.rows ?? r) as unknown) as T; }
  catch { return fallback; }
}

export async function getKernelSnapshot(officeId?: string): Promise<OSKernelSnapshot> {
  const tenantFilter = officeId ? sql`WHERE office_id = ${officeId}` : sql`WHERE 1=1`;

  /* ─── Parallel fetch from all layers ─── */
  const [cases, clients, finance, tasks, docs, aiLogs, alerts] = await Promise.all([
    safeQuery<any[]>(sql`
      SELECT
        COUNT(*)::int                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int                       AS active,
        COUNT(*) FILTER (WHERE status = 'closed')::int                       AS closed,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int  AS last7days
      FROM cases ${tenantFilter}
    `, []),

    safeQuery<any[]>(sql`
      SELECT COUNT(*)::int AS total FROM clients ${tenantFilter}
    `, []),

    safeQuery<any[]>(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END),0)::numeric AS total_revenue,
        COALESCE(SUM(CASE WHEN type='debit'  THEN amount ELSE 0 END),0)::numeric AS total_expenses,
        COUNT(*)::int                                                             AS entries
      FROM ledger_entries ${tenantFilter}
    `, []),

    safeQuery<any[]>(sql`
      SELECT
        COUNT(*)::int                                                               AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int                           AS pending,
        COUNT(*) FILTER (WHERE status = 'done')::int                              AS done,
        COUNT(*) FILTER (WHERE due_date::date < CURRENT_DATE AND status != 'done')::int AS overdue
      FROM tasks ${tenantFilter}
    `, []),

    safeQuery<any[]>(sql`SELECT COUNT(*)::int AS total FROM documents ${tenantFilter}`, []),

    safeQuery<any[]>(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h')::int AS today
      FROM ai_assistant_logs ${tenantFilter}
    `, []),

    safeQuery<any[]>(sql`
      SELECT severity, COUNT(*)::int AS n FROM system_events
      WHERE created_at > NOW() - INTERVAL '24h'
      GROUP BY severity
    `, []),
  ]);

  const c  = cases[0] ?? {};
  const cl = clients[0] ?? {};
  const f  = finance[0] ?? {};
  const t  = tasks[0] ?? {};
  const d  = docs[0] ?? {};
  const ai = aiLogs[0] ?? {};

  const alertMap: Record<string, number> = {};
  for (const row of alerts as any[]) alertMap[row.severity] = Number(row.n);

  /* ─── Active processes (recent active cases) ─── */
  const recentCases = await safeQuery<any[]>(sql`
    SELECT id, title, status, office_id, created_at
    FROM cases ${tenantFilter} AND status = 'active'
    ORDER BY created_at DESC LIMIT 8
  `, []);

  const processes: ActiveProcess[] = (recentCases as any[]).map(r => ({
    id:       r.id,
    type:     "case" as const,
    title:    r.title,
    state:    r.status,
    officeId: r.office_id,
    createdAt: r.created_at,
  }));

  /* ─── Layers ─── */
  const layers: OSLayer[] = [
    {
      id: "case-layer", name: "Case Management", nameAr: "طبقة القضايا",
      status: "operational",
      metrics: { total: Number(c.total ?? 0), active: Number(c.active ?? 0), last7days: Number(c.last7days ?? 0) },
    },
    {
      id: "client-layer", name: "Client Registry", nameAr: "سجل العملاء",
      status: "operational",
      metrics: { total: Number(cl.total ?? 0) },
    },
    {
      id: "finance-layer", name: "Financial Ledger", nameAr: "المحرك المالي",
      status: "operational",
      metrics: {
        revenue:  Number(f.total_revenue ?? 0),
        expenses: Number(f.total_expenses ?? 0),
        entries:  Number(f.entries ?? 0),
      },
    },
    {
      id: "task-layer", name: "Tasks & Workflow", nameAr: "المهام",
      status: Number(t.overdue ?? 0) > 10 ? "degraded" : "operational",
      metrics: { total: Number(t.total ?? 0), pending: Number(t.pending ?? 0), overdue: Number(t.overdue ?? 0) },
    },
    {
      id: "doc-layer", name: "Documents", nameAr: "المستندات",
      status: "operational",
      metrics: { total: Number(d.total ?? 0) },
    },
    {
      id: "ai-layer", name: "AI Intelligence", nameAr: "طبقة الذكاء",
      status: "operational",
      metrics: { total: Number(ai.total ?? 0), today: Number(ai.today ?? 0) },
    },
    {
      id: "isolation-layer", name: "Tenant Isolation", nameAr: "طبقة العزل",
      status: getIsolationStats().leakCount > 0 ? "degraded" : "operational",
      metrics: { ...getIsolationStats() },
    },
    {
      id: "hardening-layer", name: "Production Lock", nameAr: "قفل الإنتاج",
      status: getSystemState().mode === "safe_mode" ? "degraded" : "operational",
      metrics: { mode: getSystemState().mode },
    },
  ];

  /* ─── Health Score ─── */
  const degraded  = layers.filter(l => l.status === "degraded").length;
  const offline   = layers.filter(l => l.status === "offline").length;
  const critical  = alertMap["critical"] ?? 0;
  const healthScore = Math.max(0, 100 - degraded * 10 - offline * 20 - critical * 5);

  return {
    timestamp:  new Date().toISOString(),
    systemMode: getSystemState().mode,
    healthScore,
    layers,
    processes,
    alerts: {
      critical: alertMap["critical"] ?? 0,
      warning:  alertMap["warning"]  ?? 0,
      info:     alertMap["info"]     ?? 0,
    },
  };
}
