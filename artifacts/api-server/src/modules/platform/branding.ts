import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { officeBrandingTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router = Router();

router.get("/branding", requireAuthWithTenant, async (req, res) => {
  /* F-TENANT-BRANDING-001: never trust query.tenantId */
  const tenantId = (req as { tenantId?: string }).tenantId;
  if (!tenantId || tenantId === "platform") {
    return res.status(403).json({ error: "سياق المكتب مطلوب", code: "TNT_403" });
  }
  const rows = await db.select().from(officeBrandingTable).where(eq(officeBrandingTable.tenantId, tenantId));
  if (rows.length === 0) {
    return res.json(null);
  }
  res.json(rows[0]);
});

router.post("/branding", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as { tenantId?: string }).tenantId;
  if (!tenantId || tenantId === "platform") {
    return res.status(403).json({ error: "سياق المكتب مطلوب", code: "TNT_403" });
  }
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
  const tenantId = (req as { tenantId?: string }).tenantId;
  if (!tenantId || tenantId === "platform") {
    return res.status(403).json({ error: "سياق المكتب مطلوب", code: "TNT_403" });
  }
  const [updated] = await db
    .update(officeBrandingTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(and(
      eq(officeBrandingTable.id, String(req.params.id)),
      eq(officeBrandingTable.tenantId, tenantId),
    ))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

export default router;
