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
    id: "basic",
    name: "الأساسية",
    nameEn: "Basic",
    price: 299,
    currency: "sar",
    interval: "month",
    features: ["10 قضايا نشطة", "5 موظفين", "تحليل مستندات محدود", "دعم بريد إلكتروني"],
  },
  {
    id: "professional",
    name: "الاحترافية",
    nameEn: "Professional",
    price: 799,
    currency: "sar",
    interval: "month",
    features: ["قضايا غير محدودة", "50 موظف", "ذكاء اصطناعي متقدم", "إدارة موارد بشرية كاملة", "دعم أولوية"],
  },
  {
    id: "enterprise",
    name: "المؤسسية",
    nameEn: "Enterprise",
    price: 2499,
    currency: "sar",
    interval: "month",
    features: ["كل شيء في الاحترافية", "موظفون غير محدودون", "تقارير متقدمة", "API مخصص", "مدير حساب مخصص"],
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

export default router;
