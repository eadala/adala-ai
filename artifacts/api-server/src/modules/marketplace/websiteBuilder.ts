import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI } from "../ai/aiChat";

const router = Router();

/* ─── helpers ──────────────────────────────────────────────────────── */
async function getOfficeId(userId: string): Promise<string | null> {
  try {
    const rows = await db.execute(sql`
      SELECT op.id FROM office_page op
      JOIN office_members om ON om.office_id = op.id
      WHERE om.user_id = ${userId}
      LIMIT 1
    `);
    const arr = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
    return arr[0]?.id ?? null;
  } catch { return null; }
}

/* ─── GET /website-builder/config ──────────────────────────────────── */
router.get("/website-builder/config", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.json({ website_config: {} });

    const rows = await db.execute(sql`
      SELECT website_config FROM office_page WHERE id = ${officeId} LIMIT 1
    `);
    const arr = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
    res.json({ website_config: arr[0]?.website_config ?? {} });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── PATCH /website-builder/config ────────────────────────────────── */
router.patch("/website-builder/config", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.status(404).json({ error: "No office found" });

    const config = req.body;
    await db.execute(sql`
      UPDATE office_page SET website_config = ${JSON.stringify(config)}::jsonb
      WHERE id = ${officeId}
    `);
    res.json({ success: true, website_config: config });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /website-builder/ai-generate ────────────────────────────── */
router.post("/website-builder/ai-generate", requireAuthWithTenant, async (req: any, res) => {
  try {
    const { officeName, specializations = [], city, teamSize, currentContent } = req.body;

    const prompt = `أنت كاتب محتوى قانوني محترف. اكتب محتوى احترافي لموقع مكتب محاماة.

المعلومات:
- اسم المكتب: ${officeName || "مكتب المحاماة"}
- التخصصات: ${specializations.join("، ") || "قانون عام"}
- المدينة: ${city || "الرياض"}
- حجم الفريق: ${teamSize || "5-10"} محامين

أنتج JSON بالتنسيق التالي:
{
  "heroTitle": "عنوان رئيسي جاذب للموقع (40 حرف)",
  "heroSubtitle": "وصف تسويقي مقنع (80 حرف)",
  "about": "نص تعريفي احترافي بالمكتب (150 كلمة)",
  "metaTitle": "عنوان SEO (60 حرف)",
  "metaDescription": "وصف SEO (155 حرف)",
  "keywords": "كلمات مفتاحية مفصولة بفاصلة",
  "faqItems": [
    {"q": "سؤال شائع 1", "a": "إجابة احترافية 1"},
    {"q": "سؤال شائع 2", "a": "إجابة احترافية 2"},
    {"q": "سؤال شائع 3", "a": "إجابة احترافية 3"}
  ]
}

أجب بـ JSON فقط، لا شرح إضافي.`;

    const { reply: raw } = await callAI("أنت مساعد ذكي لبناء مواقع مكاتب المحاماة. أجب بـ JSON فقط.", prompt, [], "gemini");
    let content: any = {};
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) content = JSON.parse(match[0]);
    } catch {
      content = { heroTitle: officeName, heroSubtitle: "خدمات قانونية متميزة", about: raw };
    }

    res.json({ success: true, content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /website-builder/pages ───────────────────────────────────── */
router.get("/website-builder/pages", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.json([]);

    const rows = await db.execute(sql`
      SELECT * FROM website_builder_pages WHERE office_id = ${officeId}
      ORDER BY created_at DESC
    `);
    const arr = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
    res.json(arr);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /website-builder/pages ──────────────────────────────────── */
router.post("/website-builder/pages", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.status(404).json({ error: "No office" });

    const { slug, titleAr, titleEn, contentAr, contentEn, pageType, metaTitle, metaDescription, keywords } = req.body;
    const rows = await db.execute(sql`
      INSERT INTO website_builder_pages
        (office_id, slug, title_ar, title_en, content_ar, content_en, page_type, meta_title, meta_description, keywords)
      VALUES
        (${officeId}, ${slug}, ${titleAr ?? null}, ${titleEn ?? null},
         ${contentAr ?? null}, ${contentEn ?? null}, ${pageType ?? "legal"},
         ${metaTitle ?? null}, ${metaDescription ?? null}, ${keywords ?? null})
      ON CONFLICT (office_id, slug) DO UPDATE SET
        title_ar = EXCLUDED.title_ar, title_en = EXCLUDED.title_en,
        content_ar = EXCLUDED.content_ar, content_en = EXCLUDED.content_en,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
        keywords = EXCLUDED.keywords, updated_at = NOW()
      RETURNING *
    `);
    const arr = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
    res.json(arr[0] ?? {});
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── PATCH /website-builder/pages/:id ─────────────────────────────── */
router.patch("/website-builder/pages/:id", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.params as Record<string, string>;
    const { titleAr, titleEn, contentAr, contentEn, metaTitle, metaDescription, keywords, isPublished } = req.body;

    await db.execute(sql`
      UPDATE website_builder_pages SET
        title_ar = COALESCE(${titleAr ?? null}, title_ar),
        title_en = COALESCE(${titleEn ?? null}, title_en),
        content_ar = COALESCE(${contentAr ?? null}, content_ar),
        content_en = COALESCE(${contentEn ?? null}, content_en),
        meta_title = COALESCE(${metaTitle ?? null}, meta_title),
        meta_description = COALESCE(${metaDescription ?? null}, meta_description),
        keywords = COALESCE(${keywords ?? null}, keywords),
        is_published = COALESCE(${isPublished ?? null}, is_published),
        updated_at = NOW()
      WHERE id = ${id}::uuid AND office_id = ${officeId}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── DELETE /website-builder/pages/:id ────────────────────────────── */
router.delete("/website-builder/pages/:id", requireAuthWithTenant, async (req: any, res) => {
  try {
    const officeId = await getOfficeId(req.auth.userId);
    if (!officeId) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.params as Record<string, string>;
    await db.execute(sql`
      DELETE FROM website_builder_pages WHERE id = ${id}::uuid AND office_id = ${officeId}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── POST /website-builder/ai-legal-page ──────────────────────────── */
router.post("/website-builder/ai-legal-page", requireAuthWithTenant, async (req: any, res) => {
  try {
    const { officeName, pageType, city } = req.body;

    const types: Record<string, string> = {
      commercial: "قانون تجاري وشركات",
      labor: "قانون العمل والعمال",
      real_estate: "قانون عقاري",
      family: "قانون الأحوال الشخصية والأسرة",
      criminal: "قانون جنائي",
      administrative: "قانون إداري",
      intellectual: "ملكية فكرية وعلامات تجارية",
      banking: "قانون بنكي ومالي",
    };

    const typeLabel = types[pageType] ?? pageType;
    const prompt = `اكتب صفحة قانونية احترافية لمكتب محاماة متخصص في ${typeLabel}.

المكتب: ${officeName || "مكتب المحاماة"}، ${city || "الرياض"}

أنتج JSON:
{
  "titleAr": "عنوان الصفحة",
  "contentAr": "محتوى الصفحة (400 كلمة تسويقية وقانونية، HTML بسيط مع <h2> و<p> و<ul>)",
  "metaTitle": "عنوان SEO",
  "metaDescription": "وصف SEO",
  "keywords": "كلمات مفتاحية"
}

أجب بـ JSON فقط.`;

    const { reply: raw } = await callAI("أنت مساعد ذكي لبناء المحتوى القانوني. أجب بـ JSON فقط.", prompt, [], "gemini");
    let content: any = {};
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) content = JSON.parse(match[0]);
    } catch { content = { titleAr: typeLabel, contentAr: raw }; }

    res.json({ success: true, content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
