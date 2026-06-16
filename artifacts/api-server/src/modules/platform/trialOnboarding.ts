import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";
import { getAuth } from "@clerk/express";
import { callAI } from "../ai/aiChat";

const router = Router();

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

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

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trial_offices (
      id            SERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL UNIQUE,
      office_id     TEXT NOT NULL,
      office_name   TEXT NOT NULL DEFAULT '',
      specialty     TEXT NOT NULL DEFAULT '',
      office_size   TEXT NOT NULL DEFAULT 'solo',
      trial_start   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      trial_end     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
      converted     BOOLEAN NOT NULL DEFAULT FALSE,
      converted_at  TIMESTAMPTZ,
      setup_data    JSONB DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

router.post("/onboarding/setup", requireAuth, async (req, res) => {
  await ensureTables();
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

    const officeId = `trial_${userId.slice(-8)}`;

    const existing = await sqlOne(sql`SELECT id FROM trial_offices WHERE user_id = ${userId}`);
    if (existing) {
      await db.execute(sql`
        UPDATE trial_offices SET
          office_name = ${officeName ?? ""},
          specialty   = ${specialty ?? ""},
          office_size = ${officeSize ?? "solo"},
          setup_data  = ${JSON.stringify({ firstCase, inviteEmail })}::jsonb
        WHERE user_id = ${userId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO trial_offices (user_id, office_id, office_name, specialty, office_size, setup_data)
        VALUES (
          ${userId}, ${officeId},
          ${officeName ?? ""}, ${specialty ?? ""}, ${officeSize ?? "solo"},
          ${JSON.stringify({ firstCase, inviteEmail })}::jsonb
        )
      `);
    }

    await db.execute(sql`
      UPDATE onboarding_state
      SET completed = true, step = 10,
          data = ${JSON.stringify({ officeName, specialty, officeSize, firstCase })}::jsonb,
          updated_at = NOW()
      WHERE user_id = ${userId}
    `);

    let createdCaseId: number | null = null;
    if (firstCase?.title) {
      try {
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
            INSERT INTO clients (name, office_id, created_by)
            VALUES (${firstCase.clientName}, ${officeId}, ${userId})
            ON CONFLICT DO NOTHING
            RETURNING id
          `);
          if (client?.id) {
            await db.execute(sql`
              UPDATE cases SET client_id = ${client.id} WHERE id = ${createdCaseId}
            `).catch(() => {});
          }
        }
      } catch { }
    }

    res.json({ ok: true, officeId, createdCaseId, trialDays: 7 });
  } catch (e: any) {
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  await ensureTables();
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
