import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { officeBrandingTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getRequiredTenantId, tenantRequiredResponse, TenantRequiredError } from "../../core/tenantContext";

const router = Router();

function handleTenantError(err: unknown, res: import("express").Response) {
  if (err instanceof TenantRequiredError) {
    return res.status(403).json(tenantRequiredResponse());
  }
  throw err;
}

router.get("/branding", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getRequiredTenantId(req);
    const rows = await db.select().from(officeBrandingTable).where(eq(officeBrandingTable.tenantId, tenantId));
    if (rows.length === 0) {
      return res.json(null);
    }
    res.json(rows[0]);
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/branding", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getRequiredTenantId(req);
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
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/branding/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = getRequiredTenantId(req);
    const [updated] = await db
      .update(officeBrandingTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(officeBrandingTable.id, String(req.params.id)))
      .returning();
    if (!updated || updated.tenantId !== tenantId) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(updated);
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
