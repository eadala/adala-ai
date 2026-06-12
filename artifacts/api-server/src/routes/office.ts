import { Router } from "express";
import { db } from "@workspace/db";
import {
  officePageTable, officeServicesTable, officeTeamTable,
  officeOrdersTable, officeReviewsTable, officeArticlesTable,
  officeDomainsTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import Stripe from "stripe";

const router = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" as any });
}

/* ═══ PUBLIC ROUTES (no auth) ═══════════════════════════════ */

router.get("/office/public/:slug", async (req, res) => {
  const office = await db.select().from(officePageTable)
    .where(and(eq(officePageTable.slug, req.params.slug), eq(officePageTable.isPublished, true)))
    .limit(1);
  if (!office.length) return res.status(404).json({ error: "المكتب غير موجود" });

  const id = office[0].id;
  const [services, team, reviews, articles] = await Promise.all([
    db.select().from(officeServicesTable).where(and(eq(officeServicesTable.officeId, id), eq(officeServicesTable.isActive, true))),
    db.select().from(officeTeamTable).where(eq(officeTeamTable.officeId, id)),
    db.select().from(officeReviewsTable).where(and(eq(officeReviewsTable.officeId, id), eq(officeReviewsTable.isApproved, true))),
    db.select().from(officeArticlesTable).where(and(eq(officeArticlesTable.officeId, id), eq(officeArticlesTable.isPublished, true))).orderBy(desc(officeArticlesTable.publishedAt)).limit(6),
  ]);

  res.json({ office: office[0], services, team, reviews, articles });
});

/* POST: submit order / quote request (public) */
router.post("/office/public/:slug/order", async (req, res) => {
  const office = await db.select().from(officePageTable)
    .where(eq(officePageTable.slug, req.params.slug)).limit(1);
  if (!office.length) return res.status(404).json({ error: "المكتب غير موجود" });

  const { serviceId, clientName, clientPhone, clientEmail, notes, isQuoteRequest } = req.body;
  const officeId = office[0].id;

  let amount: string | null = null;
  if (serviceId) {
    const [svc] = await db.select().from(officeServicesTable).where(eq(officeServicesTable.id, serviceId)).limit(1);
    if (svc?.price) amount = svc.price;
  }

  const [order] = await db.insert(officeOrdersTable).values({
    officeId, serviceId: serviceId || null,
    clientName, clientPhone, clientEmail, notes,
    amount, isQuoteRequest: isQuoteRequest ?? false,
  }).returning();

  res.json({ success: true, orderId: order.id });
});

/* POST: Stripe checkout for a service (public) */
router.post("/office/public/:slug/checkout", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "الدفع الإلكتروني غير مفعّل حالياً" });

  const office = await db.select().from(officePageTable)
    .where(eq(officePageTable.slug, req.params.slug)).limit(1);
  if (!office.length) return res.status(404).json({ error: "المكتب غير موجود" });

  const { serviceId, clientName, clientPhone, clientEmail } = req.body;
  const [svc] = await db.select().from(officeServicesTable)
    .where(eq(officeServicesTable.id, serviceId)).limit(1);
  if (!svc) return res.status(404).json({ error: "الخدمة غير موجودة" });

  const origin = req.headers.origin ?? `https://adala.sa`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: clientEmail || undefined,
    line_items: [{
      price_data: {
        currency: "sar",
        unit_amount: Math.round(Number(svc.price) * 100),
        product_data: { name: `${svc.name} — ${office[0].name}`, description: svc.description ?? undefined },
      },
      quantity: 1,
    }],
    success_url: `${origin}/firms/${req.params.slug}?paid=1`,
    cancel_url: `${origin}/firms/${req.params.slug}`,
    metadata: { officeSlug: req.params.slug, serviceId, clientName, clientPhone },
  });

  // save order
  await db.insert(officeOrdersTable).values({
    officeId: office[0].id, serviceId,
    clientName, clientPhone, clientEmail,
    amount: svc.price, stripeSessionId: session.id,
  });

  res.json({ url: session.url });
});

/* POST: submit review (public) */
router.post("/office/public/:slug/review", async (req, res) => {
  const office = await db.select().from(officePageTable)
    .where(eq(officePageTable.slug, req.params.slug)).limit(1);
  if (!office.length) return res.status(404).json({ error: "المكتب غير موجود" });

  const { clientName, rating, comment } = req.body;
  await db.insert(officeReviewsTable).values({ officeId: office[0].id, clientName, rating, comment });
  res.json({ success: true });
});

/* ═══ MANAGEMENT ROUTES (auth assumed by middleware) ══════════ */

/* GET my office */
router.get("/office/my", async (_req, res) => {
  const offices = await db.select().from(officePageTable).limit(1);
  res.json(offices[0] ?? null);
});

/* POST create office */
router.post("/office/my", async (req, res) => {
  const [row] = await db.insert(officePageTable).values(req.body).returning();
  res.json(row);
});

/* PATCH update office */
router.patch("/office/my/:id", async (req, res) => {
  const [row] = await db.update(officePageTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(officePageTable.id, req.params.id)).returning();
  res.json(row);
});

/* ── Services ── */
router.get("/office/my/:officeId/services", async (req, res) => {
  const rows = await db.select().from(officeServicesTable)
    .where(eq(officeServicesTable.officeId, req.params.officeId));
  res.json(rows);
});
router.post("/office/my/:officeId/services", async (req, res) => {
  const [row] = await db.insert(officeServicesTable)
    .values({ ...req.body, officeId: req.params.officeId }).returning();
  res.json(row);
});
router.patch("/office/my/services/:id", async (req, res) => {
  const [row] = await db.update(officeServicesTable).set(req.body)
    .where(eq(officeServicesTable.id, req.params.id)).returning();
  res.json(row);
});
router.delete("/office/my/services/:id", async (req, res) => {
  await db.delete(officeServicesTable).where(eq(officeServicesTable.id, req.params.id));
  res.json({ success: true });
});

/* ── Team ── */
router.get("/office/my/:officeId/team", async (req, res) => {
  const rows = await db.select().from(officeTeamTable)
    .where(eq(officeTeamTable.officeId, req.params.officeId));
  res.json(rows);
});
router.post("/office/my/:officeId/team", async (req, res) => {
  const [row] = await db.insert(officeTeamTable)
    .values({ ...req.body, officeId: req.params.officeId }).returning();
  res.json(row);
});
router.patch("/office/my/team/:id", async (req, res) => {
  const [row] = await db.update(officeTeamTable).set(req.body)
    .where(eq(officeTeamTable.id, req.params.id)).returning();
  res.json(row);
});
router.delete("/office/my/team/:id", async (req, res) => {
  await db.delete(officeTeamTable).where(eq(officeTeamTable.id, req.params.id));
  res.json({ success: true });
});

/* ── Orders ── */
router.get("/office/my/:officeId/orders", async (req, res) => {
  const rows = await db.select().from(officeOrdersTable)
    .where(eq(officeOrdersTable.officeId, req.params.officeId))
    .orderBy(desc(officeOrdersTable.createdAt));
  res.json(rows);
});
router.patch("/office/my/orders/:id", async (req, res) => {
  const [row] = await db.update(officeOrdersTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(officeOrdersTable.id, req.params.id)).returning();
  res.json(row);
});

/* ── Reviews ── */
router.get("/office/my/:officeId/reviews", async (req, res) => {
  const rows = await db.select().from(officeReviewsTable)
    .where(eq(officeReviewsTable.officeId, req.params.officeId))
    .orderBy(desc(officeReviewsTable.createdAt));
  res.json(rows);
});
router.patch("/office/my/reviews/:id", async (req, res) => {
  const [row] = await db.update(officeReviewsTable).set(req.body)
    .where(eq(officeReviewsTable.id, req.params.id)).returning();
  res.json(row);
});
router.delete("/office/my/reviews/:id", async (req, res) => {
  await db.delete(officeReviewsTable).where(eq(officeReviewsTable.id, req.params.id));
  res.json({ success: true });
});

/* ── Articles ── */
router.get("/office/my/:officeId/articles", async (req, res) => {
  const rows = await db.select().from(officeArticlesTable)
    .where(eq(officeArticlesTable.officeId, req.params.officeId))
    .orderBy(desc(officeArticlesTable.createdAt));
  res.json(rows);
});
router.post("/office/my/:officeId/articles", async (req, res) => {
  const [row] = await db.insert(officeArticlesTable)
    .values({ ...req.body, officeId: req.params.officeId }).returning();
  res.json(row);
});
router.patch("/office/my/articles/:id", async (req, res) => {
  const [row] = await db.update(officeArticlesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(officeArticlesTable.id, req.params.id)).returning();
  res.json(row);
});
router.delete("/office/my/articles/:id", async (req, res) => {
  await db.delete(officeArticlesTable).where(eq(officeArticlesTable.id, req.params.id));
  res.json({ success: true });
});

/* ═══ DOMAINS ═══════════════════════════════════════════════ */

router.get("/office/my/:officeId/domains", async (req, res) => {
  const { officeId } = req.params;
  const rows = await db.select().from(officeDomainsTable).where(eq(officeDomainsTable.officeId, officeId));
  res.json(rows[0] ?? null);
});

router.post("/office/my/:officeId/domains", async (req, res) => {
  const { officeId } = req.params;
  const [office] = await db.select().from(officePageTable).where(eq(officePageTable.id, officeId));
  if (!office) return res.status(404).json({ error: "not found" });
  const existing = await db.select().from(officeDomainsTable).where(eq(officeDomainsTable.officeId, officeId));
  if (existing[0]) {
    const [updated] = await db.update(officeDomainsTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(officeDomainsTable.officeId, officeId)).returning();
    return res.json(updated);
  }
  const { randomBytes } = await import("crypto");
  const token = randomBytes(16).toString("hex");
  const [created] = await db.insert(officeDomainsTable).values({
    officeId, subdomain: office.slug, verificationToken: token, ...req.body,
  }).returning();
  res.json(created);
});

router.patch("/office/my/domains/:id", async (req, res) => {
  const body: any = { ...req.body, updatedAt: new Date() };
  if (body.customDomain === "") body.customDomain = null;
  const [updated] = await db.update(officeDomainsTable).set(body)
    .where(eq(officeDomainsTable.id, req.params.id)).returning();
  res.json(updated);
});

router.post("/office/my/domains/:id/verify", async (req, res) => {
  const [updated] = await db.update(officeDomainsTable)
    .set({ isVerified: true, sslEnabled: true, verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(officeDomainsTable.id, req.params.id)).returning();
  res.json(updated);
});

router.delete("/office/my/domains/:id/custom", async (req, res) => {
  const [updated] = await db.update(officeDomainsTable)
    .set({ customDomain: null, isVerified: false, sslEnabled: false, verifiedAt: null, updatedAt: new Date() })
    .where(eq(officeDomainsTable.id, req.params.id)).returning();
  res.json(updated);
});

/* ═══ PLAN ═══════════════════════════════════════════════════ */

router.patch("/office/my/:officeId/plan", async (req, res) => {
  const { plan } = req.body;
  const [updated] = await db.update(officePageTable).set({ plan, updatedAt: new Date() })
    .where(eq(officePageTable.id, req.params.officeId)).returning();
  res.json(updated);
});

export default router;
