/**
 * Marketplace routes — Legal Services Marketplace
 * Full flow: Browse → Order / Negotiate → Deal Room → Auto Case
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";

const router = Router();

const ALLOWED_CATEGORIES = new Set([
  "consultation", "contract", "memo", "litigation",
  "corporate", "real_estate", "labor", "other",
]);

const CATEGORIES: Record<string, string> = {
  consultation: "استشارات قانونية",
  contract:     "صياغة العقود",
  memo:         "مذكرات قانونية",
  litigation:   "خدمات التقاضي",
  corporate:    "خدمات شركات",
  real_estate:  "خدمات عقارية",
  labor:        "قانون العمل",
  other:        "خدمات أخرى",
};

async function dbRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS marketplace_services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      office_name TEXT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price NUMERIC DEFAULT 0,
      currency TEXT DEFAULT 'SAR',
      duration_minutes INT,
      tags TEXT,
      is_active BOOLEAN DEFAULT true,
      rating NUMERIC DEFAULT 0,
      total_reviews INT DEFAULT 0,
      total_orders INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS marketplace_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id TEXT NOT NULL,
      service_title TEXT,
      seller_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT,
      buyer_phone TEXT,
      amount NUMERIC DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      case_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS marketplace_deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id TEXT NOT NULL,
      service_title TEXT,
      seller_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT,
      buyer_phone TEXT,
      initial_price NUMERIC,
      final_price NUMERIC,
      status TEXT DEFAULT 'open',
      notes TEXT,
      case_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS marketplace_deal_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id TEXT NOT NULL,
      from_role TEXT NOT NULL,
      price NUMERIC NOT NULL,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

ensureTables().catch(console.error);

// ─── GET /marketplace/services ────────────────────────────────────────────────
router.get("/marketplace/services", async (req: Request, res: Response) => {
  try {
    const { category, userId, search } = req.query as Record<string, string>;

    const safeCategory = category && category !== "all" && ALLOWED_CATEGORIES.has(category) ? category : null;
    const safeUserId   = typeof userId === "string" && userId.trim() ? userId.trim() : null;
    const safeSearch   = typeof search === "string" && search.trim() ? `%${search.trim()}%` : null;

    let rows: any[];
    if (safeCategory && safeSearch) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true AND category = ${safeCategory}
          AND (title ILIKE ${safeSearch} OR description ILIKE ${safeSearch})
        ORDER BY total_orders DESC, created_at DESC LIMIT 60
      `);
    } else if (safeCategory) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true AND category = ${safeCategory}
        ORDER BY total_orders DESC, created_at DESC LIMIT 60
      `);
    } else if (safeSearch) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true
          AND (title ILIKE ${safeSearch} OR description ILIKE ${safeSearch})
        ORDER BY total_orders DESC, created_at DESC LIMIT 60
      `);
    } else {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true
        ORDER BY total_orders DESC, rating DESC, created_at DESC LIMIT 60
      `);
    }

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /marketplace/services/my ─────────────────────────────────────────────
router.get("/marketplace/services/my", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const rows = await dbRows(sql`
      SELECT * FROM marketplace_services WHERE user_id = ${userId} ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /marketplace/stats ────────────────────────────────────────────────────
router.get("/marketplace/stats", async (_req, res) => {
  try {
    const [svcRow, ordRow] = await Promise.all([
      dbRows(sql`SELECT COUNT(*) AS cnt, COUNT(DISTINCT user_id) AS offices FROM marketplace_services WHERE is_active = true`),
      dbRows(sql`SELECT COUNT(*) AS cnt FROM marketplace_orders WHERE status = 'completed'`),
    ]);
    res.json({
      totalServices: Number(svcRow[0]?.cnt ?? 0),
      totalOffices:  Number(svcRow[0]?.offices ?? 0),
      completedOrders: Number(ordRow[0]?.cnt ?? 0),
    });
  } catch {
    res.json({ totalServices: 0, totalOffices: 0, completedOrders: 0 });
  }
});

// ─── POST /marketplace/services ───────────────────────────────────────────────
router.post("/marketplace/services", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const { officeName, title, description, category, price, currency = "SAR", durationMinutes, tags } = req.body;
    if (!title || !category) return res.status(400).json({ error: "title وcategory مطلوبان" });
    if (!ALLOWED_CATEGORIES.has(category)) return res.status(400).json({ error: "فئة غير مسموح بها" });

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO marketplace_services
        (id, user_id, office_name, title, description, category, price, currency,
         duration_minutes, tags, is_active, created_at, updated_at)
      VALUES
        (${id}, ${userId}, ${officeName ?? null}, ${title},
         ${description ?? null}, ${category}, ${price ?? 0}, ${currency},
         ${durationMinutes ?? null}, ${tags ?? null}, true, NOW(), NOW())
    `);
    const rows = await dbRows(sql`SELECT * FROM marketplace_services WHERE id = ${id}`);
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /marketplace/services/:id ────────────────────────────────────────────
router.put("/marketplace/services/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const { id } = req.params;
    const { title, description, category, price, durationMinutes, tags, isActive } = req.body;

    if (category && !ALLOWED_CATEGORIES.has(category)) return res.status(400).json({ error: "فئة غير مسموح بها" });

    const existing = await dbRows(sql`SELECT user_id FROM marketplace_services WHERE id = ${id}`);
    if (!existing.length) return res.status(404).json({ error: "الخدمة غير موجودة" });
    if (existing[0].user_id !== userId) return res.status(403).json({ error: "غير مصرح" });

    await db.execute(sql`
      UPDATE marketplace_services SET
        title            = COALESCE(${title ?? null}, title),
        description      = COALESCE(${description ?? null}, description),
        category         = COALESCE(${category ?? null}, category),
        price            = COALESCE(${price ?? null}, price),
        duration_minutes = COALESCE(${durationMinutes ?? null}, duration_minutes),
        tags             = COALESCE(${tags ?? null}, tags),
        is_active        = COALESCE(${isActive ?? null}, is_active),
        updated_at       = NOW()
      WHERE id = ${id}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /marketplace/services/:id ─────────────────────────────────────────
router.delete("/marketplace/services/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const existing = await dbRows(sql`SELECT user_id FROM marketplace_services WHERE id = ${req.params.id}`);
    if (!existing.length) return res.status(404).json({ error: "الخدمة غير موجودة" });
    if (existing[0].user_id !== userId) return res.status(403).json({ error: "غير مصرح" });

    await db.execute(sql`DELETE FROM marketplace_services WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /marketplace/categories ──────────────────────────────────────────────
router.get("/marketplace/categories", (_req, res) => {
  res.json(Object.entries(CATEGORIES).map(([id, label]) => ({ id, label })));
});

// ══════════════════════════════════════════════════════════════════════════════
// ORDERS — Direct Purchase
// ══════════════════════════════════════════════════════════════════════════════

// POST /marketplace/orders — place a direct order
router.post("/marketplace/orders", async (req: Request, res: Response) => {
  try {
    const { serviceId, buyerName, buyerEmail, buyerPhone, notes } = req.body;
    if (!serviceId || !buyerName) return res.status(400).json({ error: "serviceId وbuyerName مطلوبان" });

    const [svc] = await dbRows(sql`SELECT * FROM marketplace_services WHERE id = ${serviceId}`);
    if (!svc) return res.status(404).json({ error: "الخدمة غير موجودة" });

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO marketplace_orders
        (id, service_id, service_title, seller_id, buyer_name, buyer_email, buyer_phone, amount, notes, status, created_at)
      VALUES
        (${id}, ${serviceId}, ${svc.title}, ${svc.user_id},
         ${buyerName}, ${buyerEmail ?? null}, ${buyerPhone ?? null},
         ${svc.price ?? 0}, ${notes ?? null}, 'pending', NOW())
    `);
    await db.execute(sql`
      UPDATE marketplace_services SET total_orders = total_orders + 1 WHERE id = ${serviceId}
    `);
    res.json({ id, success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /marketplace/orders/my — seller's orders
router.get("/marketplace/orders/my", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const rows = await dbRows(sql`
      SELECT * FROM marketplace_orders WHERE seller_id = ${userId} ORDER BY created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /marketplace/orders/:id — update order status
router.patch("/marketplace/orders/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { status } = req.body;
    await db.execute(sql`
      UPDATE marketplace_orders SET status = ${status} WHERE id = ${req.params.id} AND seller_id = ${userId}
    `);

    if (status === "completed") {
      const [order] = await dbRows(sql`SELECT * FROM marketplace_orders WHERE id = ${req.params.id}`);
      if (order) {
        try {
          const caseId = randomUUID();
          await db.execute(sql`
            INSERT INTO cases (id, title, case_type, client_name, status, notes, created_at, updated_at)
            VALUES (${caseId}, ${"خدمة: " + (order.service_title ?? "خدمة قانونية")}, 'other',
                   ${order.buyer_name}, 'open',
                   ${"طلب عبر المتجر · " + (order.buyer_email ?? "") + " · " + (order.buyer_phone ?? "")},
                   NOW(), NOW())
          `);
          await db.execute(sql`UPDATE marketplace_orders SET case_id = ${caseId} WHERE id = ${req.params.id}`);
        } catch {}
      }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DEALS — Deal Room (Negotiation)
// ══════════════════════════════════════════════════════════════════════════════

// POST /marketplace/deals — open a deal
router.post("/marketplace/deals", async (req: Request, res: Response) => {
  try {
    const { serviceId, buyerName, buyerEmail, buyerPhone, initialPrice, notes } = req.body;
    if (!serviceId || !buyerName || !initialPrice) return res.status(400).json({ error: "serviceId وbuyerName وinitialPrice مطلوبة" });

    const [svc] = await dbRows(sql`SELECT * FROM marketplace_services WHERE id = ${serviceId}`);
    if (!svc) return res.status(404).json({ error: "الخدمة غير موجودة" });

    const dealId = randomUUID();
    await db.execute(sql`
      INSERT INTO marketplace_deals
        (id, service_id, service_title, seller_id, buyer_name, buyer_email, buyer_phone,
         initial_price, status, notes, created_at)
      VALUES
        (${dealId}, ${serviceId}, ${svc.title}, ${svc.user_id},
         ${buyerName}, ${buyerEmail ?? null}, ${buyerPhone ?? null},
         ${initialPrice}, 'open', ${notes ?? null}, NOW())
    `);

    const offerId = randomUUID();
    await db.execute(sql`
      INSERT INTO marketplace_deal_offers (id, deal_id, from_role, price, message, created_at)
      VALUES (${offerId}, ${dealId}, 'buyer', ${initialPrice}, ${notes ?? "عرض ابتدائي"}, NOW())
    `);

    res.json({ id: dealId, success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /marketplace/deals/my — seller's deals
router.get("/marketplace/deals/my", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const rows = await dbRows(sql`
      SELECT * FROM marketplace_deals WHERE seller_id = ${userId} ORDER BY created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /marketplace/deals/:id — get deal with offers
router.get("/marketplace/deals/:id", async (req: Request, res: Response) => {
  try {
    const [deal] = await dbRows(sql`SELECT * FROM marketplace_deals WHERE id = ${req.params.id}`);
    if (!deal) return res.status(404).json({ error: "الصفقة غير موجودة" });

    const offers = await dbRows(sql`
      SELECT * FROM marketplace_deal_offers WHERE deal_id = ${req.params.id} ORDER BY created_at ASC
    `);
    res.json({ ...deal, offers });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /marketplace/deals/:id/offer — add counter-offer
router.post("/marketplace/deals/:id/offer", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const { price, message } = req.body;
    if (!price) return res.status(400).json({ error: "السعر مطلوب" });

    const [deal] = await dbRows(sql`SELECT * FROM marketplace_deals WHERE id = ${req.params.id}`);
    if (!deal) return res.status(404).json({ error: "الصفقة غير موجودة" });
    if (deal.status !== "open") return res.status(400).json({ error: "الصفقة مغلقة" });

    const offerId = randomUUID();
    await db.execute(sql`
      INSERT INTO marketplace_deal_offers (id, deal_id, from_role, price, message, created_at)
      VALUES (${offerId}, ${req.params.id}, 'seller', ${price}, ${message ?? null}, NOW())
    `);
    res.json({ id: offerId, success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /marketplace/deals/:id/accept — accept deal → auto case
router.post("/marketplace/deals/:id/accept", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const [deal] = await dbRows(sql`SELECT * FROM marketplace_deals WHERE id = ${req.params.id} AND seller_id = ${userId}`);
    if (!deal) return res.status(404).json({ error: "الصفقة غير موجودة" });

    const lastOffer = await dbRows(sql`
      SELECT * FROM marketplace_deal_offers WHERE deal_id = ${req.params.id} ORDER BY created_at DESC LIMIT 1
    `);
    const finalPrice = lastOffer[0]?.price ?? deal.initial_price;

    await db.execute(sql`
      UPDATE marketplace_deals SET status = 'accepted', final_price = ${finalPrice} WHERE id = ${req.params.id}
    `);

    let caseId: string | null = null;
    try {
      caseId = randomUUID();
      await db.execute(sql`
        INSERT INTO cases (id, title, case_type, client_name, status, notes, created_at, updated_at)
        VALUES (${caseId}, ${"صفقة: " + (deal.service_title ?? "خدمة قانونية")}, 'other',
               ${deal.buyer_name}, 'open',
               ${"صفقة متفق عليها · " + finalPrice + " ر.س · " + (deal.buyer_email ?? "") + " · " + (deal.buyer_phone ?? "")},
               NOW(), NOW())
      `);
      await db.execute(sql`UPDATE marketplace_deals SET case_id = ${caseId} WHERE id = ${req.params.id}`);
    } catch {}

    res.json({ success: true, finalPrice, caseId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /marketplace/deals/:id/reject — reject deal
router.post("/marketplace/deals/:id/reject", async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    await db.execute(sql`
      UPDATE marketplace_deals SET status = 'rejected' WHERE id = ${req.params.id} AND seller_id = ${userId}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
