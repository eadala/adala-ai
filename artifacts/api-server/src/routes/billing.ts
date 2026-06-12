import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { getUncachableStripeClient } from "../stripeClient";
import { resolveTenantId } from "../middlewares/tenantMiddleware";

const router = Router();

type StripeClient = Awaited<ReturnType<typeof getUncachableStripeClient>>;

/* ── 7 Subscription Plans (matches DB plans) ──────── */
const PLANS = [
  {
    id: "free", name: "مجاني", nameEn: "Free", price: 0,
    monthlyPrice: 0, yearlyPrice: 0, color: "#64748B",
    isFree: true, isContactOnly: false, popular: false,
    features: ["٥ قضايا", "مستخدم واحد", "١ جيجا تخزين", "٥ طلبات AI يومياً", "فواتير إلكترونية", "تذكيرات وتقويم"],
  },
  {
    id: "basic", name: "مبتدئ", nameEn: "Basic", price: 99,
    monthlyPrice: 99, yearlyPrice: 79, color: "#3B82F6",
    isFree: false, isContactOnly: false, popular: false,
    features: ["٢٠ قضية", "مستخدمان", "٥ جيجا تخزين", "٢٠ طلب AI يومياً", "صفحة مكتب + متجر قانوني", "عقود ذكية بالAI", "تطبيق جوال"],
  },
  {
    id: "pro", name: "احترافي", nameEn: "Professional", price: 299,
    monthlyPrice: 299, yearlyPrice: 239, color: "#C9A84C",
    isFree: false, isContactOnly: false, popular: true,
    features: ["١٠٠ قضية", "٥ مستخدمين", "٢٥ جيجا تخزين", "١٠٠ طلب AI يومياً", "تحليلات AI متقدمة", "OCR استخراج نصوص", "نسخ احتياطي تلقائي", "تقارير متقدمة"],
  },
  {
    id: "growth", name: "نمو", nameEn: "Growth", price: 599,
    monthlyPrice: 599, yearlyPrice: 479, color: "#8B5CF6",
    isFree: false, isContactOnly: false, popular: false,
    features: ["٥٠٠ قضية", "١٥ مستخدماً", "١٠٠ جيجا تخزين", "٣٠٠ طلب AI يومياً", "بوابة العملاء", "٣ فروع", "WhatsApp Business", "محرك سير العمل"],
  },
  {
    id: "advanced", name: "متقدم", nameEn: "Advanced", price: 999,
    monthlyPrice: 999, yearlyPrice: 799, color: "#EC4899",
    isFree: false, isContactOnly: false, popular: false,
    features: ["٢٠٠٠ قضية", "٣٠ مستخدماً", "٢٠٠ جيجا تخزين", "١٠٠٠ طلب AI يومياً", "نطاق خاص", "وصول API كامل", "مساعد مالي AI (CFO)", "White Label"],
  },
  {
    id: "enterprise", name: "مؤسسي", nameEn: "Enterprise", price: 2999,
    monthlyPrice: 2999, yearlyPrice: 2399, color: "#10B981",
    isFree: false, isContactOnly: false, popular: false,
    features: ["قضايا غير محدودة", "١٠٠ مستخدم", "١ تيرابايت تخزين", "AI غير محدود", "فروع غير محدودة", "SLA مضمون ٢٤/٧", "مدير حساب مخصص"],
  },
  {
    id: "elite", name: "النخبة", nameEn: "Elite", price: 9999,
    monthlyPrice: 9999, yearlyPrice: 7999, color: "#F59E0B",
    isFree: false, isContactOnly: true, popular: false,
    features: ["كل شيء غير محدود", "AI مدرَّب مخصص", "بنية تحتية خاصة", "SLA ٩٩.٩٩٪", "مدير نجاح مخصص", "دعم ٢٤/٧ فوري"],
  },
];

const PLAN_ORDER = ["free", "basic", "pro", "growth", "advanced", "enterprise", "elite"];

const KEY_LABELS: Record<string, string> = {
  AI_CALLS: "طلبات الذكاء الاصطناعي", CASES: "القضايا",
  CLIENTS: "الموكلون", USERS: "المستخدمون",
  STORAGE_GB: "التخزين (GB)", DOCUMENTS: "المستندات", INVOICES: "الفواتير",
};

/* ══════════════════════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════════════════════ */

router.get("/billing/plans", (_req, res) => res.json(PLANS));

router.get("/billing/stripe-status", async (_req, res) => {
  try {
    await getUncachableStripeClient();
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    res.json({ configured: true, mode: key.startsWith("sk_test") ? "test" : "live" });
  } catch {
    res.json({ configured: false, mode: "none" });
  }
});

/* ══════════════════════════════════════════════════════
   BILLING OVERVIEW — KPIs + Subscription + Alerts + Usage
══════════════════════════════════════════════════════ */
router.get("/billing/overview", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    /* 1. Current office plan */
    const officeRows = await db.execute(sql`SELECT plan FROM office_page ORDER BY created_at LIMIT 1`);
    const planSlug = ((officeRows as any)?.rows ?? [])[0]?.plan ?? "free";
    const planMeta = PLANS.find(p => p.id === planSlug) ?? PLANS[0];

    /* 0. Resolve tenant */
    const tenantId = await resolveTenantId(userId) ?? "default";

    /* 2. Entitlements / usage */
    const entRows = await db.execute(sql`
      SELECT key, "limit", used,
             CASE WHEN "limit" > 0 THEN LEAST(ROUND((used::numeric/"limit")*100),100) ELSE 0 END AS percent,
             CASE WHEN "limit" > 0 THEN GREATEST("limit"-used,0) ELSE 999999 END AS remaining
      FROM office_entitlements
      WHERE office_id = ${tenantId}
      ORDER BY key
    `);
    const entitlements = ((entRows as any)?.rows ?? []).map((e: any) => ({
      key: e.key, limit: Number(e.limit), used: Number(e.used),
      percent: Number(e.percent), remaining: Number(e.remaining),
    }));

    /* 3. Stripe subscription details */
    let stripeSubscription: any = null;
    let stripeCustomerId: string | null = null;
    let stripe: StripeClient | null = null;
    try { stripe = await getUncachableStripeClient(); } catch { }
    if (stripe) {
      try {
        const subs = await stripe.subscriptions.list({ limit: 1, expand: ["data.latest_invoice"] });
        if (subs.data.length > 0) {
          const s = subs.data[0];
          stripeSubscription = {
            id: s.id,
            status: s.status,
            currentPeriodStart: (s as any).current_period_start,
            currentPeriodEnd: (s as any).current_period_end,
            cancelAtPeriodEnd: s.cancel_at_period_end,
            latestInvoiceStatus: (s.latest_invoice as any)?.status ?? null,
          };
          stripeCustomerId = s.customer as string;
        }
      } catch { /* Stripe not configured */ }
    }

    /* 4. Billing alerts */
    const alerts: { type: "error" | "warning" | "info"; message: string; action?: string }[] = [];

    if (stripeSubscription?.status === "past_due") {
      alerts.push({ type: "error", message: "يوجد دفعة متأخرة — يرجى تحديث بيانات الدفع فوراً", action: "payment_methods" });
    }
    if (stripeSubscription?.status === "unpaid") {
      alerts.push({ type: "error", message: "فشلت عملية الدفع — الاشتراك موقوف مؤقتاً", action: "payment_methods" });
    }
    if (stripeSubscription?.cancelAtPeriodEnd) {
      const dt = new Date((stripeSubscription.currentPeriodEnd ?? 0) * 1000);
      alerts.push({ type: "warning", message: `الاشتراك سيتوقف في ${dt.toLocaleDateString("ar-SA")} — يمكنك إعادة التفعيل في أي وقت` });
    }
    if (planSlug === "free") {
      alerts.push({ type: "info", message: "أنت على الباقة المجانية — قم بالترقية للوصول إلى ميزات متقدمة", action: "plans" });
    }
    for (const ent of entitlements) {
      const label = KEY_LABELS[ent.key] ?? ent.key;
      if (ent.percent >= 95) {
        alerts.push({ type: "error", message: `تجاوزت ${ent.percent}% من حد ${label} — يُنصح بالترقية فوراً` });
      } else if (ent.percent >= 80) {
        alerts.push({ type: "warning", message: `اقتربت من حد ${label} (${ent.percent}% مستخدم)` });
      }
    }

    /* 5. MRR from ledger (last 30 days credits) */
    const mrrRows = await db.execute(sql`
      SELECT COALESCE(SUM(amount),0) AS mrr FROM office_ledger
      WHERE type='credit' AND created_at >= NOW() - INTERVAL '30 days'
    `);
    const mrr = Number(((mrrRows as any)?.rows ?? [])[0]?.mrr ?? 0);

    /* 6. Total paid to platform */
    const totalRows = await db.execute(sql`SELECT COALESCE(SUM(amount),0) AS total FROM office_ledger WHERE type='credit'`);
    const totalPaid = Number(((totalRows as any)?.rows ?? [])[0]?.total ?? 0);

    /* 7. Next billing date (platform invoice) */
    const nextInvRows = await db.execute(sql`
      SELECT due_date FROM platform_billing_invoices
      WHERE status='unpaid' ORDER BY due_date ASC LIMIT 1
    `);
    const nextDueDate = ((nextInvRows as any)?.rows ?? [])[0]?.due_date ?? null;

    return res.json({
      planSlug,
      planName: planMeta.name,
      planColor: planMeta.color,
      planPrice: planMeta.monthlyPrice,
      planOrder: PLAN_ORDER.indexOf(planSlug),
      stripeSubscription,
      stripeCustomerId,
      stripeConfigured: !!stripe,
      entitlements,
      alerts,
      mrr,
      totalPaid,
      nextDueDate,
    });
  } catch (err: any) {
    console.error("[billing/overview]", err);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   CHECKOUT + PAYMENT LINK
══════════════════════════════════════════════════════ */
router.post("/billing/checkout", async (req, res) => {
  let stripe: StripeClient;
  try { stripe = await getUncachableStripeClient(); } catch {
    return res.status(503).json({ error: "Stripe غير مهيأ", hint: "أضف STRIPE_SECRET_KEY أو فعّل تكامل Stripe" });
  }

  const { planId, successUrl, cancelUrl } = req.body as { planId: string; successUrl?: string; cancelUrl?: string };
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return res.status(400).json({ error: "الخطة غير موجودة" });
  if (plan.isFree || plan.isContactOnly) return res.status(400).json({ error: "هذه الباقة لا تتطلب دفعاً" });

  try {
    /* Resolve tenant + user email for this checkout */
    const { userId } = getAuth(req as any);
    const tenantId = userId ? (await resolveTenantId(userId) ?? "default") : "default";

    /* Get or create Stripe customer for this tenant */
    let customerId: string | undefined;
    try {
      const officeRow = await db.execute(sql`
        SELECT stripe_customer_id, email, name FROM office_page
        WHERE id::text = ${tenantId} OR (${tenantId} = 'default')
        ORDER BY created_at LIMIT 1
      `);
      const office = ((officeRow as any)?.rows ?? [])[0];
      if (office?.stripe_customer_id) {
        customerId = office.stripe_customer_id;
      } else if (office?.email) {
        const customer = await stripe.customers.create({
          email: office.email,
          name:  office.name ?? "عدالة AI Office",
          metadata: { officeId: tenantId },
        });
        customerId = customer.id;
        await db.execute(sql`
          UPDATE office_page SET stripe_customer_id = ${customerId}
          WHERE id::text = ${tenantId} OR (${tenantId} = 'default')
        `).catch(() => {});
      }
    } catch { /* non-critical — proceed without customer */ }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      ...(customerId ? { customer: customerId } : {}),
      line_items: [{
        price_data: {
          currency: "sar",
          unit_amount: plan.price * 100,
          recurring: { interval: "month" },
          product_data: { name: `عدالة AI — باقة ${plan.name}`, description: plan.features.join(" • ") },
        },
        quantity: 1,
      }],
      metadata: { plan: planId, planName: plan.name, officeId: tenantId },
      subscription_data: { metadata: { officeId: tenantId, plan: planId } },
      success_url: successUrl ?? `${req.headers.origin}/billing?success=1`,
      cancel_url:  cancelUrl  ?? `${req.headers.origin}/billing?canceled=1`,
      locale: "ar" as any,
    });
    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/billing/payment-link", async (req, res) => {
  let stripe: StripeClient;
  try { stripe = await getUncachableStripeClient(); } catch {
    return res.status(503).json({ error: "Stripe غير مهيأ", hint: "أضف STRIPE_SECRET_KEY أو فعّل تكامل Stripe" });
  }

  const { planId } = req.body as { planId: string };
  const plan = PLANS.find(p => p.id === planId);
  if (!plan || plan.isFree || plan.isContactOnly) return res.status(400).json({ error: "الباقة غير صالحة" });

  try {
    const product = await stripe.products.create({ name: `عدالة AI — باقة ${plan.name}` });
    const price = await stripe.prices.create({ product: product.id, unit_amount: plan.price * 100, currency: "sar", recurring: { interval: "month" } });
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: { type: "redirect", redirect: { url: `${req.headers.origin ?? "https://adala.app"}/billing?success=1` } },
    });
    return res.json({ url: paymentLink.url, id: paymentLink.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   STRIPE SUBSCRIPTION DETAILS
══════════════════════════════════════════════════════ */
router.get("/billing/stripe-subscription", async (req, res) => {
  let stripe: StripeClient | null = null;
  try { stripe = await getUncachableStripeClient(); } catch { }
  if (!stripe) return res.json({ configured: false, subscription: null });
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const subs = await stripe.subscriptions.list({ limit: 1 });
    if (subs.data.length === 0) return res.json({ configured: true, subscription: null });
    const s = subs.data[0];
    return res.json({
      configured: true,
      subscription: {
        id: s.id, status: s.status,
        currentPeriodStart: (s as any).current_period_start,
        currentPeriodEnd: (s as any).current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        amount: (s.items.data[0]?.price?.unit_amount ?? 0) / 100,
        interval: s.items.data[0]?.price?.recurring?.interval ?? "month",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   STRIPE INVOICES
══════════════════════════════════════════════════════ */
router.get("/billing/stripe-invoices", async (req, res) => {
  let stripe: StripeClient | null = null;
  try { stripe = await getUncachableStripeClient(); } catch { }
  if (!stripe) return res.json([]);
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const invoices = await stripe.invoices.list({ limit: 20 });
    return res.json(invoices.data.map(inv => ({
      id: inv.id,
      amount: (inv.amount_paid ?? 0) / 100,
      currency: inv.currency,
      status: inv.status,
      date: inv.created,
      pdf: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
      description: inv.description ?? `فاتورة ${new Date(inv.created * 1000).toLocaleDateString("ar-SA")}`,
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   REVENUE ANALYTICS (Admin)
══════════════════════════════════════════════════════ */
router.get("/billing/revenue", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    let stripe: StripeClient | null = null;
    try { stripe = await getUncachableStripeClient(); } catch { }
    let stripeRevenue = { total: 0, transactions: 0, recent: [] as any[] };

    if (stripe) {
      try {
        const charges = await stripe.charges.list({ limit: 100 });
        stripeRevenue.total = charges.data.reduce((s, c) => s + (c.status === "succeeded" ? c.amount / 100 : 0), 0);
        stripeRevenue.transactions = charges.data.filter(c => c.status === "succeeded").length;
        stripeRevenue.recent = charges.data.slice(0, 10).map(c => ({
          id: c.id, amount: c.amount / 100, currency: c.currency,
          status: c.status, date: c.created, description: c.description,
        }));
      } catch { /* Stripe not configured */ }
    }

    /* Monthly breakdown from ledger */
    const monthlyRows = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        SUM(CASE WHEN type='credit' THEN amount ELSE 0 END) AS revenue,
        SUM(CASE WHEN type='debit' THEN amount ELSE 0 END) AS expenses,
        COUNT(*) AS transactions
      FROM office_ledger
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `);
    const monthly = ((monthlyRows as any)?.rows ?? []).map((r: any) => ({
      month: r.month, revenue: Number(r.revenue), expenses: Number(r.expenses), transactions: Number(r.transactions),
    }));

    /* Total platform revenue */
    const totRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END),0) AS total_revenue,
        COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END),0) AS total_expenses,
        COUNT(*) AS total_transactions
      FROM office_ledger
    `);
    const totals = ((totRow as any)?.rows ?? [])[0] ?? {};

    /* Plan distribution */
    const planDistRows = await db.execute(sql`
      SELECT plan, COUNT(*) AS count FROM office_page GROUP BY plan ORDER BY count DESC
    `);
    const planDistribution = ((planDistRows as any)?.rows ?? []).map((r: any) => ({
      plan: r.plan, count: Number(r.count),
    }));

    return res.json({
      stripe: stripeRevenue,
      monthly,
      totals: {
        totalRevenue: Number(totals.total_revenue ?? 0),
        totalExpenses: Number(totals.total_expenses ?? 0),
        totalTransactions: Number(totals.total_transactions ?? 0),
      },
      planDistribution,
    });
  } catch (err: any) {
    console.error("[billing/revenue]", err);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   CHANGE PLAN (upgrade / downgrade)
══════════════════════════════════════════════════════ */
router.post("/billing/change-plan", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const { planId } = req.body as { planId: string };
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ error: "الباقة غير موجودة" });

    const officeId = await resolveTenantId(userId) ?? "default";
    const currentRows = await db.execute(sql`SELECT plan FROM office_page ORDER BY created_at LIMIT 1`);
    const oldPlan = ((currentRows as any)?.rows ?? [])[0]?.plan ?? "free";

    const { clerkClient } = await import("@clerk/express");
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? "unknown";
    const { provisionTenant } = await import("../services/tenantProvisioning");
    await provisionTenant({ officeId, plan: planId, email });

    const oldIdx = PLAN_ORDER.indexOf(oldPlan);
    const newIdx = PLAN_ORDER.indexOf(planId);
    const direction = newIdx > oldIdx ? "upgrade" : newIdx < oldIdx ? "downgrade" : "same";
    const oldPlanObj = PLANS.find(p => p.id === oldPlan);

    if (direction !== "same") {
      const title = direction === "upgrade" ? `✅ تمت الترقية إلى ${plan.name}` : `⚠️ تم التخفيض إلى ${plan.name}`;
      const message = direction === "upgrade"
        ? `تم ترقية الباقة من "${oldPlanObj?.name ?? oldPlan}" إلى "${plan.name}" بنجاح.`
        : `تم تخفيض الباقة من "${oldPlanObj?.name ?? oldPlan}" إلى "${plan.name}".`;
      await db.execute(sql`
        INSERT INTO plan_notifications (office_id, type, old_plan, new_plan, title, message, is_read)
        VALUES (${officeId}, ${direction}, ${oldPlan}, ${planId}, ${title}, ${message}, FALSE)
      `);
    }

    return res.json({ ok: true, oldPlan, newPlan: planId, direction, planName: plan.name });
  } catch (err: any) {
    console.error("[billing/change-plan]", err);
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ACTIVATE PLAN (super-admin only)
══════════════════════════════════════════════════════ */
router.post("/billing/activate-plan", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { clerkClient } = await import("@clerk/express");
    const clerkUser = await clerkClient.users.getUser(userId);
    const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    const userEmail  = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
    const isSuperAdmin = (ownerEmail && userEmail === ownerEmail) || clerkUser.publicMetadata?.role === "super_admin";
    if (!isSuperAdmin) return res.status(403).json({ error: "يتطلب صلاحية المشرف العام" });

    const { plan = "pro" } = req.body as { plan: string };
    const officeId = await resolveTenantId(userId) ?? "default";
    const { provisionTenant } = await import("../services/tenantProvisioning");
    const result = await provisionTenant({ officeId, plan, email: userEmail });
    res.json({ ok: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   LEDGER
══════════════════════════════════════════════════════ */
router.get("/billing/ledger", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const tenantId = await resolveTenantId(userId) ?? "default";
    const r = await db.execute(sql`
      SELECT id, type, amount, currency, ref, description, stripe_id,
             platform_fee, stripe_fee, net_amount, created_at
      FROM office_ledger WHERE office_id = ${tenantId}
      ORDER BY created_at DESC LIMIT 100
    `);
    res.json((r as any)?.rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   PLATFORM BILLING INVOICES
══════════════════════════════════════════════════════ */
router.get("/billing/platform-invoices", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const r = await db.execute(sql`
      SELECT id, plan_id, plan_name, amount, currency, status,
             billing_cycle, issue_date, due_date, paid_at, notes, created_at
      FROM platform_billing_invoices ORDER BY created_at DESC LIMIT 50
    `);
    res.json((r as any)?.rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/billing/platform-invoices/stats", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const r = await db.execute(sql`
      SELECT
        COUNT(*)::int                                            AS total,
        COUNT(*) FILTER (WHERE status='paid')::int             AS paid,
        COUNT(*) FILTER (WHERE status='unpaid')::int           AS unpaid,
        COUNT(*) FILTER (WHERE status='overdue')::int          AS overdue,
        COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)   AS total_paid,
        COALESCE(SUM(amount) FILTER (WHERE status='unpaid'),0) AS total_pending
      FROM platform_billing_invoices
    `);
    res.json(((r as any)?.rows ?? [])[0] ?? {});
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/billing/subscribe", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { planId } = req.body as { planId: string };
    const plan = PLANS.find(p => p.id === planId);
    if (!plan || plan.isFree) return res.status(400).json({ error: "الباقة غير صالحة" });
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const invoiceId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO platform_billing_invoices (id, plan_id, plan_name, amount, currency, status, billing_cycle, due_date)
      VALUES (${invoiceId}, ${planId}, ${plan.name}, ${plan.price}, 'SAR', 'unpaid', 'monthly', ${dueDate.toISOString()})
    `);
    res.json({ ok: true, invoiceId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/billing/pay/:id", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    await db.execute(sql`UPDATE platform_billing_invoices SET status='paid', paid_at=NOW() WHERE id=${req.params.id}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/billing/mark-overdue", async (_req, res) => {
  try {
    await db.execute(sql`UPDATE platform_billing_invoices SET status='overdue' WHERE status='unpaid' AND due_date < NOW()`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   BILLING ALERTS (standalone endpoint)
══════════════════════════════════════════════════════ */
router.get("/billing/alerts", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const alerts: { type: string; message: string; severity: number }[] = [];

    /* Check overdue invoices */
    const overdueRows = await db.execute(sql`SELECT COUNT(*)::int AS n FROM platform_billing_invoices WHERE status='overdue'`);
    const overdueCount = Number(((overdueRows as any)?.rows ?? [])[0]?.n ?? 0);
    if (overdueCount > 0) alerts.push({ type: "overdue_invoice", message: `${overdueCount} فاتورة متأخرة`, severity: 3 });

    /* Check usage > 80% */
    const highUsageRows = await db.execute(sql`
      SELECT key, "limit", used FROM office_entitlements
      WHERE office_id=(SELECT COALESCE((SELECT office_id FROM office_members WHERE user_id=(SELECT id FROM users ORDER BY created_at LIMIT 1) LIMIT 1),'default'))
        AND "limit">0 AND (used::numeric/"limit") >= 0.8
    `);
    for (const row of (highUsageRows as any)?.rows ?? []) {
      const pct = Math.round((Number(row.used) / Number(row.limit)) * 100);
      const label = KEY_LABELS[row.key] ?? row.key;
      alerts.push({ type: "usage_limit", message: `${pct}% من حد ${label} مستخدم`, severity: pct >= 95 ? 3 : 2 });
    }

    res.json(alerts.sort((a, b) => b.severity - a.severity));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   FEE CALCULATOR — شفافية الرسوم قبل الدفع
   GET /api/billing/calc-fee?amount=500
══════════════════════════════════════════════════════ */
router.get("/billing/calc-fee", (req, res) => {
  const amount = parseFloat(String(req.query.amount ?? "0"));
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "يجب إدخال مبلغ صالح أكبر من الصفر" });
  }
  const PLATFORM_FEE_PCT = 0.10;   // 10% عمولة المنصة
  const STRIPE_FEE_PCT   = 0.029;  // 2.9% رسوم Stripe
  const STRIPE_FIXED     = 1.00;   // 1 SAR ثابت لكل معاملة

  const platformFee = parseFloat((amount * PLATFORM_FEE_PCT).toFixed(2));
  const stripeFee   = parseFloat((amount * STRIPE_FEE_PCT + STRIPE_FIXED).toFixed(2));
  const net         = parseFloat((amount - platformFee - stripeFee).toFixed(2));
  const totalFees   = parseFloat((platformFee + stripeFee).toFixed(2));

  return res.json({
    gross:          amount,
    platformFee,
    stripeFee,
    totalFees,
    net,
    currency:       "SAR",
    breakdown: {
      platformFeePct: "10%",
      stripeFeePct:   "2.9% + 1 SAR",
    },
  });
});

/* ══════════════════════════════════════════════════════
   REVENUE REPORT — تقرير الإيرادات التفصيلي
   GET /api/billing/revenue-report
══════════════════════════════════════════════════════ */
router.get("/billing/revenue-report", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    /* Totals with breakdown */
    const totals = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount),0)::numeric         AS gross_total,
        COALESCE(SUM(platform_fee),0)::numeric   AS platform_fee_total,
        COALESCE(SUM(stripe_fee),0)::numeric     AS stripe_fee_total,
        COALESCE(SUM(net_amount),0)::numeric     AS net_total,
        COUNT(*)::int                            AS transaction_count
      FROM office_ledger
      WHERE type = 'credit'
    `);
    const t = ((totals as any)?.rows ?? [])[0] ?? {};

    /* Monthly chart — last 12 months */
    const monthly = await db.execute(sql`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM')             AS month,
        COALESCE(SUM(amount),0)::numeric           AS gross,
        COALESCE(SUM(platform_fee),0)::numeric     AS platform_fee,
        COALESCE(SUM(stripe_fee),0)::numeric       AS stripe_fee,
        COALESCE(SUM(net_amount),0)::numeric       AS net,
        COUNT(*)::int                              AS transactions
      FROM office_ledger
      WHERE type = 'credit'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    /* Recent transactions */
    const recent = await db.execute(sql`
      SELECT id, ref, description, amount, platform_fee, stripe_fee, net_amount,
             stripe_id, stripe_event_id, created_at
      FROM office_ledger
      WHERE type = 'credit'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    return res.json({
      totals: {
        gross:        parseFloat(t.gross_total    ?? "0"),
        platformFee:  parseFloat(t.platform_fee_total ?? "0"),
        stripeFee:    parseFloat(t.stripe_fee_total   ?? "0"),
        net:          parseFloat(t.net_total      ?? "0"),
        transactions: Number(t.transaction_count ?? 0),
      },
      monthly: ((monthly as any)?.rows ?? []).map((r: any) => ({
        month:        r.month,
        gross:        parseFloat(r.gross),
        platformFee:  parseFloat(r.platform_fee),
        stripeFee:    parseFloat(r.stripe_fee),
        net:          parseFloat(r.net),
        transactions: Number(r.transactions),
      })),
      recent: ((recent as any)?.rows ?? []),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
