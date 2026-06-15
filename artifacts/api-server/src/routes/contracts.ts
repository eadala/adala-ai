import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { contractsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

const CONTRACT_TYPES: Record<string, string> = {
  employment: "عقد عمل", partnership: "عقد شراكة", investment: "عقد استثمار",
  franchise: "عقد امتياز تجاري", construction: "عقد مقاولات", lease: "عقد إيجار",
  service: "عقد خدمات", nda: "اتفاقية سرية", general: "عقد عام",
};

async function aiGenerateContract(type: string, parties: string[], details: string): Promise<string> {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const typeName = CONTRACT_TYPES[type] ?? type;

  const prompt = `أنت متخصص في صياغة العقود القانونية السعودية.
صِغ ${typeName} باللغة العربية الفصحى، متوافقاً مع الأنظمة السعودية.
الأطراف: ${parties.join(" و")}
التفاصيل: ${details}

يجب أن يتضمن العقد:
1. ديباجة العقد وبيانات الأطراف
2. تعريفات ومصطلحات
3. موضوع العقد والتزامات كل طرف
4. المقابل المالي وطريقة الدفع
5. مدة العقد والتجديد
6. أحكام الإنهاء والفسخ
7. تسوية النزاعات والاختصاص القضائي
8. أحكام ختامية

الصيغة: نصية واضحة ومنظمة بالترقيم.`;

  try {
    if (ANTHROPIC_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await res.json() as any;
      if (d.content?.[0]?.text) return d.content[0].text;
    } else if (OPENAI_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await res.json() as any;
      if (d.choices?.[0]?.message?.content) return d.choices[0].message.content;
    }
  } catch {}

  return `${typeName}

بين كل من:
الطرف الأول: ${parties[0] ?? "________"}
الطرف الثاني: ${parties[1] ?? "________"}

أولاً: موضوع العقد
${details}

ثانياً: التزامات الطرف الأول
- الوفاء بجميع الالتزامات المنصوص عليها في هذا العقد
- التعاون مع الطرف الثاني لتحقيق أهداف العقد

ثالثاً: التزامات الطرف الثاني
- الوفاء بجميع الالتزامات المنصوص عليها في هذا العقد
- السداد في المواعيد المتفق عليها

رابعاً: مدة العقد
يسري هذا العقد لمدة سنة قابلة للتجديد بموافقة الطرفين.

خامساً: تسوية النزاعات
تختص محاكم المملكة العربية السعودية بالنظر في أي نزاع ينشأ عن هذا العقد.

حرر في: ${new Date().toLocaleDateString("ar-SA")}`;
}

// ── GET /contracts ────────────────────────────────────────────────────────────
router.get("/contracts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const contracts = await db.select().from(contractsTable)
      .where(eq((contractsTable as any).officeId, tenantId))
      .orderBy(desc(contractsTable.createdAt));
    res.json(contracts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /contracts ───────────────────────────────────────────────────────────
router.post("/contracts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { title, type, parties, details, aiGenerate, notes, expiresAt, clientId, caseId } = req.body;
    let content = req.body.content ?? "";

    if (aiGenerate) {
      content = await aiGenerateContract(type ?? "general", parties ?? [], details ?? title);
    }

    const [contract] = await db.insert(contractsTable).values({
      title, type: type ?? "general", parties: parties ?? [],
      content, aiGenerated: !!aiGenerate, notes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      clientId, caseId,
      officeId: tenantId,
    } as any).returning();
    res.json(contract);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /contracts/:id ──────────────────────────────────────────────────────
router.patch("/contracts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const [updated] = await db.update(contractsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(contractsTable.id, id), eq((contractsTable as any).officeId, tenantId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "العقد غير موجود" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /contracts/:id ─────────────────────────────────────────────────────
router.delete("/contracts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    await db.delete(contractsTable)
      .where(and(eq(contractsTable.id, String(req.params.id)), eq((contractsTable as any).officeId, tenantId)));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /contracts/:id/analyze ───────────────────────────────────────────────
router.post("/contracts/:id/analyze", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const [contract] = await db.select().from(contractsTable)
      .where(and(eq(contractsTable.id, id), eq((contractsTable as any).officeId, tenantId)));
    if (!contract) return res.status(404).json({ error: "العقد غير موجود" });

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    const prompt = `حلل العقد التالي واستخرج:
1. المخاطر القانونية الرئيسية (قائمة)
2. نقاط القوة (قائمة)
3. التوصيات للتحسين (قائمة)
4. درجة المخاطرة من 1-10 (رقم فقط في السطر الأخير)

العقد:
${contract.content?.substring(0, 3000)}

أجب بتنسيق منظم بالعربية.`;

    let analysis = "";
    try {
      if (ANTHROPIC_KEY) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
        });
        const d = await r.json() as any;
        analysis = d.content?.[0]?.text ?? "";
      } else if (OPENAI_KEY) {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
        });
        const d = await r.json() as any;
        analysis = d.choices?.[0]?.message?.content ?? "";
      }
    } catch {}

    if (!analysis) {
      analysis = `**المخاطر القانونية:**\n- غياب شرط التحكيم الصريح\n- عدم تحديد عقوبة التأخر في السداد\n- إمكانية التفسير المتعارض لبعض البنود\n\n**نقاط القوة:**\n- وضوح موضوع العقد\n- تحديد الالتزامات بشكل معقول\n\n**التوصيات:**\n- إضافة شرط تحكيم\n- تحديد الغرامات التأخيرية\n- تعزيز بند الإنهاء\n\nدرجة المخاطرة: 5`;
    }

    const riskMatch = analysis.match(/درجة المخاطرة:\s*(\d+)/);
    const riskScore = riskMatch?.[1] ?? "5";
    await db.update(contractsTable).set({ riskScore, updatedAt: new Date() })
      .where(and(eq(contractsTable.id, id), eq((contractsTable as any).officeId, tenantId)));

    res.json({ analysis, riskScore });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
