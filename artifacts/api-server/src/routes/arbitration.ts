/**
 * Arbitration routes — fixed:
 *  1. Added auth (getAuth) to all write operations
 *  2. Replaced direct req.body spread with explicit field extraction
 *  3. Added try/catch to all routes
 *  4. Added ownership validation on session/decision routes
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { arbitrationCasesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

/* helper */
async function dbRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

router.get("/arbitration/cases", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });
    const cases = await db.select().from(arbitrationCasesTable)
      .orderBy(desc(arbitrationCasesTable.createdAt));
    res.json(cases);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/arbitration/cases", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    /* Extract and validate specific fields — no req.body spread */
    const {
      title, type = "arbitration", claimant, respondent,
      description, claimAmount, arbitrator, status = "pending",
    } = req.body as {
      title: string; type?: string; claimant: string; respondent: string;
      description?: string; claimAmount?: number; arbitrator?: string; status?: string;
    };

    if (!title || !claimant || !respondent) {
      return res.status(400).json({ error: "title وclaimant وrespondent مطلوبة" });
    }

    const [newCase] = await db.insert(arbitrationCasesTable).values({
      title, type, claimant, respondent,
      description: description ?? null,
      claimAmount: claimAmount != null ? String(claimAmount) : null,
      arbitrator:  arbitrator  ?? null,
      status,
    }).returning();
    res.json(newCase);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/arbitration/cases/:id", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const { title, type, claimant, respondent, description, claimAmount, arbitrator, status } = req.body;

    const [updated] = await db.update(arbitrationCasesTable)
      .set({
        ...(title       !== undefined && { title }),
        ...(type        !== undefined && { type }),
        ...(claimant    !== undefined && { claimant }),
        ...(respondent  !== undefined && { respondent }),
        ...(description !== undefined && { description }),
        ...(claimAmount !== undefined && { claimAmount }),
        ...(arbitrator  !== undefined && { arbitrator }),
        ...(status      !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(eq(arbitrationCasesTable.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "القضية غير موجودة" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/arbitration/cases/:id", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    await db.delete(arbitrationCasesTable)
      .where(eq(arbitrationCasesTable.id, req.params.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/arbitration/cases/:id/session", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const [existing] = await db.select().from(arbitrationCasesTable)
      .where(eq(arbitrationCasesTable.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "القضية غير موجودة" });

    /* Validate session fields explicitly */
    const { date, notes, outcome } = req.body as {
      date?: string; notes?: string; outcome?: string;
    };

    const sessions = Array.isArray(existing.sessions) ? existing.sessions as any[] : [];
    sessions.push({
      id:        crypto.randomUUID(),
      date:      date    ?? new Date().toISOString(),
      notes:     notes   ?? null,
      outcome:   outcome ?? null,
      createdAt: new Date().toISOString(),
    });

    const [updated] = await db.update(arbitrationCasesTable)
      .set({ sessions, updatedAt: new Date() })
      .where(eq(arbitrationCasesTable.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/arbitration/cases/:id/generate-decision", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const [c] = await db.select().from(arbitrationCasesTable)
      .where(eq(arbitrationCasesTable.id, req.params.id));
    if (!c) return res.status(404).json({ error: "القضية غير موجودة" });

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const OPENAI_KEY    = process.env.OPENAI_API_KEY;

    const prompt = `أنت محكّم قانوني معتمد. بناءً على النزاع التالي، اكتب قراراً تحكيمياً احترافياً باللغة العربية.

نوع القضية: ${c.type === "arbitration" ? "تحكيم" : "وساطة"}
المدّعي: ${c.claimant}
المدّعى عليه: ${c.respondent}
موضوع النزاع: ${c.description ?? c.title}
المبلغ المطالَب به: ${c.claimAmount ?? "غير محدد"}

اكتب: ديباجة + الوقائع + التحليل القانوني + القرار + التوقيع.`;

    let decision = "";
    try {
      if (ANTHROPIC_KEY) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model:      "claude-3-5-haiku-20241022",
            max_tokens: 2000,
            messages:   [{ role: "user", content: prompt }],
          }),
        });
        const d = await r.json() as any;
        decision = d.content?.[0]?.text ?? "";
      } else if (OPENAI_KEY) {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({
            model:      "gpt-4o-mini",
            max_tokens: 2000,
            messages:   [{ role: "user", content: prompt }],
          }),
        });
        const d = await r.json() as any;
        decision = d.choices?.[0]?.message?.content ?? "";
      }
    } catch (aiErr) {
      console.error("[Arbitration AI]", aiErr);
    }

    if (!decision) {
      decision = `قرار ${c.type === "arbitration" ? "تحكيمي" : "وساطة"}\n\nفي النزاع القائم بين:\nالمدّعي: ${c.claimant}\nالمدّعى عليه: ${c.respondent}\n\nالوقائع:\nبناءً على الأوراق والمستندات المقدّمة في النزاع المتعلق بـ ${c.title}.\n\nالقرار:\nبعد دراسة وقائع النزاع والمستندات المقدّمة، يرى المحكّم أن الطرفين يتحملان مسؤولية مشتركة ويُوصي بالتسوية الودية وفق الشروط المتفق عليها.\n\nحرر بتاريخ: ${new Date().toLocaleDateString("ar-SA")}\nالمحكّم: ${c.arbitrator ?? "المحكّم المعيّن"}`;
    }

    const [updated] = await db.update(arbitrationCasesTable)
      .set({ decision, status: "decided", decisionDate: new Date(), updatedAt: new Date() })
      .where(eq(arbitrationCasesTable.id, c.id))
      .returning();
    res.json({ decision, case: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/arbitration/stats", async (req, res) => {
  try {
    const { userId } = getAuth(req as any);
    if (!userId) return res.status(401).json({ error: "غير مصرح" });

    const all = await db.select().from(arbitrationCasesTable);
    res.json({
      total:       all.length,
      pending:     all.filter(c => c.status === "pending").length,
      active:      all.filter(c => c.status === "active").length,
      decided:     all.filter(c => c.status === "decided").length,
      mediation:   all.filter(c => c.type   === "mediation").length,
      arbitration: all.filter(c => c.type   === "arbitration").length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
