/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
/**
 * Entitlements Routes
 * GET  /api/entitlements          — current office entitlements + usage
 * POST /api/entitlements/check    — check if within limit
 * POST /api/entitlements/increment — track usage
 * POST /api/entitlements/provision — manually provision (authenticated)
 *
 * Security: officeId is resolved server-side from tenant context, never
 * hardcoded to "default" and never taken from client body/headers alone.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { provisionTenant, incrementUsage, checkEntitlement, PLAN_LIMITS } from "../../services/tenantProvisioning";

const router = Router();

async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

function realOfficeId(req: any): string | null {
  const id = req.tenantId ? String(req.tenantId) : "";
  if (!id || id === "default" || id === "platform") return null;
  return id;
}

/* GET /api/entitlements */
router.get("/entitlements", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  try {
    const data = await rows(sql`
      SELECT key, plan, "limit", used, reset_at, updated_at
      FROM office_entitlements
      WHERE office_id = ${officeId}
      ORDER BY key
    `);

    const entitlements = data.map((row: any) => ({
      key:       row.key,
      plan:      row.plan,
      limit:     Number(row.limit),
      used:      Number(row.used),
      remaining: Math.max(0, Number(row.limit) - Number(row.used)),
      percent:   row.limit > 0 ? Math.min(100, Math.round((Number(row.used) / Number(row.limit)) * 100)) : 0,
      resetAt:   row.reset_at,
      updatedAt: row.updated_at,
    }));

    res.json({ officeId, entitlements, planLimits: PLAN_LIMITS });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/entitlements/check — server-side check only, no cross-tenant */
router.post("/entitlements/check", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  const { key } = req.body as { key: string };
  if (!key) return res.status(400).json({ error: "key مطلوب" });

  const allowed = await checkEntitlement(officeId, key);
  res.json({ allowed, key, officeId });
});

/* POST /api/entitlements/increment */
router.post("/entitlements/increment", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  const { key, amount = 1 } = req.body as { key: string; amount?: number };
  if (!key) return res.status(400).json({ error: "key مطلوب" });

  await incrementUsage(officeId, key, amount);
  res.json({ ok: true, key, amount });
});

/* POST /api/entitlements/provision — provision the caller's real office only */
router.post("/entitlements/provision", requireAuthWithTenant, async (req: any, res) => {
  const officeId = realOfficeId(req);
  if (!officeId) return res.status(403).json({ error: "لا يوجد مكتب مرتبط" });

  try {
    const { plan = "basic", email = "admin@office.com", amountPaid } = req.body;
    /* Never accept client-supplied officeId — always use authenticated tenant. */
    const result = await provisionTenant({ officeId, plan, email, amountPaid });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
