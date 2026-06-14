import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
/**
 * Office API Keys Routes
 * GET    /api/office/api-keys        — list keys for office
 * POST   /api/office/api-keys        — create new key
 * PATCH  /api/office/api-keys/:id/revoke — revoke key (scoped to caller's office)
 * PATCH  /api/office/api-keys/:id/activate — activate key (scoped to caller's office)
 * DELETE /api/office/api-keys/:id    — delete key (scoped to caller's office)
 *
 * Security: officeId is resolved server-side from Clerk auth (single-tenant → "default").
 * Revoke/delete operations verify key ownership before mutating.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { generateApiKey } from "../services/tenantProvisioning";
import { requireAuthWithTenant } from "../middlewares/requireAuth";
import { getAuth } from "@clerk/express";

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

/**
 * Resolve officeId from Clerk session.
 * Returns null when the request is unauthenticated.
 */
function resolveOfficeId(req: any): string | null {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  return "default"; // single-tenant deployment
}

/* GET /api/office/api-keys */
router.get("/office/api-keys", requireAuthWithTenant, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

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
router.post("/office/api-keys", requireAuthWithTenant, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

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
router.patch("/office/api-keys/:id/revoke", requireAuthWithTenant, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

  try {
    /* Verify ownership before revoking */
    const key = await one(sql`
      SELECT id FROM office_api_keys WHERE id = ${req.params.id}::uuid AND office_id = ${officeId}
    `);
    if (!key) return res.status(404).json({ error: "المفتاح غير موجود" });

    await db.execute(sql`
      UPDATE office_api_keys SET is_active = FALSE WHERE id = ${req.params.id}::uuid AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/office/api-keys/:id/activate */
router.patch("/office/api-keys/:id/activate", requireAuthWithTenant, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

  try {
    const key = await one(sql`
      SELECT id FROM office_api_keys WHERE id = ${req.params.id}::uuid AND office_id = ${officeId}
    `);
    if (!key) return res.status(404).json({ error: "المفتاح غير موجود" });

    await db.execute(sql`
      UPDATE office_api_keys SET is_active = TRUE WHERE id = ${req.params.id}::uuid AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/office/api-keys/:id */
router.delete("/office/api-keys/:id", requireAuthWithTenant, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

  try {
    /* Scope delete to caller's office — prevents cross-tenant deletion */
    const result = await rows(sql`
      DELETE FROM office_api_keys
      WHERE id = ${req.params.id}::uuid AND office_id = ${officeId}
      RETURNING id
    `);
    if (result.length === 0) return res.status(404).json({ error: "المفتاح غير موجود" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
