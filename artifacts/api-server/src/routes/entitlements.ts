/**
 * Entitlements Routes
 * GET  /api/entitlements          — current office entitlements + usage
 * POST /api/entitlements/check    — check if within limit
 * POST /api/entitlements/increment — track usage
 * POST /api/entitlements/provision — manually provision (super admin)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { provisionTenant, incrementUsage, checkEntitlement, PLAN_LIMITS } from "../services/tenantProvisioning";

const router = Router();

async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* GET /api/entitlements */
router.get("/entitlements", async (req, res) => {
  try {
    const officeId = (req.headers["x-office-id"] as string) ?? "default";
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

/* POST /api/entitlements/check */
router.post("/entitlements/check", async (req, res) => {
  const { key, officeId = "default" } = req.body as { key: string; officeId?: string };
  if (!key) return res.status(400).json({ error: "key مطلوب" });
  const allowed = await checkEntitlement(officeId, key);
  res.json({ allowed, key, officeId });
});

/* POST /api/entitlements/increment */
router.post("/entitlements/increment", async (req, res) => {
  const { key, officeId = "default", amount = 1 } = req.body as { key: string; officeId?: string; amount?: number };
  if (!key) return res.status(400).json({ error: "key مطلوب" });
  await incrementUsage(officeId, key, amount);
  res.json({ ok: true, key, amount });
});

/* POST /api/entitlements/provision — manual provisioning */
router.post("/entitlements/provision", async (req, res) => {
  try {
    const { officeId = "default", plan = "basic", email = "admin@office.com", amountPaid } = req.body;
    const result = await provisionTenant({ officeId, plan, email, amountPaid });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
