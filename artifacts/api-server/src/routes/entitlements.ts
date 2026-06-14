import { requireAuth } from "../middlewares/requireAuth";
/**
 * Entitlements Routes
 * GET  /api/entitlements          — current office entitlements + usage
 * POST /api/entitlements/check    — check if within limit
 * POST /api/entitlements/increment — track usage
 * POST /api/entitlements/provision — manually provision (authenticated)
 *
 * Security: officeId is resolved server-side from Clerk auth, not from
 * user-supplied headers, preventing cross-tenant data access.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { provisionTenant, incrementUsage, checkEntitlement, PLAN_LIMITS } from "../services/tenantProvisioning";

const router = Router();

async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/**
 * Resolve officeId from the authenticated user's Clerk session.
 * Each deployment is single-tenant — we use "default" as the office ID.
 * The userId check ensures only authenticated users can read/mutate.
 */
function resolveOfficeId(req: any): string | null {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  // Single-tenant: one office per deployment
  return "default";
}

/* GET /api/entitlements */
router.get("/entitlements", requireAuth, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

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
router.post("/entitlements/check", requireAuth, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

  const { key } = req.body as { key: string };
  if (!key) return res.status(400).json({ error: "key مطلوب" });

  const allowed = await checkEntitlement(officeId, key);
  res.json({ allowed, key, officeId });
});

/* POST /api/entitlements/increment */
router.post("/entitlements/increment", requireAuth, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

  const { key, amount = 1 } = req.body as { key: string; amount?: number };
  if (!key) return res.status(400).json({ error: "key مطلوب" });

  await incrementUsage(officeId, key, amount);
  res.json({ ok: true, key, amount });
});

/* POST /api/entitlements/provision — manual provisioning (authenticated) */
router.post("/entitlements/provision", requireAuth, async (req, res) => {
  const officeId = resolveOfficeId(req);
  if (!officeId) return res.status(401).json({ error: "غير مصرح" });

  try {
    const { plan = "basic", email = "admin@office.com", amountPaid } = req.body;
    const result = await provisionTenant({ officeId, plan, email, amountPaid });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
