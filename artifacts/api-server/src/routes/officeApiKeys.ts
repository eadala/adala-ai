/**
 * Office API Keys Routes
 * GET    /api/office/api-keys        — list keys for office
 * POST   /api/office/api-keys        — create new key
 * PATCH  /api/office/api-keys/:id/revoke — revoke key
 * DELETE /api/office/api-keys/:id    — delete key
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { generateApiKey } from "../services/tenantProvisioning";
import { getAuth } from "@clerk/express";

const router = Router();

async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* GET /api/office/api-keys */
router.get("/office/api-keys", async (req, res) => {
  try {
    const officeId = (req.headers["x-office-id"] as string) ?? "default";
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
router.post("/office/api-keys", async (req, res) => {
  try {
    const officeId = (req.headers["x-office-id"] as string) ?? "default";
    const { name, permissions = ["read"], expiresInDays } = req.body as {
      name: string;
      permissions?: string[];
      expiresInDays?: number;
    };
    if (!name) return res.status(400).json({ error: "اسم المفتاح مطلوب" });

    const auth = getAuth(req as any);
    const createdBy = auth?.userId ?? "system";
    const { raw, hash, preview } = generateApiKey();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
      : null;

    const result = await rows(sql`
      INSERT INTO office_api_keys (office_id, name, key_hash, key_preview, permissions, created_by, expires_at)
      VALUES (
        ${officeId}, ${name}, ${hash}, ${preview},
        ${permissions}::text[], ${createdBy}, ${expiresAt}
      )
      RETURNING id, name, key_preview, permissions, is_active, created_at
    `);

    /* Return raw key only once */
    res.json({ ...result[0], rawKey: raw });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/office/api-keys/:id/revoke */
router.patch("/office/api-keys/:id/revoke", async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE office_api_keys SET is_active = FALSE WHERE id = ${req.params.id}::uuid
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/office/api-keys/:id/activate */
router.patch("/office/api-keys/:id/activate", async (req, res) => {
  try {
    await db.execute(sql`
      UPDATE office_api_keys SET is_active = TRUE WHERE id = ${req.params.id}::uuid
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/office/api-keys/:id */
router.delete("/office/api-keys/:id", async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM office_api_keys WHERE id = ${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
