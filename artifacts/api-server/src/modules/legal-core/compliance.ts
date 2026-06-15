import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// GET /compliance/items — all saved statuses
router.get("/compliance/items", requireAuthWithTenant, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT framework_key, item_id, status, notes, updated_at, updated_by
      FROM compliance_items
    `);
    res.json(rows.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /compliance/items/:frameworkKey/:itemId — upsert status
router.put("/compliance/items/:frameworkKey/:itemId", requireAuthWithTenant, async (req, res) => {
  try {
    const { frameworkKey, itemId } = req.params as Record<string, string>;
    const { status, notes, updatedBy } = req.body as { status: string; notes?: string; updatedBy?: string };
    if (!["done", "partial", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await db.execute(sql`
      INSERT INTO compliance_items (id, framework_key, item_id, status, notes, updated_at, updated_by)
      VALUES (gen_random_uuid()::text, ${frameworkKey}, ${itemId}, ${status}, ${notes ?? null}, NOW(), ${updatedBy ?? null})
      ON CONFLICT (framework_key, item_id)
      DO UPDATE SET status = ${status}, notes = ${notes ?? null}, updated_at = NOW(), updated_by = ${updatedBy ?? null}
    `);
    res.json({ ok: true, frameworkKey, itemId, status });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
