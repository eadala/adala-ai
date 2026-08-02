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
  } catch (e: unknown) {
    console.error("[onboarding] sqlOne failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

function migrationRequired(
  res: { status: (n: number) => { json: (b: unknown) => unknown } },
  legacyOfficeId: string | null,
) {
  return res.status(409).json({
    error: "المكتب الحالي يحتاج ترحيل إلى معرف UUID قبل المتابعة (Stage 15.2c)",
    code: "LEGACY_NON_UUID",
    needsMigration: true,
    migrationStage: "15.2c",
    legacyOfficeId,
    action: "remap_to_uuid_office_page",
  });
}

router.get("/onboarding/state", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.json({ completed: false, step: 0, data: {} });
    const row = await sqlOne(sql`SELECT * FROM onboarding_state WHERE user_id = ${userId}`);
    res.json(row ?? { completed: false, step: 0, data: {} });
  } catch (e: unknown) {
    console.error("[onboarding] GET state failed:", e instanceof Error ? e.message : e);
    res.json({ completed: false, step: 0, data: {} });
  }
});

router.put("/onboarding/state", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const { completed, step, data } = req.body;

    // Incomplete progress: never invent default, platform, trial_*, or NULL office_id
    if (!completed) {
      const existing = await sqlOne(sql`
        SELECT * FROM onboarding_state WHERE user_id = ${userId} LIMIT 1
      `);
      if (existing) {
        const row = await sqlOne(sql`
          UPDATE onboarding_state
          SET completed  = false,
              step       = ${step ?? existing.step ?? 0},
              data       = ${JSON.stringify(data ?? existing.data ?? {})}::jsonb,
              updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `);
        return res.json(row);
      }
      /* No row yet and no canonical office — return ephemeral progress (do not persist default) */
      return res.json({
        completed: false,
        step: step ?? 0,
        data: data ?? {},
        office_id: null,
        persisted: false,
      });
    }

    /* ── Completing onboarding: require canonical UUID office ── */
    let resolvedOfficeId: string | null = null;

    const existingMember = await sqlOne(sql`
      SELECT office_id FROM office_members
      WHERE user_id = ${userId} AND status = 'active'
      LIMIT 1
    `);

    if (existingMember?.office_id && isUuid(String(existingMember.office_id))) {
      resolvedOfficeId = String(existingMember.office_id);
    } else if (existingMember?.office_id) {
      /* Legacy non-UUID membership — fail closed; no second office; no default write */
      return migrationRequired(res, String(existingMember.office_id));
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
      } catch (e: unknown) {
        if (e instanceof OfficeProvisionError && e.code === "LEGACY_NON_UUID") {
          const trial = await sqlOne(sql`
            SELECT office_id FROM trial_offices WHERE user_id = ${userId} LIMIT 1
          `);
          return migrationRequired(
            res,
            trial?.office_id ? String(trial.office_id) : null,
          );
        }
        throw e;
      }
    }

    if (!resolvedOfficeId || !isUuid(resolvedOfficeId)) {
      return res.status(500).json({
        error: "تعذر إكمال الإعداد بدون مكتب UUID",
        code: "OFFICE_UUID_REQUIRED",
      });
    }

    const row = await sqlOne(sql`
      INSERT INTO onboarding_state (user_id, office_id, completed, step, data, updated_at)
      VALUES (
        ${userId},
        ${resolvedOfficeId},
        true,
        ${step ?? 10},
        ${JSON.stringify(data ?? {})}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        completed  = true,
        step       = EXCLUDED.step,
        data       = EXCLUDED.data,
        office_id  = EXCLUDED.office_id,
        updated_at = NOW()
      RETURNING *
    `);
    res.json(row);
  } catch (e: any) {
    console.error("[onboarding] PUT state failed:", e?.message ?? e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
