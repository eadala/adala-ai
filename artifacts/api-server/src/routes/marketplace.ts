import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

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

// ─── GET /marketplace/services ────────────────────────────────────────────────
router.get("/marketplace/services", async (req: Request, res: Response) => {
  try {
    const { category, userId, search } = req.query as Record<string, string>;
    let where = "WHERE is_active = true";
    if (category && category !== "all") where += ` AND category = '${category.replace(/'/g, "''")}'`;
    if (userId) where += ` AND user_id = '${userId.replace(/'/g, "''")}'`;
    if (search) where += ` AND (title ILIKE '%${search.replace(/'/g, "''")}%' OR description ILIKE '%${search.replace(/'/g, "''")}%')`;

    const rows = await db.execute(sql.raw(`SELECT * FROM marketplace_services ${where} ORDER BY total_orders DESC, created_at DESC LIMIT 50`));
    res.json(rows.rows ?? []);
  } catch (e: any) {
    console.error("marketplace/services:", e);
    res.json([]);
  }
});

// ─── GET /marketplace/services/my ────────────────────────────────────────────
router.get("/marketplace/services/my", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query as Record<string, string>;
    if (!userId) { res.json([]); return; }
    const rows = await db.execute(sql`SELECT * FROM marketplace_services WHERE user_id = ${userId} ORDER BY created_at DESC`);
    res.json(rows.rows ?? []);
  } catch (e: any) {
    res.json([]);
  }
});

// ─── POST /marketplace/services ──────────────────────────────────────────────
router.post("/marketplace/services", async (req: Request, res: Response) => {
  try {
    const { userId, officeName, title, description, category, price, currency = "SAR", durationMinutes, tags } = req.body;
    if (!userId || !title || !category) {
      res.status(400).json({ error: "userId وtitle وcategory مطلوبة" }); return;
    }

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO marketplace_services
        (id, user_id, office_name, title, description, category, price, currency, duration_minutes, tags, is_active, created_at, updated_at)
      VALUES
        (${id}, ${userId}, ${officeName ?? null}, ${title}, ${description ?? null}, ${category}, ${price ?? 0}, ${currency}, ${durationMinutes ?? null}, ${tags ?? null}, true, NOW(), NOW())
    `);
    const row = await db.execute(sql`SELECT * FROM marketplace_services WHERE id = ${id}`);
    res.json(row.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /marketplace/services/:id ───────────────────────────────────────────
router.put("/marketplace/services/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, category, price, durationMinutes, tags, isActive } = req.body;
    await db.execute(sql`
      UPDATE marketplace_services SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        category = COALESCE(${category ?? null}, category),
        price = COALESCE(${price ?? null}, price),
        duration_minutes = COALESCE(${durationMinutes ?? null}, duration_minutes),
        tags = COALESCE(${tags ?? null}, tags),
        is_active = COALESCE(${isActive ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /marketplace/services/:id ────────────────────────────────────────
router.delete("/marketplace/services/:id", async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM marketplace_services WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /marketplace/categories ─────────────────────────────────────────────
router.get("/marketplace/categories", (_req, res) => {
  res.json(Object.entries(CATEGORIES).map(([id, label]) => ({ id, label })));
});

export default router;
