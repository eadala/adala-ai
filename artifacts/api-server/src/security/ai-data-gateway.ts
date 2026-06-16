/**
 * AI Data Gateway — Zero Trust Layer for AI Agents
 *
 * 🚫 AI agents MUST NOT write raw SQL or call db.execute() directly.
 * ✅ All AI data access must go through this gateway.
 *
 * Every function enforces tenantId at the query level.
 * No dynamic queries. No shared state. No cross-tenant access.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }

/* ── Validation ─────────────────────────────────────────────────────────── */
function assertTenant(tenantId: unknown): string {
  if (typeof tenantId !== "string" || !tenantId.trim() || tenantId === "platform") {
    throw new Error("AI_GATEWAY_TENANT_REQUIRED");
  }
  return tenantId;
}

/* ── Case Tools ─────────────────────────────────────────────────────────── */
export const CaseGateway = {
  async listActive(tenantId: string, limit = 10) {
    const tid = assertTenant(tenantId);
    return rows(await db.execute(sql`
      SELECT id, title, case_type, status, priority, next_session_date, client_name
      FROM cases
      WHERE office_id = ${tid} AND status IN ('open','active')
      ORDER BY CASE WHEN priority='high' THEN 1 WHEN priority='medium' THEN 2 ELSE 3 END
      LIMIT ${Math.min(limit, 50)}
    `));
  },
  async getById(id: string, tenantId: string) {
    const tid = assertTenant(tenantId);
    return one(await db.execute(sql`
      SELECT id, title, case_type, status, priority, notes
      FROM cases WHERE id = ${id}::uuid AND office_id = ${tid}
    `));
  },
  async countByCritical(tenantId: string) {
    const tid = assertTenant(tenantId);
    const r = one(await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status IN ('open','active'))::int        AS active,
             COUNT(*) FILTER (WHERE priority='high')::int                    AS high_priority,
             COUNT(*) FILTER (WHERE status='urgent')::int                    AS urgent
      FROM cases WHERE office_id = ${tid}
    `));
    return r ?? { active: 0, high_priority: 0, urgent: 0 };
  },
  async upcomingSessions(tenantId: string, days = 14) {
    const tid = assertTenant(tenantId);
    return rows(await db.execute(sql`
      SELECT cs.session_date, cs.session_location, c.title AS case_title
      FROM case_sessions cs
      JOIN cases c ON c.id::text = cs.case_id::text
      WHERE cs.office_id = ${tid}
        AND cs.session_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}::int
      ORDER BY cs.session_date ASC LIMIT 10
    `));
  },
};

/* ── Client Tools ────────────────────────────────────────────────────────── */
export const ClientGateway = {
  async listActive(tenantId: string, limit = 10) {
    const tid = assertTenant(tenantId);
    return rows(await db.execute(sql`
      SELECT id, full_name, phone, email, status
      FROM clients WHERE office_id = ${tid} AND status = 'active'
      ORDER BY created_at DESC LIMIT ${Math.min(limit, 50)}
    `));
  },
  async getById(id: string, tenantId: string) {
    const tid = assertTenant(tenantId);
    return one(await db.execute(sql`
      SELECT id, full_name, phone, email
      FROM clients WHERE id = ${id}::uuid AND office_id = ${tid}
    `));
  },
  async count(tenantId: string) {
    const tid = assertTenant(tenantId);
    return Number(one(await db.execute(sql`
      SELECT COUNT(*)::int AS c FROM clients WHERE office_id = ${tid}
    `))?.c ?? 0);
  },
};

/* ── Finance Tools ───────────────────────────────────────────────────────── */
export const FinanceGateway = {
  async monthlySummary(tenantId: string) {
    const tid = assertTenant(tenantId);
    const [rev, exp, invoices] = await Promise.all([
      one(db.execute(sql`
        SELECT COALESCE(SUM(amount),0) AS total
        FROM revenues WHERE office_id = ${tid}
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `)),
      one(db.execute(sql`
        SELECT COALESCE(SUM(amount),0) AS total
        FROM expenses WHERE office_id = ${tid}
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `)),
      one(db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE status='unpaid')::int AS count,
               COALESCE(SUM(total) FILTER (WHERE status='unpaid'),0) AS amount
        FROM client_invoices WHERE office_id = ${tid}
      `)),
    ]);
    return {
      monthRevenue:   Number(rev?.total ?? 0),
      monthExpenses:  Number(exp?.total ?? 0),
      unpaidCount:    Number(invoices?.count ?? 0),
      unpaidAmount:   Number(invoices?.amount ?? 0),
    };
  },
  async topUnpaidInvoices(tenantId: string, limit = 5) {
    const tid = assertTenant(tenantId);
    return rows(await db.execute(sql`
      SELECT invoice_number, total, due_date, client_name
      FROM client_invoices WHERE office_id = ${tid} AND status = 'unpaid'
      ORDER BY total DESC LIMIT ${Math.min(limit, 20)}
    `));
  },
};

/* ── HR Tools ────────────────────────────────────────────────────────────── */
export const HRGateway = {
  async teamSummary(tenantId: string) {
    const tid = assertTenant(tenantId);
    const [emp, perf] = await Promise.all([
      one(db.execute(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status='active')::int AS active
        FROM employees WHERE office_id = ${tid}
      `)),
      one(db.execute(sql`
        SELECT ROUND(AVG(overall_score),1) AS avg_score,
               COUNT(*) FILTER (WHERE overall_score >= 80)::int AS excellent
        FROM performance_evaluations WHERE office_id = ${tid}
          AND created_at >= DATE_TRUNC('year', CURRENT_DATE)
      `)),
    ]);
    return {
      total:      Number(emp?.total ?? 0),
      active:     Number(emp?.active ?? 0),
      avgScore:   Number(perf?.avg_score ?? 0),
      excellent:  Number(perf?.excellent ?? 0),
    };
  },
};

/* ── Security Tools ──────────────────────────────────────────────────────── */
export const SecurityGateway = {
  async recentActivity(tenantId: string) {
    const tid = assertTenant(tenantId);
    const [logins, actions] = await Promise.all([
      one(db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24h')::int AS day,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7d')::int  AS week
        FROM login_logs WHERE office_id = ${tid}
      `)),
      rows(db.execute(sql`
        SELECT action, COUNT(*)::int AS c
        FROM audit_logs WHERE office_id = ${tid}
          AND created_at >= NOW() - INTERVAL '7d'
        GROUP BY action ORDER BY c DESC LIMIT 5
      `)),
    ]);
    return { logins: logins ?? {}, topActions: actions };
  },
};

/* ── Operations Tools ────────────────────────────────────────────────────── */
export const OpsGateway = {
  async pendingTasks(tenantId: string, limit = 10) {
    const tid = assertTenant(tenantId);
    return rows(await db.execute(sql`
      SELECT title, status, priority, due_date
      FROM tasks WHERE office_id = ${tid}
        AND status IN ('pending','in_progress')
      ORDER BY CASE WHEN priority='high' THEN 1 WHEN priority='medium' THEN 2 ELSE 3 END,
               due_date ASC NULLS LAST
      LIMIT ${Math.min(limit, 30)}
    `));
  },
  async upcomingReminders(tenantId: string, days = 7) {
    const tid = assertTenant(tenantId);
    return rows(await db.execute(sql`
      SELECT title, due_date, type
      FROM reminders WHERE office_id = ${tid}
        AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}::int
        AND is_done = false
      ORDER BY due_date ASC LIMIT 10
    `));
  },
};

/* ── Export: unified gateway object (for easy imports) ──────────────────── */
export const AIDataGateway = {
  cases:    CaseGateway,
  clients:  ClientGateway,
  finance:  FinanceGateway,
  hr:       HRGateway,
  security: SecurityGateway,
  ops:      OpsGateway,
};
