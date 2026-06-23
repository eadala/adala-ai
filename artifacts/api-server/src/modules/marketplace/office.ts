import { requireAuth } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  officePageTable, officeServicesTable, officeTeamTable,
  officeOrdersTable, officeReviewsTable, officeArticlesTable,
  officeDomainsTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";

const router = Router();

/* ═══ PUBLIC ROUTES (no auth) ═══════════════════════════════ */

router.get("/office/public/:slug", async (req, res) => {
  /* Accept any office with a matching slug — published OR draft.
     Frontend shows a "coming soon" banner when isPublished = false. */
  const office = await db.select().from(officePageTable)
    .where(eq(officePageTable.slug, String(req.params.slug)))
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
    .where(eq(officePageTable.slug, String(req.params.slug))).limit(1);
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
  let stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>;
  try { stripe = await getUncachableStripeClient(); }
  catch { return res.status(503).json({ error: "الدفع الإلكتروني غير مفعّل حالياً" }); }

  const office = await db.select().from(officePageTable)
    .where(eq(officePageTable.slug, String(req.params.slug))).limit(1);
  if (!office.length) return res.status(404).json({ error: "المكتب غير موجود" });

  const { serviceId, clientName, clientPhone, clientEmail } = req.body;
  const [svc] = await db.select().from(officeServicesTable)
    .where(eq(officeServicesTable.id, serviceId)).limit(1);
  if (!svc) return res.status(404).json({ error: "الخدمة غير موجودة" });

  /* Use configured canonical URL — never trust req.headers.origin to avoid redirect hijacking */
  const appUrl = process.env.APP_URL
    ?? (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "https://adala.sa");
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
    success_url: `${appUrl}/firms/${String(req.params.slug)}?paid=1&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/firms/${String(req.params.slug)}`,
    metadata: { officeSlug: String(req.params.slug), serviceId, clientName, clientPhone, clientEmail: clientEmail ?? "" },
  });

  // save order
  await db.insert(officeOrdersTable).values({
    officeId: office[0].id, serviceId,
    clientName, clientPhone, clientEmail,
    amount: svc.price, stripeSessionId: session.id,
  });

  res.json({ url: session.url });
});

/* GET: check order success & retrieve portal token (public — called after Stripe redirect) */
router.get("/office/public/:slug/order-success", async (req, res) => {
  const { sessionId } = req.query as { sessionId?: string };
  if (!sessionId) { res.status(400).json({ error: "sessionId مطلوب" }); return; }
  try {
    const db2 = db as any;
    const sql2 = (await import("drizzle-orm")).sql;

    /* Validate: join on slug ensures session belongs to THIS office */
    const rows = await db2.execute(sql2`
      SELECT oo.auto_case_id, oo.portal_token, oo.client_name, oo.client_email,
             oo.status, os.name AS service_name, op.name AS office_name
      FROM   office_orders oo
      JOIN   office_page   op ON op.id = oo.office_id AND op.slug = ${String(req.params.slug)}
      LEFT JOIN office_services os ON os.id::text = oo.service_id::text
      WHERE  oo.stripe_session_id = ${sessionId}
      LIMIT  1
    `);
    const row = (rows?.rows ?? rows)?.[0] ?? null;

    if (!row) {
      /* Not found: either still pending or session doesn't belong to this slug */
      res.json({ status: "pending" });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({
      status:      row.status ?? "paid",
      caseId:      row.auto_case_id ?? null,
      portalUrl:   row.portal_token ? `${baseUrl}/portal/${row.portal_token}` : null,
      clientName:  row.client_name ?? null,
      serviceName: row.service_name ?? null,
      officeName:  row.office_name ?? null,
    });
  } catch (e: any) {
        res.json({ status: "pending" });
  }
});

/* POST: submit review (public) */
router.post("/office/public/:slug/review", async (req, res) => {
  const office = await db.select().from(officePageTable)
    .where(eq(officePageTable.slug, String(req.params.slug))).limit(1);
  if (!office.length) return res.status(404).json({ error: "المكتب غير موجود" });

  const { clientName, rating, comment } = req.body;
  await db.insert(officeReviewsTable).values({ officeId: office[0].id, clientName, rating, comment });
  res.json({ success: true });
});

/* ═══ MANAGEMENT ROUTES (auth assumed by middleware) ══════════ */

/* GET my office */
router.get("/office/my", requireAuth, async (_req, res) => {
  const offices = await db.select().from(officePageTable).limit(1);
  res.json(offices[0] ?? null);
});

/* POST create office */
router.post("/office/my", requireAuth, async (req: any, res) => {
  const { userId } = (req as any);
  const [row] = await db.insert(officePageTable).values(req.body).returning();
  if (row?.id && userId) {
    /* Link owner to this office */
    db.execute(sql`
      INSERT INTO office_members (office_id, user_id, role, status)
      VALUES (${String(row.id)}, ${userId}, 'owner', 'active')
      ON CONFLICT DO NOTHING
    `).catch(() => {});
    db.execute(sql`
      INSERT INTO office_registry (id, clerk_user_id, office_name, status)
      VALUES (${String(row.id)}, ${userId}, ${req.body.name ?? ''}, 'active')
      ON CONFLICT (id) DO UPDATE SET clerk_user_id = EXCLUDED.clerk_user_id
    `).catch(() => {});
    db.execute(sql`
      UPDATE users SET office_id = ${String(row.id)}
      WHERE id = ${userId} AND office_id IS NULL
    `).catch(() => {});
  }
  res.json(row);
});

/* PATCH update office — slug is platform-only, stripped here */
router.patch("/office/my/:id", requireAuth, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { slug: _slug, ...safeBody } = req.body;
  const [row] = await db.update(officePageTable)
    .set({ ...safeBody, updatedAt: new Date() })
    .where(eq(officePageTable.id, String(req.params.id))).returning();
  res.json(row);
});

/* ── Services ── */
router.get("/office/my/:officeId/services", requireAuth, async (req, res) => {
  const rows = await db.select().from(officeServicesTable)
    .where(eq(officeServicesTable.officeId, String(req.params.officeId)));
  res.json(rows);
});
router.post("/office/my/:officeId/services", requireAuth, async (req, res) => {
  const [row] = await db.insert(officeServicesTable)
    .values({ ...req.body, officeId: String(req.params.officeId) }).returning();
  res.json(row);
});
router.patch("/office/my/services/:id", requireAuth, async (req, res) => {
  const [row] = await db.update(officeServicesTable).set(req.body)
    .where(eq(officeServicesTable.id, String(req.params.id))).returning();
  res.json(row);
});
router.delete("/office/my/services/:id", requireAuth, async (req, res) => {
  await db.delete(officeServicesTable).where(eq(officeServicesTable.id, String(req.params.id)));
  res.json({ success: true });
});

/* ── Team ── */
router.get("/office/my/:officeId/team", requireAuth, async (req, res) => {
  const rows = await db.select().from(officeTeamTable)
    .where(eq(officeTeamTable.officeId, String(req.params.officeId)));
  res.json(rows);
});
router.post("/office/my/:officeId/team", requireAuth, async (req, res) => {
  const [row] = await db.insert(officeTeamTable)
    .values({ ...req.body, officeId: String(req.params.officeId) }).returning();
  res.json(row);
});
router.patch("/office/my/team/:id", requireAuth, async (req, res) => {
  const [row] = await db.update(officeTeamTable).set(req.body)
    .where(eq(officeTeamTable.id, String(req.params.id))).returning();
  res.json(row);
});
router.delete("/office/my/team/:id", requireAuth, async (req, res) => {
  await db.delete(officeTeamTable).where(eq(officeTeamTable.id, String(req.params.id)));
  res.json({ success: true });
});

/* ── Orders ── */
router.get("/office/my/:officeId/orders", requireAuth, async (req, res) => {
  const rows = await db.select().from(officeOrdersTable)
    .where(eq(officeOrdersTable.officeId, String(req.params.officeId)))
    .orderBy(desc(officeOrdersTable.createdAt));
  res.json(rows);
});
router.patch("/office/my/orders/:id", requireAuth, async (req, res) => {
  const [row] = await db.update(officeOrdersTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(officeOrdersTable.id, String(req.params.id))).returning();
  res.json(row);
});

/* ── Reviews ── */
router.get("/office/my/:officeId/reviews", requireAuth, async (req, res) => {
  const rows = await db.select().from(officeReviewsTable)
    .where(eq(officeReviewsTable.officeId, String(req.params.officeId)))
    .orderBy(desc(officeReviewsTable.createdAt));
  res.json(rows);
});
router.patch("/office/my/reviews/:id", requireAuth, async (req, res) => {
  const [row] = await db.update(officeReviewsTable).set(req.body)
    .where(eq(officeReviewsTable.id, String(req.params.id))).returning();
  res.json(row);
});
router.delete("/office/my/reviews/:id", requireAuth, async (req, res) => {
  await db.delete(officeReviewsTable).where(eq(officeReviewsTable.id, String(req.params.id)));
  res.json({ success: true });
});

/* ── Articles ── */
router.get("/office/my/:officeId/articles", requireAuth, async (req, res) => {
  const rows = await db.select().from(officeArticlesTable)
    .where(eq(officeArticlesTable.officeId, String(req.params.officeId)))
    .orderBy(desc(officeArticlesTable.createdAt));
  res.json(rows);
});
router.post("/office/my/:officeId/articles", requireAuth, async (req, res) => {
  const [row] = await db.insert(officeArticlesTable)
    .values({ ...req.body, officeId: String(req.params.officeId) }).returning();
  res.json(row);
});
router.patch("/office/my/articles/:id", requireAuth, async (req, res) => {
  const [row] = await db.update(officeArticlesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(officeArticlesTable.id, String(req.params.id))).returning();
  res.json(row);
});
router.delete("/office/my/articles/:id", requireAuth, async (req, res) => {
  await db.delete(officeArticlesTable).where(eq(officeArticlesTable.id, String(req.params.id)));
  res.json({ success: true });
});

/* ═══ DOMAINS ═══════════════════════════════════════════════ */

router.get("/office/my/:officeId/domains", requireAuth, async (req, res) => {
  const { officeId } = req.params as Record<string, string>;
  const rows = await db.select().from(officeDomainsTable).where(eq(officeDomainsTable.officeId, officeId));
  res.json(rows[0] ?? null);
});

router.post("/office/my/:officeId/domains", requireAuth, async (req, res) => {
  const { officeId } = req.params as Record<string, string>;
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

router.patch("/office/my/domains/:id", requireAuth, async (req, res) => {
  const body: any = { ...req.body, updatedAt: new Date() };
  if (body.customDomain === "") body.customDomain = null;
  const [updated] = await db.update(officeDomainsTable).set(body)
    .where(eq(officeDomainsTable.id, String(req.params.id))).returning();
  res.json(updated);
});

router.post("/office/my/domains/:id/verify", requireAuth, async (req, res) => {
  const [updated] = await db.update(officeDomainsTable)
    .set({ isVerified: true, sslEnabled: true, verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(officeDomainsTable.id, String(req.params.id))).returning();
  res.json(updated);
});

router.delete("/office/my/domains/:id/custom", requireAuth, async (req, res) => {
  const [updated] = await db.update(officeDomainsTable)
    .set({ customDomain: null, isVerified: false, sslEnabled: false, verifiedAt: null, updatedAt: new Date() })
    .where(eq(officeDomainsTable.id, String(req.params.id))).returning();
  res.json(updated);
});

/* ═══ PLAN ═══════════════════════════════════════════════════ */

router.patch("/office/my/:officeId/plan", requireAuth, async (req, res) => {
  const { plan } = req.body;
  const [updated] = await db.update(officePageTable).set({ plan, updatedAt: new Date() })
    .where(eq(officePageTable.id, String(req.params.officeId))).returning();
  res.json(updated);
});

export default router;
