import { requireAuthWithTenant } from "../../middlewares/requireAuth";
/**
 * Office API Keys Routes — officeId from requireAuthWithTenant only.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { generateApiKey } from "../../services/tenantProvisioning";
import { getAuth } from "@clerk/express";
import { getRequiredTenantId, tenantRequiredResponse, TenantRequiredError } from "../../core/tenantContext";

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

function resolveOfficeId(req: unknown): string {
  return getRequiredTenantId(req);
}

function handleTenantError(err: unknown, res: import("express").Response) {
  if (err instanceof TenantRequiredError) {
    return res.status(403).json(tenantRequiredResponse());
  }
  throw err;
}

/* GET /api/office/api-keys */
router.get("/office/api-keys", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);

    const data = await rows(sql`
      SELECT id, name, key_preview, permissions, is_active, last_used_at, expires_at, created_by, created_at
      FROM office_api_keys
      WHERE office_id = ${officeId}
      ORDER BY created_at DESC
    `);
    res.json(data);
  } catch (err: any) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/office/api-keys */
router.post("/office/api-keys", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);

    const { name, permissions = ["read"], expiresInDays } = req.body as {
      name: string;
      permissions?: string[];
      expiresInDays?: number;
    };
    if (!name?.trim()) return res.status(400).json({ error: "اسم المفتاح مطلوب" });

    const auth = getAuth(req as any);
    const createdBy = auth?.userId ?? "system";
    const { raw, hash, preview } = generateApiKey();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
      : null;

    const result = await rows(sql`
      INSERT INTO office_api_keys (office_id, name, key_hash, key_preview, permissions, created_by, expires_at)
      VALUES (
        ${officeId}, ${name.trim()}, ${hash}, ${preview},
        ${permissions}::text[], ${createdBy}, ${expiresAt}
      )
      RETURNING id, name, key_preview, permissions, is_active, created_at
    `);

    res.json({ ...result[0], rawKey: raw });
  } catch (err: any) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/office/api-keys/:id/revoke */
router.patch("/office/api-keys/:id/revoke", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);

    const key = await one(sql`
      SELECT id FROM office_api_keys WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    if (!key) return res.status(404).json({ error: "المفتاح غير موجود" });

    await db.execute(sql`
      UPDATE office_api_keys SET is_active = FALSE WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/office/api-keys/:id/activate */
router.patch("/office/api-keys/:id/activate", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);

    const key = await one(sql`
      SELECT id FROM office_api_keys WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    if (!key) return res.status(404).json({ error: "المفتاح غير موجود" });

    await db.execute(sql`
      UPDATE office_api_keys SET is_active = TRUE WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/office/api-keys/:id */
router.delete("/office/api-keys/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);

    const result = await rows(sql`
      DELETE FROM office_api_keys
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${officeId}
      RETURNING id
    `);
    if (result.length === 0) return res.status(404).json({ error: "المفتاح غير موجود" });
    res.json({ ok: true });
  } catch (err: any) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: err.message });
  }
});

export default router;
