import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router } from "express";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { officeBrandingTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_TENANT = "default";

router.get("/branding", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req.query.tenantId as string) || DEFAULT_TENANT;
  const rows = await db.select().from(officeBrandingTable).where(eq(officeBrandingTable.tenantId, tenantId));
  if (rows.length === 0) {
    return res.json(null);
  }
  res.json(rows[0]);
});

router.post("/branding", requireAuthWithTenant, async (req, res) => {
  const tenantId = req.body.tenantId || DEFAULT_TENANT;
  const existing = await db.select().from(officeBrandingTable).where(eq(officeBrandingTable.tenantId, tenantId));
  if (existing.length > 0) {
    const [updated] = await db
      .update(officeBrandingTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(officeBrandingTable.tenantId, tenantId))
      .returning();
    return res.json(updated);
  }
  const [created] = await db.insert(officeBrandingTable).values({ ...req.body, tenantId }).returning();
  res.json(created);
});

router.put("/branding/:id", requireAuthWithTenant, async (req, res) => {
  const [updated] = await db
    .update(officeBrandingTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(officeBrandingTable.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

export default router;
