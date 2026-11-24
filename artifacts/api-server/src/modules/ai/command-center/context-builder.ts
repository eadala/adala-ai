import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { OfficeContext } from "./types";

function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function first(r: any): any  { const a = rows(r); return a[0] ?? null; }

export async function buildOfficeContext(officeId: string): Promise<OfficeContext> {
  const [cases, invoices, tasks, emp, sessions, revenue] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::int                                                          AS total,
        COUNT(*) FILTER (WHERE status IN ('open','active'))::int               AS active,
        COUNT(*) FILTER (WHERE priority = 'high' OR status = 'urgent')::int   AS critical
      FROM cases WHERE office_id = ${officeId}`),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'unpaid')::int          AS unpaid_count,
        COALESCE(SUM(total) FILTER (WHERE status='unpaid'),0)   AS unpaid_amount
      FROM client_invoices WHERE office_id = ${officeId}`),
    db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status IN ('pending','in_progress'))::int AS pending
      FROM tasks WHERE office_id = ${officeId}`),
    db.execute(sql`
      SELECT COUNT(*)::int AS count FROM employees WHERE office_id = ${officeId}`),
    db.execute(sql`
      SELECT COUNT(*)::int AS upcoming
      FROM case_sessions
      WHERE office_id = ${officeId}
        AND session_date >= CURRENT_DATE
        AND session_date <= CURRENT_DATE + INTERVAL '7 days'`),
    db.execute(sql`
      SELECT COALESCE(SUM(amount),0) AS month
      FROM revenues
      WHERE office_id = ${officeId}
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`),
  ]);

  const c  = first(cases)    ?? {};
  const i  = first(invoices) ?? {};
  const t  = first(tasks)    ?? {};
  const e  = first(emp)      ?? {};
  const s  = first(sessions) ?? {};
  const rv = first(revenue)  ?? {};

  const clientCount = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM clients WHERE office_id = ${officeId} AND status = 'active'`);
  const cl = first(clientCount) ?? {};

  return {
    officeId,
    activeCases:      Number(c.active ?? 0),
    openClients:      Number(cl.count ?? 0),
    unpaidInvoices:   Number(i.unpaid_count ?? 0),
    unpaidAmount:     Number(i.unpaid_amount ?? 0),
    pendingTasks:     Number(t.pending ?? 0),
    employees:        Number(e.count ?? 0),
    monthRevenue:     Number(rv.month ?? 0),
    criticalCases:    Number(c.critical ?? 0),
    upcomingSessions: Number(s.upcoming ?? 0),
  };
}

export async function buildLegalContext(officeId: string) {
  const [cases, sessions, contracts] = await Promise.all([
    db.execute(sql`
      SELECT id, title, case_type, status, priority, next_session_date, client_name
      FROM cases
      WHERE office_id = ${officeId} AND status IN ('open','active')
      ORDER BY
        CASE WHEN priority='high' THEN 1 WHEN priority='medium' THEN 2 ELSE 3 END,
        next_session_date ASC NULLS LAST
      LIMIT 10`),
    db.execute(sql`
      SELECT cs.session_date, cs.session_location, c.title AS case_title
      FROM case_sessions cs
      JOIN cases c ON c.id::text = cs.case_id::text
      WHERE cs.office_id = ${officeId}
        AND cs.session_date >= CURRENT_DATE
        AND cs.session_date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY cs.session_date ASC
      LIMIT 5`),
    db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status='active')::int AS active,
             COUNT(*) FILTER (WHERE status='expired')::int AS expired,
             COUNT(*) FILTER (WHERE expires_at < CURRENT_DATE + INTERVAL '30 days' AND status='active')::int AS expiring_soon
      FROM contracts WHERE office_id = ${officeId}`),
  ]);
  return { cases: rows(cases), sessions: rows(sessions), contracts: first(contracts) ?? {} };
}

export async function buildFinanceContext(officeId: string) {
  const [monthly, topUnpaid, expenses, payroll] = await Promise.all([
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(amount),0) AS revenue
      FROM revenues
      WHERE office_id = ${officeId} AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY 1 ORDER BY 1`),
    db.execute(sql`
      SELECT invoice_number, total, due_date, client_name
      FROM client_invoices
      WHERE office_id = ${officeId} AND status = 'unpaid'
      ORDER BY total DESC LIMIT 5`),
    db.execute(sql`
      SELECT COALESCE(SUM(amount),0) AS month_expenses
      FROM expenses
      WHERE office_id = ${officeId}
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`),
    db.execute(sql`
      SELECT COALESCE(SUM(net_salary),0) AS total_payroll
      FROM payroll
      WHERE office_id = ${officeId} AND status = 'paid'
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`),
  ]);
  return {
    monthlyRevenue: rows(monthly),
    topUnpaidInvoices: rows(topUnpaid),
    monthExpenses: Number((first(expenses) ?? {}).month_expenses ?? 0),
    monthPayroll: Number((first(payroll) ?? {}).total_payroll ?? 0),
  };
}

export async function buildHRContext(officeId: string) {
  const [employees, evaluations, attendance] = await Promise.all([
    db.execute(sql`
      SELECT name, position, employment_type, salary, hire_date, status
      FROM employees WHERE office_id = ${officeId} AND status = 'active'
      ORDER BY hire_date ASC LIMIT 15`),
    db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE overall_score >= 80)::int AS excellent,
             COUNT(*) FILTER (WHERE overall_score >= 60 AND overall_score < 80)::int AS good,
             COUNT(*) FILTER (WHERE overall_score < 60)::int AS needs_improvement,
             AVG(overall_score) AS avg_score
      FROM performance_evaluations
      WHERE office_id = ${officeId}
        AND created_at >= DATE_TRUNC('year', CURRENT_DATE)`),
    db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE type='annual')::int  AS annual_used,
             COUNT(*) FILTER (WHERE type='sick')::int    AS sick_used,
             COUNT(*) FILTER (WHERE status='pending')::int AS pending_leaves
      FROM employee_leaves
      WHERE office_id = ${officeId}
        AND start_date >= DATE_TRUNC('year', CURRENT_DATE)`),
  ]);
  return {
    employees: rows(employees),
    evaluations: first(evaluations) ?? {},
    attendance: first(attendance) ?? {},
  };
}

export async function buildSecurityContext(officeId: string) {
  const [users, loginLogs, auditActions] = await Promise.all([
    db.execute(sql`
      SELECT user_id, role, created_at
      FROM office_members WHERE office_id = ${officeId} ORDER BY created_at DESC`),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int AS week_logins,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '1 day')::int  AS day_logins
      FROM login_logs WHERE office_id = ${officeId}`),
    db.execute(sql`
      SELECT action, COUNT(*)::int AS count
      FROM audit_logs
      WHERE office_id = ${officeId} AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY action ORDER BY count DESC LIMIT 10`),
  ]);
  return {
    memberCount: rows(users).length,
    roles: [...new Set(rows(users).map((u: any) => u.role))],
    loginLogs: first(loginLogs) ?? {},
    topActions: rows(auditActions),
  };
}

export async function buildAnalyticsContext(officeId: string) {
  const [caseTrend, revTrend, clientGrowth] = await Promise.all([
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS new_cases,
        COUNT(*) FILTER (WHERE status='closed')::int AS closed
      FROM cases
      WHERE office_id = ${officeId} AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY 1 ORDER BY 1`),
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COALESCE(SUM(amount),0) AS revenue
      FROM revenues
      WHERE office_id = ${officeId} AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY 1 ORDER BY 1`),
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS new_clients
      FROM clients
      WHERE office_id = ${officeId} AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY 1 ORDER BY 1`),
  ]);
  return {
    caseTrend: rows(caseTrend),
    revTrend: rows(revTrend),
    clientGrowth: rows(clientGrowth),
  };
}
