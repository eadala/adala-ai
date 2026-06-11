import { Router } from "express";
import { db, invoicesTable, subscriptionsTable, usageLogsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import Stripe from "stripe";
import { getAuth } from "@clerk/express";

const router = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-04-30.basil" });
}

/* ── خطط الاشتراك ────────────────────────────────────── */
const PLANS = [
  {
    id: "advisor",
    name: "المستشار القانوني",
    nameEn: "Legal Advisor",
    price: 99,
    currency: "sar",
    interval: "month",
    trialMonth: true,
    features: ["قضايا محدودة + بحث قانوني", "50 عملية ذكاء اصطناعي", "إدارة الموكلين", "دعم بريد إلكتروني"],
  },
  {
    id: "solo",
    name: "المحامي الصغير",
    nameEn: "Solo Lawyer",
    price: 299,
    currency: "sar",
    interval: "month",
    trialMonth: true,
    popular: true,
    features: ["CRM + عقود + متجر وموقع", "200 عملية ذكاء اصطناعي", "إدارة الفواتير والمدفوعات", "دعم أولوية"],
  },
  {
    id: "office",
    name: "مكتب المحاماة",
    nameEn: "Law Office",
    price: 999,
    currency: "sar",
    interval: "month",
    features: ["بوابة الموكل + تقارير مالية", "1,000 عملية ذكاء اصطناعي", "إدارة الموارد البشرية", "نظام الحضور والرواتب"],
  },
  {
    id: "advanced",
    name: "المكتب المتقدم",
    nameEn: "Advanced Office",
    price: 4999,
    currency: "sar",
    interval: "month",
    features: ["محاكي خصم + أدوات متقدمة", "5,000 عملية ذكاء اصطناعي", "تحليلات وتقارير متقدمة", "API مخصص"],
  },
  {
    id: "corporate",
    name: "الشركات القانونية",
    nameEn: "Legal Corporations",
    price: 9999,
    currency: "sar",
    interval: "month",
    features: ["ميزات كاملة + دعم خاص", "ذكاء اصطناعي غير محدود", "مدير حساب مخصص", "SLA مضمون"],
  },
  {
    id: "enterprise",
    name: "باقة المؤسسات",
    nameEn: "Enterprise",
    price: 0,
    currency: "sar",
    interval: "month",
    contactOnly: true,
    features: ["تخصيص كامل حسب احتياجاتك", "ذكاء اصطناعي غير محدود", "تكامل مع أنظمتك الحالية", "دعم مخصص على مدار الساعة"],
  },
];

router.get("/billing/plans", (_req, res) => {
  res.json(PLANS);
});

/* ── إنشاء جلسة Checkout ────────────────────────────── */
router.post("/billing/checkout", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error: "Stripe غير مهيأ",
      hint: "أضف STRIPE_SECRET_KEY في Secrets",
    });
  }

  const { planId, successUrl, cancelUrl } = req.body as {
    planId: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return res.status(400).json({ error: "الخطة غير موجودة" });

  try {
    /* officeId always server-resolved — never trust client */
    const officeId = "default";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            unit_amount: plan.price * 100,
            recurring: { interval: plan.interval as "month" },
            product_data: {
              name: `عدالة AI — باقة ${plan.name}`,
              description: plan.features.join(" • "),
            },
          },
          quantity: 1,
        },
      ],
      metadata: { plan: planId, officeId, planName: plan.name },
      success_url: successUrl ?? `${req.headers.origin}/billing?success=1`,
      cancel_url: cancelUrl ?? `${req.headers.origin}/billing?canceled=1`,
      locale: "ar",
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── إنشاء Payment Link ────────────────────────────── */
router.post("/billing/payment-link", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error: "Stripe غير مهيأ",
      hint: "أضف STRIPE_SECRET_KEY في Secrets",
    });
  }

  const { planId } = req.body as { planId: string };
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return res.status(400).json({ error: "الخطة غير موجودة" });

  try {
    const product = await stripe.products.create({
      name: `عدالة AI — باقة ${plan.name}`,
      description: plan.features.join(" • "),
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price * 100,
      currency: plan.currency,
      recurring: { interval: plan.interval as "month" },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: {
        type: "redirect",
        redirect: { url: `${req.headers.origin ?? "https://adala.app"}/billing?success=1` },
      },
    });

    return res.json({ url: paymentLink.url, id: paymentLink.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── حالة Stripe ────────────────────────────────────── */
router.get("/billing/stripe-status", (_req, res) => {
  const hasSecret = !!process.env.STRIPE_SECRET_KEY;
  const hasPub = !!process.env.STRIPE_PUBLISHABLE_KEY;
  res.json({ configured: hasSecret, hasPublishableKey: hasPub, mode: hasSecret && process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test" : "live" });
});

/* ── الفواتير ─────────────────────────────────────── */
router.get("/billing/invoices", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const invoices = await db.select().from(invoicesTable).orderBy(invoicesTable.createdAt);
    res.json(invoices.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })));
  } catch (e: any) {
    console.error("[billing/invoices]", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/billing/subscription", async (_req, res) => {
  try {
    const [sub] = await db.select().from(subscriptionsTable).limit(1);
    if (!sub) return res.status(404).json({ error: "No subscription found" });
    res.json({ ...sub, startDate: sub.startDate.toISOString(), endDate: sub.endDate.toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/billing/usage", async (_req, res) => {
  try {
    const logs = await db.select().from(usageLogsTable).orderBy(usageLogsTable.createdAt);
    res.json(logs.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Ledger ───────────────────────────────────────── */
router.get("/billing/ledger", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    /* officeId always server-resolved — never trust x-office-id header */
    const officeId = "default";
    const r = await db.execute(sql`
      SELECT id, type, amount, currency, ref, description, stripe_id, created_at
      FROM office_ledger
      WHERE office_id = ${officeId}
      ORDER BY created_at DESC
      LIMIT 100
    `);
    const rows = (r as any)?.rows ?? [];
    res.json(rows);
  } catch (e: any) {
    console.error("[billing/ledger]", e);
    res.status(500).json({ error: e.message });
  }
});

/* ── تغيير الباقة (ترقية / تخفيض) — لأي مستخدم مصرح ── */
router.post("/billing/change-plan", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const { planId } = req.body as { planId: string };
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ error: "الباقة غير موجودة" });
    if ((plan as any).contactOnly) {
      return res.status(400).json({ error: "هذه الباقة تتطلب التواصل المباشر" });
    }

    const officeId = "default";

    /* Get current plan before change */
    const currentRows = await db.execute(
      sql`SELECT plan FROM office_page ORDER BY created_at LIMIT 1`
    );
    const oldPlan = (currentRows as any)?.rows?.[0]?.plan ?? "starter";

    /* Provision (upsert entitlements + update office plan) */
    const { clerkClient } = await import("@clerk/express");
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? "unknown";
    const { provisionTenant } = await import("../services/tenantProvisioning");
    await provisionTenant({ officeId, plan: planId, email });

    /* Create plan-change notification */
    const PLAN_ORDER = ["advisor","solo","office","advanced","corporate","enterprise"];
    const oldIdx = PLAN_ORDER.indexOf(oldPlan);
    const newIdx = PLAN_ORDER.indexOf(planId);
    const direction = newIdx > oldIdx ? "upgrade" : newIdx < oldIdx ? "downgrade" : "same";
    const oldPlanObj = PLANS.find(p => p.id === oldPlan);

    if (direction !== "same") {
      const title = direction === "upgrade"
        ? `✅ تمت الترقية إلى ${plan.name}`
        : `⚠️ تم التخفيض إلى ${plan.name}`;
      const message = direction === "upgrade"
        ? `تم ترقية الباقة من "${oldPlanObj?.name ?? oldPlan}" إلى "${plan.name}" بنجاح.`
        : `تم تخفيض الباقة من "${oldPlanObj?.name ?? oldPlan}" إلى "${plan.name}".`;

      await db.execute(sql`
        INSERT INTO plan_notifications (office_id, type, old_plan, new_plan, title, message, is_read)
        VALUES (${officeId}, ${direction}, ${oldPlan}, ${planId}, ${title}, ${message}, FALSE)
      `);
    }

    return res.json({
      ok: true,
      oldPlan,
      newPlan: planId,
      direction,
      planName: plan.name,
    });
  } catch (err: any) {
    console.error("[billing/change-plan]", err);
    return res.status(500).json({ error: err.message });
  }
});

/* ── Manual plan activation (super-admin only) ──────── */
router.post("/billing/activate-plan", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    /* Super-admin check: must be platform owner e-mail or Clerk publicMetadata.role=super_admin */
    const { clerkClient } = await import("@clerk/express");
    const clerkUser = await clerkClient.users.getUser(userId);
    const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    const userEmail  = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
    const isSuperAdmin =
      (ownerEmail && userEmail === ownerEmail) ||
      clerkUser.publicMetadata?.role === "super_admin";

    if (!isSuperAdmin) {
      return res.status(403).json({ error: "يتطلب صلاحية المشرف العام" });
    }

    const { plan = "basic" } = req.body as { plan: string };
    const officeId = "default"; // always server-resolved
    const { provisionTenant } = await import("../services/tenantProvisioning");
    const result = await provisionTenant({ officeId, plan, email: userEmail });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   PLATFORM BILLING INVOICES (SaaS Subscription Billing)
══════════════════════════════════════════════════════ */

/* ── قائمة فواتير الاشتراك للمكتب ───────────────────── */
router.get("/billing/platform-invoices", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const r = await db.execute(sql`
      SELECT id, plan_id, plan_name, amount, currency, status,
             billing_cycle, issue_date, due_date, paid_at, notes, created_at
      FROM platform_billing_invoices
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json((r as any)?.rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── إحصائيات فواتير الاشتراك للمكتب ────────────────── */
router.get("/billing/platform-invoices/stats", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const r = await db.execute(sql`
      SELECT
        COUNT(*)::int                                           AS total,
        COUNT(*) FILTER (WHERE status = 'paid')::int           AS paid,
        COUNT(*) FILTER (WHERE status = 'unpaid')::int         AS unpaid,
        COUNT(*) FILTER (WHERE status = 'overdue')::int        AS overdue,
        COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)   AS total_paid,
        COALESCE(SUM(amount) FILTER (WHERE status='unpaid'),0) AS total_pending
      FROM platform_billing_invoices
    `);
    res.json(((r as any)?.rows ?? [])[0] ?? {});
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── إنشاء اشتراك + فاتورة تلقائية ─────────────────── */
router.post("/billing/subscribe", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { planId } = req.body as { planId: string };
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ error: "الباقة غير موجودة" });
    if ((plan as any).contactOnly)
      return res.status(400).json({ error: "هذه الباقة تتطلب التواصل المباشر" });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const invoiceId = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO platform_billing_invoices
        (id, plan_id, plan_name, amount, currency, status, billing_cycle, due_date)
      VALUES
        (${invoiceId}, ${planId}, ${plan.name}, ${plan.price}, 'SAR', 'unpaid', 'monthly', ${dueDate.toISOString()})
    `);
    res.json({ ok: true, invoiceId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── تسديد فاتورة اشتراك ────────────────────────────── */
router.post("/billing/pay/:id", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { id } = req.params;
    await db.execute(sql`
      UPDATE platform_billing_invoices
      SET status = 'paid', paid_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── تحديث الفواتير المتأخرة (overdue) ──────────────── */
router.post("/billing/mark-overdue", async (_req, res) => {
  try {
    await db.execute(sql`
      UPDATE platform_billing_invoices
      SET status = 'overdue'
      WHERE status = 'unpaid' AND due_date < NOW()
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
