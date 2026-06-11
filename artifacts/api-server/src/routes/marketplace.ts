/**
 * Marketplace routes — SQL injection fixed: replaced sql.raw() string
 * concatenation with parameterized sql`` template tags from drizzle-orm.
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

/* helper */
async function dbRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

// ─── GET /marketplace/services ────────────────────────────────────────────────
router.get("/marketplace/services", async (req: Request, res: Response) => {
  try {
    const { category, userId, search } = req.query as Record<string, string>;

    /* Validate category against allow-list to prevent injection */
    const safeCategory = category && category !== "all" && ALLOWED_CATEGORIES.has(category)
      ? category : null;
    const safeUserId = typeof userId === "string" && userId.trim() ? userId.trim() : null;
    const safeSearch = typeof search === "string" && search.trim() ? `%${search.trim()}%` : null;

    /* Build query with parameterized sql tags — no string concatenation */
    let rows: any[];
    if (safeCategory && safeUserId && safeSearch) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true
          AND category = ${safeCategory}
          AND user_id  = ${safeUserId}
          AND (title ILIKE ${safeSearch} OR description ILIKE ${safeSearch})
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    } else if (safeCategory && safeSearch) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true
          AND category = ${safeCategory}
          AND (title ILIKE ${safeSearch} OR description ILIKE ${safeSearch})
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    } else if (safeCategory && safeUserId) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true AND category = ${safeCategory} AND user_id = ${safeUserId}
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    } else if (safeUserId && safeSearch) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true AND user_id = ${safeUserId}
          AND (title ILIKE ${safeSearch} OR description ILIKE ${safeSearch})
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    } else if (safeCategory) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true AND category = ${safeCategory}
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    } else if (safeUserId) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true AND user_id = ${safeUserId}
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    } else if (safeSearch) {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true
          AND (title ILIKE ${safeSearch} OR description ILIKE ${safeSearch})
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    } else {
      rows = await dbRows(sql`
        SELECT * FROM marketplace_services
        WHERE is_active = true
        ORDER BY total_orders DESC, created_at DESC LIMIT 50
      `);
    }

    res.json(rows);
  } catch (e: any) {
    console.error("marketplace/services:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /marketplace/services/my ─────────────────────────────────────────────
router.get("/marketplace/services/my", async (req: Request, res: Response) => {
  try {
    const { userId: queryUserId } = getAuth(req as any);
    if (!queryUserId) return res.status(401).json({ error: "غير مصرح" });

    const rows = await dbRows(sql`
      SELECT * FROM marketplace_services
      WHERE user_id = ${queryUserId}
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /marketplace/services ───────────────────────────────────────────────
router.post("/marketplace/services", async (req: Request, res: Response) => {
  try {
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const { officeName, title, description, category, price, currency = "SAR", durationMinutes, tags } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: "title وcategory مطلوبان" });
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ error: "فئة غير مسموح بها" });
    }

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO marketplace_services
        (id, user_id, office_name, title, description, category, price, currency,
         duration_minutes, tags, is_active, created_at, updated_at)
      VALUES
        (${id}, ${authUserId}, ${officeName ?? null}, ${title},
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
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const { id } = req.params;
    const { title, description, category, price, durationMinutes, tags, isActive } = req.body;

    if (category && !ALLOWED_CATEGORIES.has(category)) {
      return res.status(400).json({ error: "فئة غير مسموح بها" });
    }

    /* Ownership check */
    const existing = await dbRows(sql`
      SELECT user_id FROM marketplace_services WHERE id = ${id}
    `);
    if (!existing.length) return res.status(404).json({ error: "الخدمة غير موجودة" });
    if (existing[0].user_id !== authUserId) return res.status(403).json({ error: "غير مصرح" });

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
    const { userId: authUserId } = getAuth(req as any);
    if (!authUserId) return res.status(401).json({ error: "غير مصرح" });

    const existing = await dbRows(sql`
      SELECT user_id FROM marketplace_services WHERE id = ${req.params.id}
    `);
    if (!existing.length) return res.status(404).json({ error: "الخدمة غير موجودة" });
    if (existing[0].user_id !== authUserId) return res.status(403).json({ error: "غير مصرح" });

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

export default router;
