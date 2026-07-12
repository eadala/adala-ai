import { requireAuthWithTenant } from "../../middlewares/requireAuth";
/**
 * Entitlements Routes
 * GET  /api/entitlements          — current office entitlements + usage
 * POST /api/entitlements/check    — check if within limit
 * POST /api/entitlements/increment — track usage
 * POST /api/entitlements/provision — manually provision (authenticated)
 *
 * Security: officeId from requireAuthWithTenant — never hardcoded or client-supplied.
 */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getRequiredTenantId, tenantRequiredResponse, TenantRequiredError } from "../../core/tenantContext";
import { provisionTenant, incrementUsage, checkEntitlement, PLAN_LIMITS } from "../../services/tenantProvisioning";

const router = Router();

async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
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

/* GET /api/entitlements */
router.get("/entitlements", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);

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
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

/* POST /api/entitlements/check */
router.post("/entitlements/check", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);
    const { key } = req.body as { key: string };
    if (!key) return res.status(400).json({ error: "key مطلوب" });

    const allowed = await checkEntitlement(officeId, key);
    res.json({ allowed, key, officeId });
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

/* POST /api/entitlements/increment */
router.post("/entitlements/increment", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);
    const { key, amount = 1 } = req.body as { key: string; amount?: number };
    if (!key) return res.status(400).json({ error: "key مطلوب" });

    await incrementUsage(officeId, key, amount);
    res.json({ ok: true, key, amount });
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

/* POST /api/entitlements/provision */
router.post("/entitlements/provision", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = resolveOfficeId(req);
    const { plan = "basic", email = "admin@office.com", amountPaid } = req.body;
    const result = await provisionTenant({ officeId, plan, email, amountPaid });
    res.json(result);
  } catch (err) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
