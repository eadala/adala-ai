/**
 * Tenant-scoped billing reads for Stage 16.1.
 * Used by GET /billing/overview, /platform-invoices, /platform-invoices/stats.
 * Synthetic "platform" tenant is rejected — global SA views stay on /admin/billing/*.
 */
import { sql } from "drizzle-orm";
import { isUuid } from "./officePageResolverLogic";

export type DbExecute = {
  execute: (q: unknown) => Promise<unknown>;
};

export type PlanMeta = {
  id: string;
  name: string;
  color: string;
  monthlyPrice: number;
};

/** Minimal Stripe surface used by overview reads (avoids coupling to Stripe SDK types). */
export type StripeLike = {
  subscriptions: {
    list: (args: {
      limit: number;
      expand?: string[];
    }) => Promise<{
      data: Array<{
        id?: string;
        status?: string;
        current_period_start?: number;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
        customer?: string | { id?: string } | null;
        latest_invoice?: { status?: string } | string | null;
      }>;
    }>;
  };
};

export type BillingOverviewResult = {
  planSlug: string;
  planName: string;
  planColor: string;
  planPrice: number;
  planOrder: number;
  stripeSubscription: unknown;
  stripeCustomerId: string | null;
  stripeConfigured: boolean;
  entitlements: Array<{
    key: string;
    limit: number;
    used: number;
    percent: number;
    remaining: number;
  }>;
  alerts: Array<{ type: "error" | "warning" | "info"; message: string; action?: string }>;
  mrr: number;
  totalPaid: number;
  nextDueDate: unknown;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const withRows = result as { rows?: Record<string, unknown>[] } | null;
  return withRows?.rows ?? [];
}

/** Coerce SUM/COUNT aggregates to finite numbers (never null/NaN). */
export function normalizeMoneySum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Ordinary office billing reads require a canonical office UUID.
 * Super-admin synthetic "platform" must use /admin/billing/* instead.
 */
export function assertTenantBillingOfficeId(tenantId: string | undefined | null): string {
  if (!tenantId || tenantId === "platform" || !isUuid(tenantId)) {
    const err = new Error("TENANT_BILLING_FORBIDDEN") as Error & { status: number; code: string };
    err.status = 403;
    err.code = "TENANT_BILLING_FORBIDDEN";
    throw err;
  }
  return tenantId;
}

export async function fetchBillingOverview(opts: {
  db: DbExecute;
  tenantId: string;
  plans: PlanMeta[];
  planOrder: string[];
  keyLabels: Record<string, string>;
  getStripeClient?: () => Promise<StripeLike | null>;
}): Promise<BillingOverviewResult> {
  const tenantId = assertTenantBillingOfficeId(opts.tenantId);

  const officeRows = await opts.db.execute(
    sql`SELECT plan FROM office_page WHERE id = ${tenantId}::uuid LIMIT 1`,
  );
  const planSlug = String(rowsOf(officeRows)[0]?.plan ?? "free");
  const planMeta = opts.plans.find((p) => p.id === planSlug) ?? opts.plans[0];

  const entRows = await opts.db.execute(sql`
    SELECT key, "limit", used,
           CASE WHEN "limit" > 0 THEN LEAST(ROUND((used::numeric/"limit")*100),100) ELSE 0 END AS percent,
           CASE WHEN "limit" > 0 THEN GREATEST("limit"-used,0) ELSE 999999 END AS remaining
    FROM office_entitlements
    WHERE office_id = ${tenantId}
    ORDER BY key
  `);
  const entitlements = rowsOf(entRows).map((e) => ({
    key: String(e.key ?? ""),
    limit: normalizeMoneySum(e.limit),
    used: normalizeMoneySum(e.used),
    percent: normalizeMoneySum(e.percent),
    remaining: normalizeMoneySum(e.remaining),
  }));

  let stripeSubscription: unknown = null;
  let stripeCustomerId: string | null = null;
  let stripeConfigured = false;
  if (opts.getStripeClient) {
    try {
      const stripe = await opts.getStripeClient();
      stripeConfigured = !!stripe;
      if (stripe) {
        try {
          const subs = await stripe.subscriptions.list({
            limit: 1,
            expand: ["data.latest_invoice"],
          });
          if (subs.data.length > 0) {
            const s = subs.data[0];
            const latest = s.latest_invoice;
            const latestStatus =
              latest && typeof latest === "object" ? latest.status ?? null : null;
            const customer = s.customer;
            stripeSubscription = {
              id: s.id,
              status: s.status,
              currentPeriodStart: s.current_period_start,
              currentPeriodEnd: s.current_period_end,
              cancelAtPeriodEnd: s.cancel_at_period_end,
              latestInvoiceStatus: latestStatus,
            };
            stripeCustomerId =
              typeof customer === "string" ? customer : customer?.id ?? null;
          }
        } catch {
          /* Stripe API failure must not break the read */
        }
      }
    } catch {
      stripeConfigured = false;
      stripeSubscription = null;
    }
  }

  const alerts: BillingOverviewResult["alerts"] = [];
  const sub = stripeSubscription as {
    status?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: number;
  } | null;
  if (sub?.status === "past_due") {
    alerts.push({
      type: "error",
      message: "يوجد دفعة متأخرة — يرجى تحديث بيانات الدفع فوراً",
      action: "payment_methods",
    });
  }
  if (sub?.status === "unpaid") {
    alerts.push({
      type: "error",
      message: "فشلت عملية الدفع — الاشتراك موقوف مؤقتاً",
      action: "payment_methods",
    });
  }
  if (sub?.cancelAtPeriodEnd) {
    const dt = new Date((sub.currentPeriodEnd ?? 0) * 1000);
    alerts.push({
      type: "warning",
      message: `الاشتراك سيتوقف في ${dt.toLocaleDateString("ar-SA")} — يمكنك إعادة التفعيل في أي وقت`,
    });
  }
  if (planSlug === "free") {
    alerts.push({
      type: "info",
      message: "أنت على الباقة المجانية — قم بالترقية للوصول إلى ميزات متقدمة",
      action: "plans",
    });
  }
  for (const ent of entitlements) {
    const label = opts.keyLabels[ent.key] ?? ent.key;
    if (ent.percent >= 95) {
      alerts.push({
        type: "error",
        message: `تجاوزت ${ent.percent}% من حد ${label} — يُنصح بالترقية فوراً`,
      });
    } else if (ent.percent >= 80) {
      alerts.push({
        type: "warning",
        message: `اقتربت من حد ${label} (${ent.percent}% مستخدم)`,
      });
    }
  }

  const mrrRows = await opts.db.execute(sql`
    SELECT COALESCE(SUM(amount),0) AS mrr FROM office_ledger
    WHERE office_id = ${tenantId}
      AND type='credit' AND created_at >= NOW() - INTERVAL '30 days'
  `);
  const mrr = normalizeMoneySum(rowsOf(mrrRows)[0]?.mrr);

  const totalRows = await opts.db.execute(sql`
    SELECT COALESCE(SUM(amount),0) AS total FROM office_ledger
    WHERE office_id = ${tenantId} AND type='credit'
  `);
  const totalPaid = normalizeMoneySum(rowsOf(totalRows)[0]?.total);

  const nextInvRows = await opts.db.execute(sql`
    SELECT due_date FROM platform_billing_invoices
    WHERE office_id = ${tenantId} AND status='unpaid'
    ORDER BY due_date ASC LIMIT 1
  `);
  const nextDueDate = rowsOf(nextInvRows)[0]?.due_date ?? null;

  return {
    planSlug,
    planName: planMeta?.name ?? planSlug,
    planColor: planMeta?.color ?? "#64748B",
    planPrice: planMeta?.monthlyPrice ?? 0,
    planOrder: opts.planOrder.indexOf(planSlug),
    stripeSubscription,
    stripeCustomerId,
    stripeConfigured,
    entitlements,
    alerts,
    mrr,
    totalPaid,
    nextDueDate,
  };
}

export async function listTenantPlatformInvoices(opts: {
  db: DbExecute;
  tenantId: string;
}): Promise<Record<string, unknown>[]> {
  const tenantId = assertTenantBillingOfficeId(opts.tenantId);
  const r = await opts.db.execute(sql`
    SELECT id, office_id, plan_id, plan_name, amount, currency, status,
           billing_cycle, issue_date, due_date, paid_at, notes, stripe_id, created_at
    FROM platform_billing_invoices
    WHERE office_id = ${tenantId}
    ORDER BY created_at DESC LIMIT 50
  `);
  return rowsOf(r);
}

export async function tenantPlatformInvoiceStats(opts: {
  db: DbExecute;
  tenantId: string;
}): Promise<{
  total: number;
  paid: number;
  unpaid: number;
  overdue: number;
  total_paid: number;
  total_pending: number;
}> {
  const tenantId = assertTenantBillingOfficeId(opts.tenantId);
  const r = await opts.db.execute(sql`
    SELECT
      COUNT(*)::int                                            AS total,
      COUNT(*) FILTER (WHERE status='paid')::int             AS paid,
      COUNT(*) FILTER (WHERE status='unpaid')::int           AS unpaid,
      COUNT(*) FILTER (WHERE status='overdue')::int          AS overdue,
      COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)   AS total_paid,
      COALESCE(SUM(amount) FILTER (WHERE status='unpaid'),0) AS total_pending
    FROM platform_billing_invoices
    WHERE office_id = ${tenantId}
  `);
  const row = rowsOf(r)[0] ?? {};
  return {
    total: normalizeMoneySum(row.total),
    paid: normalizeMoneySum(row.paid),
    unpaid: normalizeMoneySum(row.unpaid),
    overdue: normalizeMoneySum(row.overdue),
    total_paid: normalizeMoneySum(row.total_paid),
    total_pending: normalizeMoneySum(row.total_pending),
  };
}
