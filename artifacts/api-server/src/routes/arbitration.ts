import { Router } from "express";
import { db } from "@workspace/db";
import { arbitrationCasesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/arbitration/cases", async (_req, res) => {
  const cases = await db.select().from(arbitrationCasesTable).orderBy(desc(arbitrationCasesTable.createdAt));
  res.json(cases);
});

router.post("/arbitration/cases", async (req, res) => {
  const [newCase] = await db.insert(arbitrationCasesTable).values(req.body).returning();
  res.json(newCase);
});

router.patch("/arbitration/cases/:id", async (req, res) => {
  const [updated] = await db.update(arbitrationCasesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(arbitrationCasesTable.id, req.params.id)).returning();
  res.json(updated);
});

router.delete("/arbitration/cases/:id", async (req, res) => {
  await db.delete(arbitrationCasesTable).where(eq(arbitrationCasesTable.id, req.params.id));
  res.json({ success: true });
});

router.post("/arbitration/cases/:id/session", async (req, res) => {
  const [existing] = await db.select().from(arbitrationCasesTable).where(eq(arbitrationCasesTable.id, req.params.id));
  if (!existing) return res.status(404).json({ error: "القضية غير موجودة" });
  const sessions = Array.isArray(existing.sessions) ? existing.sessions as any[] : [];
  sessions.push({ ...req.body, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  const [updated] = await db.update(arbitrationCasesTable)
    .set({ sessions, updatedAt: new Date() })
    .where(eq(arbitrationCasesTable.id, req.params.id)).returning();
  res.json(updated);
});

router.post("/arbitration/cases/:id/generate-decision", async (req, res) => {
  const [c] = await db.select().from(arbitrationCasesTable).where(eq(arbitrationCasesTable.id, req.params.id));
  if (!c) return res.status(404).json({ error: "القضية غير موجودة" });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

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
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await r.json() as any;
      decision = d.content?.[0]?.text ?? "";
    } else if (OPENAI_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await r.json() as any;
      decision = d.choices?.[0]?.message?.content ?? "";
    }
  } catch {}

  if (!decision) {
    decision = `قرار ${c.type === "arbitration" ? "تحكيمي" : "وساطة"}\n\nفي النزاع القائم بين:\nالمدّعي: ${c.claimant}\nالمدّعى عليه: ${c.respondent}\n\nالوقائع:\nبناءً على الأوراق والمستندات المقدّمة في النزاع المتعلق بـ ${c.title}.\n\nالقرار:\nبعد دراسة وقائع النزاع والمستندات المقدّمة، يرى المحكّم أن الطرفين يتحملان مسؤولية مشتركة ويُوصي بالتسوية الودية وفق الشروط المتفق عليها.\n\nحرر بتاريخ: ${new Date().toLocaleDateString("ar-SA")}\nالمحكّم: ${c.arbitrator ?? "المحكّم المعيّن"}`;
  }

  const [updated] = await db.update(arbitrationCasesTable)
    .set({ decision, status: "decided", decisionDate: new Date(), updatedAt: new Date() })
    .where(eq(arbitrationCasesTable.id, c.id)).returning();
  res.json({ decision, case: updated });
});

router.get("/arbitration/stats", async (_req, res) => {
  const all = await db.select().from(arbitrationCasesTable);
  res.json({
    total: all.length,
    pending: all.filter(c => c.status === "pending").length,
    active: all.filter(c => c.status === "active").length,
    decided: all.filter(c => c.status === "decided").length,
    mediation: all.filter(c => c.type === "mediation").length,
    arbitration: all.filter(c => c.type === "arbitration").length,
  });
});

export default router;
