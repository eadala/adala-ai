/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; schema authority */
import { requireAuth } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { isUuid } from "../../lib/officePageResolverLogic";
import {
  OfficeProvisionError,
  provisionOfficeForUser,
} from "../../lib/officeProvision";
import { invalidateTenantCache } from "../../middlewares/tenantMiddleware";

const router = Router();

/* onboarding_state schema: artifacts/api-server/migrations/005_tenant_platform_tables.sql */

async function sqlOne(q: any) {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

router.get("/onboarding/state", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.json({ completed: false, step: 0, data: {} });
    const row = await sqlOne(sql`SELECT * FROM onboarding_state WHERE user_id = ${userId}`);
    res.json(row ?? { completed: false, step: 0, data: {} });
  } catch { res.json({ completed: false, step: 0, data: {} }); }
});

router.put("/onboarding/state", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { completed, step, data } = req.body;

    /* ── When completing onboarding, provision a real office if none exists ── */
    let resolvedOfficeId: string | null = null;
    if (completed) {
      const existingMember = await sqlOne(sql`
        SELECT office_id FROM office_members
        WHERE user_id = ${userId} AND status = 'active'
        LIMIT 1
      `);

      if (existingMember?.office_id && isUuid(String(existingMember.office_id))) {
        resolvedOfficeId = String(existingMember.office_id);
      } else if (existingMember?.office_id) {
        /* Legacy non-UUID membership (trial_*, default) — do not remap in this stage */
        resolvedOfficeId = String(existingMember.office_id);
      } else {
        const officeName: string =
          (data as any)?.officeName ?? (data as any)?.name ?? "مكتب المحاماة";
        try {
          const provisioned = await provisionOfficeForUser({
            ownerUserId: userId,
            officeName,
            plan: "trial",
            lifecycle: "trial",
            context: "onboarding_state",
            specialty: (data as any)?.specialty,
            officeSize: (data as any)?.officeSize,
            writeTrialOffices: true,
            onboarding: {
              completed: true,
              step: step ?? 10,
              data: data ?? {},
            },
          });
          resolvedOfficeId = provisioned.officeId;
          invalidateTenantCache(userId);
          console.log(`[ONBOARDING] Provisioned office ${resolvedOfficeId} for user ${userId}`);
        } catch (e: any) {
          if (e instanceof OfficeProvisionError && e.code === "LEGACY_NON_UUID") {
            /* Keep legacy tenant id; onboarding_state update still proceeds */
            const trial = await sqlOne(sql`
              SELECT office_id FROM trial_offices WHERE user_id = ${userId} LIMIT 1
            `);
            resolvedOfficeId = trial?.office_id ? String(trial.office_id) : "default";
          } else {
            throw e;
          }
        }
      }
    }

    const officeForState = resolvedOfficeId ?? "default";

    const row = await sqlOne(sql`
      INSERT INTO onboarding_state (user_id, office_id, completed, step, data, updated_at)
      VALUES (
        ${userId},
        ${officeForState},
        ${completed ?? false},
        ${step ?? 0},
        ${JSON.stringify(data ?? {})}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        completed  = EXCLUDED.completed,
        step       = EXCLUDED.step,
        data       = EXCLUDED.data,
        office_id  = CASE
                       WHEN EXCLUDED.office_id != 'default'
                       THEN EXCLUDED.office_id
                       ELSE onboarding_state.office_id
                     END,
        updated_at = NOW()
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
