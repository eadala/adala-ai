import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ── helpers ─────────────────────────────────────────── */
async function sqlOne(q: any) {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS home_cms (
      id           INTEGER PRIMARY KEY DEFAULT 1,
      hero         JSONB NOT NULL DEFAULT '{}',
      trust        JSONB NOT NULL DEFAULT '{}',
      features     JSONB NOT NULL DEFAULT '{}',
      cta_section  JSONB NOT NULL DEFAULT '{}',
      announcement JSONB NOT NULL DEFAULT '{}',
      stats        JSONB NOT NULL DEFAULT '{}',
      seo          JSONB NOT NULL DEFAULT '{}',
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_by   TEXT
    )
  `);
  /* seed default row if missing */
  await db.execute(sql`
    INSERT INTO home_cms (id) VALUES (1) ON CONFLICT DO NOTHING
  `);
}

const DEFAULT_CONTENT = {
  hero: {
    badge:          "منصة SaaS قانونية متكاملة للمكاتب حول العالم",
    titleLine1:     "إدارة قانونية",
    titleLine2:     "أكثر ذكاءً",
    titleHighlight: "مدعومة بالذكاء الاصطناعي",
    subtitle:       "عدالة AI منصة SaaS متكاملة للمكاتب القانونية والشركات. تجمع إدارة القضايا والعملاء والعقود والمستندات والفوترة والإدارة المالية والموارد البشرية والذكاء الاصطناعي في منصة واحدة آمنة وقابلة للتوسع عالمياً.",
    ctaText:        "ابدأ مجاناً",
    ctaSubText:     "لا بطاقة ائتمانية",
    quickSetup:     "إعداد خلال دقائق",
    arabicSupport:  "دعم العربية والإنجليزية",
  },
  trust: {
    tagline:      "يثق بنا آلاف المحامين والمكاتب القانونية حول العالم",
    officesCount: "٢,٤٠٠+",
    casesCount:   "١٨٠,٠٠٠+",
    satisfaction: "٩٩.٩٪",
    timeSaving:   "٦٠٪",
  },
  features: {
    label:    "المميزات",
    title:    "كل ما يحتاجه مكتبك في منصة واحدة",
    subtitle: "أكثر من 24 وحدة متكاملة لإدارة الأعمال القانونية بكفاءة أعلى وتوسّع أسرع",
  },
  cta_section: {
    title:          "ابدأ رحلتك نحو مكتب قانوني",
    titleHighlight: "أكثر ذكاءً وكفاءة",
    subtitle:       "انضم إلى مئات المكاتب القانونية التي تثق بعدالة AI. ابدأ مجاناً اليوم.",
    buttonText:     "ابدأ مجاناً الآن",
    noCard:         "لا بطاقة مطلوبة",
    arabicSupport:  "دعم عربي كامل",
  },
  announcement: {
    enabled: false,
    text:    "🎉 إطلاق النسخة الجديدة — جرّب مجاناً لمدة ٣٠ يوماً",
    bgColor: "#C9A84C",
    textColor: "#0D1626",
    link:    "",
  },
  stats: {
    offices:      "٢,٤٠٠",
    cases:        "١٨٠,٠٠٠",
    satisfaction: "٩٩.٩",
    timeSaving:   "٦٠",
  },
  seo: {
    title:       "عدالة AI — منصة إدارة المكاتب القانونية",
    description: "منصة SaaS عربية متكاملة للمكاتب القانونية — إدارة القضايا والعملاء والفواتير والذكاء الاصطناعي في منصة واحدة",
    keywords:    "محاماة، قانون، برنامج محاماة، إدارة قضايا، SaaS قانوني",
    ogImage:     "",
  },
};

/* ══════════════════════════════════════════════════════
   PUBLIC: GET /api/home/content
══════════════════════════════════════════════════════ */
router.get("/home/content", async (_req, res) => {
  try {
    await ensureTable();
    const row = await sqlOne(sql`SELECT * FROM home_cms WHERE id = 1`);
    if (!row) return res.json(DEFAULT_CONTENT);

    /* merge DB values with defaults so missing keys still work */
    const content: Record<string, any> = {};
    for (const key of Object.keys(DEFAULT_CONTENT)) {
      const dbVal = row[key === "cta_section" ? "cta_section" : key];
      content[key] = dbVal && Object.keys(dbVal).length > 0
        ? { ...(DEFAULT_CONTENT as any)[key], ...dbVal }
        : (DEFAULT_CONTENT as any)[key];
    }
    return res.json({ ...content, updatedAt: row.updated_at, updatedBy: row.updated_by });
  } catch (err: any) {
    return res.json(DEFAULT_CONTENT);
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: PUT /api/home/content  (super-admin only via isSuperAdmin)
══════════════════════════════════════════════════════ */
router.put("/home/content", async (req, res) => {
  try {
    await ensureTable();
    const { hero, trust, features, cta_section, announcement, stats, seo, updatedBy } = req.body;

    await db.execute(sql`
      UPDATE home_cms SET
        hero         = COALESCE(${JSON.stringify(hero ?? {})}::jsonb,         hero),
        trust        = COALESCE(${JSON.stringify(trust ?? {})}::jsonb,        trust),
        features     = COALESCE(${JSON.stringify(features ?? {})}::jsonb,     features),
        cta_section  = COALESCE(${JSON.stringify(cta_section ?? {})}::jsonb,  cta_section),
        announcement = COALESCE(${JSON.stringify(announcement ?? {})}::jsonb, announcement),
        stats        = COALESCE(${JSON.stringify(stats ?? {})}::jsonb,        stats),
        seo          = COALESCE(${JSON.stringify(seo ?? {})}::jsonb,          seo),
        updated_at   = NOW(),
        updated_by   = ${updatedBy ?? null}
      WHERE id = 1
    `);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: POST /api/home/content/reset
══════════════════════════════════════════════════════ */
router.post("/home/content/reset", async (_req, res) => {
  try {
    await ensureTable();
    await db.execute(sql`
      UPDATE home_cms SET
        hero         = ${JSON.stringify(DEFAULT_CONTENT.hero)}::jsonb,
        trust        = ${JSON.stringify(DEFAULT_CONTENT.trust)}::jsonb,
        features     = ${JSON.stringify(DEFAULT_CONTENT.features)}::jsonb,
        cta_section  = ${JSON.stringify(DEFAULT_CONTENT.cta_section)}::jsonb,
        announcement = ${JSON.stringify(DEFAULT_CONTENT.announcement)}::jsonb,
        stats        = ${JSON.stringify(DEFAULT_CONTENT.stats)}::jsonb,
        seo          = ${JSON.stringify(DEFAULT_CONTENT.seo)}::jsonb,
        updated_at   = NOW()
      WHERE id = 1
    `);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
