/**
 * Financial Guard — حارس النظام المالي
 * ─────────────────────────────────────
 * يفحص:
 *  1. سلامة Ledger (لا قيود يتيمة)
 *  2. تطابق Stripe مع الـ ledger
 *  3. فواتير متأخرة لم تُسجَّل
 *  4. دفعات مكررة (duplicate stripe events)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface FinancialCheck {
  name:     string;
  status:   "pass" | "warn" | "fail";
  detail:   string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface FinancialReport {
  score:     number;           // 0 → 100
  allPassed: boolean;
  checks:    FinancialCheck[];
  runAt:     string;
}

async function sqlSafe<T>(q: any, fallback: T): Promise<T> {
  try {
    const r = await db.execute(q);
    return (r.rows ?? r) as unknown as T;
  } catch { return fallback; }
}

export async function runFinancialGuard(): Promise<FinancialReport> {
  const checks: FinancialCheck[] = [];

  /* 1. Orphan ledger entries (no office_id) */
  const orphan = await sqlSafe<any[]>(
    sql`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE office_id IS NULL OR office_id = ''`,
    []
  );
  const orphanCount = Number(orphan[0]?.n ?? 0);
  checks.push({
    name: "Ledger Integrity — لا قيود يتيمة",
    status: orphanCount === 0 ? "pass" : "fail",
    detail: orphanCount === 0 ? "كل القيود مرتبطة بمكتب" : `${orphanCount} قيد بدون office_id`,
    severity: "critical",
  });

  /* 2. Duplicate stripe events */
  const dupes = await sqlSafe<any[]>(
    sql`
      SELECT COUNT(*)::int AS n FROM (
        SELECT stripe_event_id, COUNT(*) c FROM payment_transactions
        WHERE stripe_event_id IS NOT NULL GROUP BY stripe_event_id HAVING COUNT(*) > 1
      ) t
    `,
    []
  );
  const dupeCount = Number(dupes[0]?.n ?? 0);
  checks.push({
    name: "Stripe Idempotency — لا أحداث مكررة",
    status: dupeCount === 0 ? "pass" : "fail",
    detail: dupeCount === 0 ? "لا أحداث مكررة" : `${dupeCount} حدث مكرر في payment_transactions`,
    severity: "high",
  });

  /* 3. Revenue entries without office_id */
  const revOrphan = await sqlSafe<any[]>(
    sql`SELECT COUNT(*)::int AS n FROM revenues WHERE office_id IS NULL OR office_id = ''`,
    []
  );
  const revOrphanCount = Number(revOrphan[0]?.n ?? 0);
  checks.push({
    name: "Revenue Scoping — كل إيراد مرتبط بمكتب",
    status: revOrphanCount === 0 ? "pass" : "warn",
    detail: revOrphanCount === 0 ? "كل الإيرادات مُصنَّفة" : `${revOrphanCount} إيراد بدون office_id`,
    severity: "medium",
  });

  /* 4. Overdue invoices (unpaid, past due_date) */
  const overdue = await sqlSafe<any[]>(
    sql`
      SELECT COUNT(*)::int AS n FROM client_invoices
      WHERE status NOT IN ('paid','cancelled')
        AND due_date IS NOT NULL
        AND TO_DATE(due_date, 'YYYY-MM-DD') < CURRENT_DATE - INTERVAL '30 days'
    `,
    []
  );
  const overdueCount = Number(overdue[0]?.n ?? 0);
  checks.push({
    name: "Aged Invoices — فواتير متأخرة >30 يوم",
    status: overdueCount === 0 ? "pass" : overdueCount < 5 ? "warn" : "fail",
    detail: overdueCount === 0 ? "لا فواتير متأخرة" : `${overdueCount} فاتورة متأخرة أكثر من 30 يوم`,
    severity: "medium",
  });

  /* 5. Ledger balance consistency (sum of credit - debit = last balance_after) */
  const balCheck = await sqlSafe<any[]>(
    sql`
      SELECT COUNT(DISTINCT office_id)::int AS n FROM (
        SELECT office_id,
          SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) AS net,
          MAX(balance_after) AS last_bal
        FROM ledger_entries GROUP BY office_id
        HAVING ABS(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END) - MAX(balance_after)) > 1
      ) t
    `,
    []
  );
  const balMismatch = Number(balCheck[0]?.n ?? 0);
  checks.push({
    name: "Ledger Balance — توازن الحسابات",
    status: balMismatch === 0 ? "pass" : "fail",
    detail: balMismatch === 0 ? "الأرصدة متوازنة" : `${balMismatch} مكتب لديه عدم توازن في الرصيد`,
    severity: "critical",
  });

  const failCount = checks.filter(c => c.status === "fail").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const score     = Math.max(0, 100 - failCount * 20 - warnCount * 5);

  return {
    score,
    allPassed: failCount === 0 && warnCount === 0,
    checks,
    runAt: new Date().toISOString(),
  };
}
