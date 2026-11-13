/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
/**
 * Office API Keys Routes
 * GET    /api/office/api-keys        — list keys for office
 * POST   /api/office/api-keys        — create new key
 * PATCH  /api/office/api-keys/:id/revoke — revoke key (scoped to caller's office)
 * PATCH  /api/office/api-keys/:id/activate — activate key (scoped to caller's office)
 * DELETE /api/office/api-keys/:id    — delete key (scoped to caller's office)
 *
 * Security: officeId comes from verified tenant context — never "default".
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { generateApiKey } from "../../services/tenantProvisioning";

const router = Router();

async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

async function one(q: any): Promise<any | null> {
  const r = await rows(q);
  return r[0] ?? null;
}

function realOfficeId(req: any): string | null {
  const id = req.tenantId ? String(req.tenantId) : "";
  if (!id || id === "default" || id === "platform") return null;
  return id;
}

/* GET /api/office/api-keys */
router.get("/office/api-keys", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  try {
    const data = await rows(sql`
      SELECT id, name, key_preview, permissions, is_active, last_used_at, expires_at, created_by, created_at
      FROM office_api_keys
      WHERE office_id = ${officeId}
      ORDER BY created_at DESC
    `);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/office/api-keys */
router.post("/office/api-keys", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  const { name, permissions = ["read"], expiresInDays } = req.body as {
    name: string;
    permissions?: string[];
    expiresInDays?: number;
  };
  if (!name?.trim()) return res.status(400).json({ error: "اسم المفتاح مطلوب" });

  const createdBy = (req.userId as string | undefined) ?? "system";
  const { raw, hash, preview } = generateApiKey();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null;

  try {
    const result = await rows(sql`
      INSERT INTO office_api_keys (office_id, name, key_hash, key_preview, permissions, created_by, expires_at)
      VALUES (
        ${officeId}, ${name.trim()}, ${hash}, ${preview},
        ${permissions}::text[], ${createdBy}, ${expiresAt}
      )
      RETURNING id, name, key_preview, permissions, is_active, created_at
    `);

    /* Return raw key only at creation time — never stored in plaintext */
    res.json({ ...result[0], rawKey: raw });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/office/api-keys/:id/revoke */
router.patch("/office/api-keys/:id/revoke", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  try {
    const key = await one(sql`
      SELECT id FROM office_api_keys WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    if (!key) return res.status(404).json({ error: "المفتاح غير موجود" });

    await db.execute(sql`
      UPDATE office_api_keys SET is_active = FALSE WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/office/api-keys/:id/activate */
router.patch("/office/api-keys/:id/activate", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  try {
    const key = await one(sql`
      SELECT id FROM office_api_keys WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    if (!key) return res.status(404).json({ error: "المفتاح غير موجود" });

    await db.execute(sql`
      UPDATE office_api_keys SET is_active = TRUE WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/office/api-keys/:id */
router.delete("/office/api-keys/:id", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  try {
    const result = await rows(sql`
      DELETE FROM office_api_keys
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
      RETURNING id
    `);
    if (result.length === 0) return res.status(404).json({ error: "المفتاح غير موجود" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
