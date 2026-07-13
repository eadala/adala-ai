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
import { requireProductionBaseUrl } from "../../lib/productionUrl";
import { logEndpointError } from "../../lib/endpointErrorLog";

const router = Router();

async function handleGetMyOffice(req: any, res: any) {
  try {
    const { resolveTenantId } = await import("../../middlewares/tenantMiddleware");
    const officeId = await resolveTenantId(
      req.userId,
      req.headers["x-tenant-id"] as string | undefined,
    );
    /* No fallback to "first office" — only return the user's resolved tenant */
    if (!officeId) {
      return res.status(403).json({
        error: "لا يمكن تحديد المكتب المرتبط بهذا الحساب",
        code: "TNT_403",
      });
    }
    const offices = await db.select().from(officePageTable)
      .where(eq(officePageTable.id, officeId))
      .limit(1);
    res.json(offices[0] ?? null);
  } catch (e: any) {
    logEndpointError("GET /api/offices/my", req, e);
    res.status(500).json({ error: e.message ?? "خطأ في جلب بيانات المكتب" });
  }
}

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
  let appUrl: string;
  try {
    appUrl = requireProductionBaseUrl();
  } catch {
    return res.status(503).json({
      error: "PRODUCTION_URL أو APP_URL غير مضبوط — لا يمكن إنشاء جلسة دفع",
    });
  }
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

/* GET my office (+ plural alias used by layout/mobile-nav) */
router.get("/office/my", requireAuth, handleGetMyOffice);
router.get("/offices/my", requireAuth, handleGetMyOffice);

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

/* ═══ PUBLIC BANKRUPTCY PORTAL ══════════════════════════════ */

/** Resolve office by slug — shared helper */
async function resolveOfficeBySlug(slug: string) {
  const rows = await db.select().from(officePageTable)
    .where(eq(officePageTable.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** GET /office/public/:slug/bankruptcy — public stats + settings */
router.get("/office/public/:slug/bankruptcy", async (req, res) => {
  try {
    const office = await resolveOfficeBySlug(String(req.params.slug));
    if (!office) return res.status(404).json({ error: "المكتب غير موجود" });

    const cfg = ((office as any).website_config ?? {}) as Record<string, any>;
    const enabled          = cfg.enableBankruptcyPortal !== false;   // default on
    const showStats        = cfg.showBankruptcyStats    !== false;
    const allowOnlineClaims= cfg.allowOnlineClaims      !== false;
    const enableCreditorPortal = cfg.enableCreditorPortal !== false;

    if (!enabled) return res.json({ enabled: false });

    const officeId = office.id;
    const stats = showStats ? await (async () => {
      const [cases, creds, claims, meetings] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as cnt FROM bankruptcy_cases WHERE office_id=${officeId} AND status='active' AND deleted_at IS NULL`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM bk_creditors WHERE office_id=${officeId}`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM bk_claims WHERE office_id=${officeId}`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM bk_meetings WHERE office_id=${officeId} AND meeting_date >= NOW()`),
      ]);
      const r = (x: any) => Number((x.rows ?? x)[0]?.cnt ?? 0);
      return { activeCases: r(cases), creditors: r(creds), claims: r(claims), upcomingMeetings: r(meetings) };
    })() : null;

    /* bankruptcy services from office store — category contains إفلاس */
    const bkServices = await db.select().from(officeServicesTable)
      .where(and(
        eq(officeServicesTable.officeId, officeId),
        eq(officeServicesTable.isActive, true),
        sql`(name ILIKE '%إفلاس%' OR name ILIKE '%تعثر%' OR name ILIKE '%دائن%' OR name ILIKE '%مدين%' OR description ILIKE '%إفلاس%' OR category ILIKE '%إفلاس%')`,
      ));

    res.json({
      enabled, showStats, allowOnlineClaims, enableCreditorPortal,
      office: {
        name: office.name, logo: office.logo, primaryColor: office.primaryColor,
        phone: office.phone, whatsapp: office.whatsapp, email: office.email,
        city: office.city, about: office.about,
      },
      stats,
      bankruptcyServices: bkServices,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/** POST /office/public/:slug/bankruptcy/claim — submit claim publicly */
router.post("/office/public/:slug/bankruptcy/claim", async (req, res) => {
  try {
    const office = await resolveOfficeBySlug(String(req.params.slug));
    if (!office) return res.status(404).json({ error: "المكتب غير موجود" });

    const cfg = ((office as any).website_config ?? {}) as Record<string, any>;
    if (cfg.enableBankruptcyPortal === false) return res.status(403).json({ error: "البوابة غير مفعّلة" });
    if (cfg.allowOnlineClaims === false) return res.status(403).json({ error: "تقديم المطالبات غير متاح حالياً" });

    const { creditorName, creditorId, email, phone, amount, description, caseId } = req.body;
    if (!creditorName || !amount || !phone) return res.status(400).json({ error: "الاسم والجوال والمبلغ مطلوبة" });
    if (isNaN(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: "المبلغ غير صحيح" });

    const officeId = office.id;

    /* Find or pick the first active case if caseId not provided */
    let targetCaseId = caseId;
    if (!targetCaseId) {
      const [ac] = await db.execute(sql`
        SELECT id FROM bankruptcy_cases WHERE office_id=${officeId} AND status='active' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1
      `).then((r: any) => r.rows ?? r);
      targetCaseId = ac?.id;
    }
    if (!targetCaseId) return res.status(400).json({ error: "لا يوجد ملف إفلاس نشط لهذا المكتب حالياً" });

    /* Insert creditor if not exists */
    const [cred] = await db.execute(sql`
      INSERT INTO bk_creditors (case_id, office_id, name, national_id, email, phone, creditor_type, status)
      VALUES (${targetCaseId}::uuid, ${officeId}, ${creditorName.trim()}, ${creditorId?.trim() ?? null},
              ${email?.trim() ?? null}, ${phone.trim()}, 'unsecured', 'active')
      ON CONFLICT DO NOTHING
      RETURNING id
    `).then((r: any) => r.rows ?? r);

    const creditorRowId = cred?.id ?? crypto.randomUUID();

    /* Insert claim */
    const [claim] = await db.execute(sql`
      INSERT INTO bk_claims (case_id, creditor_id, office_id, amount, description, priority_level, status)
      VALUES (${targetCaseId}::uuid, ${creditorRowId}::uuid, ${officeId},
              ${Number(amount)}, ${description?.trim() ?? null}, 'unsecured', 'pending')
      RETURNING id, status, created_at
    `).then((r: any) => r.rows ?? r);

    /* Notify office team */
    await db.execute(sql`
      INSERT INTO bk_notifications (office_id, related_case, title, message, type, status)
      VALUES (${officeId}, ${targetCaseId}, 'مطالبة جديدة عبر الموقع',
              ${'مطالبة من ' + creditorName + ' بمبلغ ' + Number(amount).toLocaleString("ar-SA") + ' ر.س'}, 'claim', 'unread')
    `).catch(() => {});

    res.status(201).json({
      success: true,
      claimId: claim?.id,
      claimNumber: claim?.id?.slice(0, 8).toUpperCase(),
      status: "pending",
      message: "تم تقديم المطالبة بنجاح. سيتواصل معك فريق المكتب قريباً.",
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/** GET /office/public/:slug/bankruptcy/track — track claim by id/phone */
router.get("/office/public/:slug/bankruptcy/track", async (req, res) => {
  try {
    const office = await resolveOfficeBySlug(String(req.params.slug));
    if (!office) return res.status(404).json({ error: "المكتب غير موجود" });

    const { claimId, phone } = req.query as Record<string, string>;
    if (!claimId && !phone) return res.status(400).json({ error: "رقم المطالبة أو الجوال مطلوب" });

    const officeId = office.id;
    const claims = await db.execute(sql`
      SELECT c.id, c.amount, c.status, c.priority_level, c.description, c.created_at,
             cr.name as creditor_name, cr.phone as creditor_phone,
             bc.case_number, bc.debtor_name, bc.procedure_type
      FROM bk_claims c
      JOIN bk_creditors cr ON cr.id = c.creditor_id
      JOIN bankruptcy_cases bc ON bc.id = c.case_id
      WHERE c.office_id = ${officeId}
        ${claimId ? sql`AND (c.id::text ILIKE ${'%' + claimId + '%'})` : sql`AND cr.phone=${phone}`}
      ORDER BY c.created_at DESC LIMIT 5
    `).then((r: any) => r.rows ?? r);

    if (!claims.length) return res.status(404).json({ error: "لم يتم العثور على مطالبات مرتبطة بهذه البيانات" });

    const STATUS_AR: Record<string, string> = {
      pending:"قيد المراجعة", submitted:"مُقدَّمة", under_review:"تحت الدراسة",
      approved:"مقبولة", partially_approved:"مقبولة جزئياً", rejected:"مرفوضة", finalized:"منتهية",
    };

    res.json(claims.map((c: any) => ({
      ...c,
      claimNumber: String(c.id).slice(0, 8).toUpperCase(),
      statusAr: STATUS_AR[c.status] ?? c.status,
      amountFormatted: Number(c.amount).toLocaleString("ar-SA") + " ر.س",
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/** GET /office/public/:slug/bankruptcy/meetings — upcoming public meetings */
router.get("/office/public/:slug/bankruptcy/meetings", async (req, res) => {
  try {
    const office = await resolveOfficeBySlug(String(req.params.slug));
    if (!office) return res.status(404).json({ error: "المكتب غير موجود" });

    const officeId = office.id;
    const meetings = await db.execute(sql`
      SELECT m.id, m.title, m.meeting_date, m.location, m.meeting_type, m.agenda,
             bc.case_number, bc.debtor_name
      FROM bk_meetings m
      JOIN bankruptcy_cases bc ON bc.id = m.case_id
      WHERE m.office_id = ${officeId}
        AND (m.meeting_date IS NULL OR m.meeting_date >= NOW() - INTERVAL '7 days')
        AND bc.deleted_at IS NULL
      ORDER BY m.meeting_date ASC NULLS LAST LIMIT 10
    `).then((r: any) => r.rows ?? r);

    res.json(meetings);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
