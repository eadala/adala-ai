/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; schema authority */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { getAuth } from "@clerk/express";
import {
  getGeminiApiKey,
  geminiApiHeaders,
  geminiGenerateContentUrl,
} from "../../lib/geminiAuth";
import { isUuid } from "../../lib/officePageResolverLogic";
import {
  OfficeProvisionError,
  provisionOfficeForUser,
} from "../../lib/officeProvision";
import { invalidateTenantCache } from "../../middlewares/tenantMiddleware";

const router = Router();

const GEMINI_KEY = getGeminiApiKey() ?? "";

async function sqlOne(q: any): Promise<any> {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

async function sqlAll(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

/* trial_offices schema: artifacts/api-server/migrations/005_tenant_platform_tables.sql */

router.post("/onboarding/setup", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const { officeName, specialty, officeSize, firstCase, inviteEmail } = req.body as {
      officeName?: string;
      specialty?: string;
      officeSize?: string;
      firstCase?: { title: string; type: string; clientName: string };
      inviteEmail?: string;
    };

    const setupData = { firstCase, inviteEmail };
    let officeId: string;
    let provisionedFresh = false;

    const existing = await sqlOne(sql`SELECT office_id FROM trial_offices WHERE user_id = ${userId}`);
    if (existing?.office_id && isUuid(String(existing.office_id))) {
      officeId = String(existing.office_id);
      /* Idempotent retry: refresh metadata via helper (same UUID) */
      await provisionOfficeForUser({
        ownerUserId: userId,
        officeName: officeName ?? "مكتب المحاماة",
        plan: "trial",
        lifecycle: "trial",
        context: "onboarding_setup",
        specialty: specialty ?? "",
        officeSize: officeSize ?? "solo",
        setupData,
        writeTrialOffices: true,
        onboarding: {
          completed: true,
          step: 10,
          data: { officeName, specialty, officeSize, firstCase },
        },
      });
    } else if (existing?.office_id) {
      /* Legacy trial_* — fail closed: no second office, no business writes under legacy id */
      return res.status(409).json({
        error: "المكتب الحالي يحتاج ترحيل إلى معرف UUID قبل المتابعة (Stage 15.2c)",
        code: "LEGACY_NON_UUID",
        needsMigration: true,
        migrationStage: "15.2c",
        legacyOfficeId: String(existing.office_id),
        action: "remap_to_uuid_office_page",
      });
    } else {
      try {
        const result = await provisionOfficeForUser({
          ownerUserId: userId,
          officeName: officeName ?? "مكتب المحاماة",
          plan: "trial",
          lifecycle: "trial",
          context: "onboarding_setup",
          specialty: specialty ?? "",
          officeSize: officeSize ?? "solo",
          setupData,
          writeTrialOffices: true,
          onboarding: {
            completed: true,
            step: 10,
            data: { officeName, specialty, officeSize, firstCase },
          },
        });
        officeId = result.officeId;
        provisionedFresh = result.created;
      } catch (e: unknown) {
        if (e instanceof OfficeProvisionError && e.code === "LEGACY_NON_UUID") {
          const legacy = await sqlOne(sql`
            SELECT office_id FROM trial_offices WHERE user_id = ${userId}
            UNION ALL
            SELECT office_id FROM office_members
            WHERE user_id = ${userId} AND status = 'active'
            LIMIT 1
          `);
          return res.status(409).json({
            error: e.message,
            code: "LEGACY_NON_UUID",
            needsMigration: true,
            migrationStage: "15.2c",
            legacyOfficeId: legacy?.office_id ? String(legacy.office_id) : null,
            action: "remap_to_uuid_office_page",
          });
        }
        throw e;
      }
    }

    if (!isUuid(officeId)) {
      return res.status(409).json({
        error: "المكتب الحالي يحتاج ترحيل إلى معرف UUID قبل المتابعة (Stage 15.2c)",
        code: "LEGACY_NON_UUID",
        needsMigration: true,
        migrationStage: "15.2c",
        legacyOfficeId: officeId,
        action: "remap_to_uuid_office_page",
      });
    }

    invalidateTenantCache(userId);

    let createdCaseId: number | null = null;
    if (firstCase?.title) {
      try {
        /* Business seed only under canonical Office UUID */
        const caseRow = await sqlOne(sql`
          INSERT INTO cases (title, case_type, status, created_by, office_id)
          VALUES (
            ${firstCase.title},
            ${firstCase.type ?? "مدني"},
            'open',
            ${userId},
            ${officeId}
          )
          RETURNING id
        `);
        createdCaseId = caseRow?.id ?? null;

        if (firstCase.clientName && createdCaseId) {
          const client = await sqlOne(sql`
            INSERT INTO clients (full_name, office_id, created_by)
            VALUES (${firstCase.clientName}, ${officeId}, ${userId})
            ON CONFLICT DO NOTHING
            RETURNING id
          `);
          if (client?.id) {
            try {
              await db.execute(sql`
                UPDATE cases SET client_id = ${client.id} WHERE id = ${createdCaseId}
              `);
            } catch (linkErr: unknown) {
              console.error(
                "[trialOnboarding] case-client link failed:",
                linkErr instanceof Error ? linkErr.message : linkErr,
              );
            }
          }
        }
      } catch (seedErr: unknown) {
        console.error(
          "[trialOnboarding] first-case seed failed:",
          seedErr instanceof Error ? seedErr.message : seedErr,
        );
        return res.status(500).json({
          error: "تم إنشاء المكتب لكن فشل إنشاء القضية التجريبية",
          code: "FIRST_CASE_SEED_FAILED",
          officeId,
          created: provisionedFresh,
        });
      }
    }

    res.json({ ok: true, officeId, createdCaseId, trialDays: 7, created: provisionedFresh });
  } catch (e: any) {
    console.error("[trialOnboarding] setup failed:", e?.message ?? e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/onboarding/ai-suggest", requireAuth, async (req, res) => {
  try {
    const { specialty, type } = req.body as { specialty: string; type: "office_name" | "case" };

    if (!GEMINI_KEY) {
      const fallbacks: Record<string, any> = {
        office_name: [`مكتب ${specialty} للمحاماة`, `الشركة القانونية للتخصص في ${specialty}`, `مكتب العدالة — ${specialty}`],
        case: {
          titles: ["قضية عقد مخالفة شروط", "نزاع تجاري على ملكية", "مطالبة بحقوق عمالية"],
          types: ["تجاري", "مدني", "عمالي"],
        },
      };
      return res.json(fallbacks[type] ?? []);
    }

    const prompts: Record<string, string> = {
      office_name: `أقترح 3 أسماء احترافية باللغة العربية لمكتب محاماة متخصص في "${specialty}". أرجع فقط JSON array من الأسماء بدون شرح. مثال: ["مكتب الأحمدي","مكتب العدل","مكتب البتيري"]`,
      case: `أقترح قضية قانونية تجريبية واقعية لمكتب متخصص في "${specialty}". أرجع JSON بهذا الشكل بالضبط: {"title":"...","type":"...","clientName":"...","description":"..."}. القضية بالعربية فقط، قصيرة ومنطقية.`,
    };

    const response = await fetch(
      geminiGenerateContentUrl("gemini-2.5-flash"),
      {
        method: "POST",
        headers: geminiApiHeaders(GEMINI_KEY || undefined),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompts[type] }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 300, responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      return res.json(type === "office_name" ? [] : {});
    }

    const data = await response.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch {
      return res.json(type === "office_name" ? [] : {});
    }
  } catch (e: any) {
    res.json(req.body.type === "office_name" ? [] : {});
  }
});

router.get("/onboarding/trial-status", requireAuth, async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.json({ isTrial: false });

    const row = await sqlOne(sql`
      SELECT *, EXTRACT(EPOCH FROM (trial_end - NOW())) / 86400 AS days_left
      FROM trial_offices WHERE user_id = ${userId}
    `);

    if (!row) return res.json({ isTrial: false });

    const daysLeft = Math.max(0, Math.ceil(Number(row.days_left ?? 0)));
    const expired = daysLeft <= 0;

    res.json({
      isTrial: !row.converted,
      expired,
      daysLeft,
      officeName: row.office_name,
      specialty: row.specialty,
      trialEnd: row.trial_end,
    });
  } catch {
    res.json({ isTrial: false });
  }
});

export default router;
