/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function tidOf(req: any): string | null {
  const tid = req?.tenantId;
  return tid && String(tid).trim() ? String(tid) : null;
}

// GET /compliance/items — all saved statuses
router.get("/compliance/items", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = tidOf(req);
    if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const rows = await db.execute(sql`
      SELECT framework_key, item_id, status, notes, updated_at, updated_by
      FROM compliance_items
      WHERE office_id = ${tenantId}
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
    const tenantId = tidOf(req);
    if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    await db.execute(sql`
      INSERT INTO compliance_items (id, framework_key, item_id, status, notes, updated_at, updated_by, office_id)
      VALUES (gen_random_uuid()::text, ${frameworkKey}, ${itemId}, ${status}, ${notes ?? null}, NOW(), ${updatedBy ?? null}, ${tenantId})
      ON CONFLICT (framework_key, item_id, office_id)
      DO UPDATE SET status = ${status}, notes = ${notes ?? null}, updated_at = NOW(), updated_by = ${updatedBy ?? null}
    `);
    res.json({ ok: true, frameworkKey, itemId, status });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
