/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { officeBrandingTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router = Router();

function realTenantId(req: any): string | null {
  const id = req.tenantId ? String(req.tenantId) : "";
  if (!id || id === "default" || id === "platform") return null;
  return id;
}

router.get("/branding", requireAuthWithTenant, async (req, res) => {
  const tenantId = realTenantId(req);
  if (!tenantId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });
  const rows = await db.select().from(officeBrandingTable).where(eq(officeBrandingTable.tenantId, tenantId));
  if (rows.length === 0) {
    return res.json(null);
  }
  res.json(rows[0]);
});

router.post("/branding", requireAuthWithTenant, async (req, res) => {
  /* SECURITY: always use the verified tenant from middleware, never from body/query */
  const tenantId = realTenantId(req);
  if (!tenantId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });
  const { tenantId: _t, id: _id, ...safeBody } = req.body ?? {};
  const existing = await db.select().from(officeBrandingTable).where(eq(officeBrandingTable.tenantId, tenantId));
  if (existing.length > 0) {
    const [updated] = await db
      .update(officeBrandingTable)
      .set({ ...safeBody, updatedAt: new Date() })
      .where(eq(officeBrandingTable.tenantId, tenantId))
      .returning();
    return res.json(updated);
  }
  const [created] = await db.insert(officeBrandingTable).values({ ...safeBody, tenantId }).returning();
  res.json(created);
});

router.put("/branding/:id", requireAuthWithTenant, async (req, res) => {
  const tenantId = realTenantId(req);
  if (!tenantId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });
  const { tenantId: _t, id: _id, ...safeBody } = req.body ?? {};
  const [updated] = await db
    .update(officeBrandingTable)
    .set({ ...safeBody, updatedAt: new Date() })
    .where(and(
      eq(officeBrandingTable.id, String(req.params.id)),
      eq(officeBrandingTable.tenantId, tenantId),
    ))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

export default router;
