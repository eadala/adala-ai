import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/express";

const router = Router();

function getClerk() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

async function isSuperAdminCheck(req: any): Promise<boolean> {
  const auth = getAuth(req);
  if (!auth?.userId) return false;
  try {
    const clerk = getClerk();
    const user = await clerk.users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const ownerEmail = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    return (!!ownerEmail && email === ownerEmail) || user.publicMetadata?.role === "super_admin";
  } catch { return false; }
}

async function adminOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdminCheck(req))) return res.status(403).json({ error: "غير مصرح" });
  next();
}

/* ── Default plans (Enterprise Pricing v2) ───────────────── */
export const DEFAULT_PLANS = [
  {
    id: "free", nameAr: "استكشف", nameEn: "Explorer",
    monthlyPrice: 0, yearlyPrice: 0, color: "#64748B",
    description: "جرّب النظام كاملاً · لا بطاقة ائتمان · لا التزام",
    badge: "🎁 مجاني · 90 يوم تجربة", recommended: false, isContactOnly: false, sortOrder: 0,
    features: ["قضايا أساسية (حتى 5)", "مستخدم واحد", "١ جيجا تخزين", "٥٬٠٠٠ AI credit", "تذكيرات ذكية", "تقويم قانوني", "تصدير PDF"],
    featureFlags: { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: true, ai: false, aiAnalytics: false, aiCfo: false, customAiTraining: false, documentTemplates: false, contractsAi: false, ocr: false, backup: false, website: true, serviceStore: false, payments: false, mobileApp: false, whatsapp: false, workflow: false, reportsAdvanced: false, clientPortal: false, customDomain: false, apiAccess: false, whiteLabel: false, sla: false, dedicatedManager: false, priorityInfrastructure: false },
    limits: { users: 1, storage: "١ GB", aiRequests: 5000, branches: 0 },
  },
  {
    id: "basic", nameAr: "انطلق", nameEn: "Launch",
    monthlyPrice: 399, yearlyPrice: 319, color: "#3B82F6",
    description: "للمحامي المستقل — مكتب رقمي احترافي من اليوم الأول",
    badge: null, recommended: false, isContactOnly: false, sortOrder: 1,
    features: ["٢ مستخدم", "١٠ جيجا تخزين", "٢٠٬٠٠٠ AI credit/شهر", "إدارة قضايا + عقود AI", "فواتير إلكترونية", "قوالب مستندات", "موقع المكتب الرقمي"],
    featureFlags: { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: true, ai: false, aiAnalytics: false, aiCfo: false, customAiTraining: false, documentTemplates: true, contractsAi: true, ocr: false, backup: false, website: true, serviceStore: true, payments: true, mobileApp: true, whatsapp: false, workflow: false, reportsAdvanced: false, clientPortal: false, customDomain: false, apiAccess: false, whiteLabel: false, sla: false, dedicatedManager: false, priorityInfrastructure: false },
    limits: { users: 2, storage: "١٠ GB", aiRequests: 20000, branches: 0 },
  },
  {
    id: "pro", nameAr: "أتقن", nameEn: "Professional",
    monthlyPrice: 899, yearlyPrice: 719, color: "#C9A84C",
    description: "للمكاتب النشطة — AI متقدم + تحليلات + نمو حقيقي",
    badge: "⭐ الأكثر شعبية", recommended: true, isContactOnly: false, sortOrder: 2,
    features: ["٥ مستخدمين", "٥٠ جيجا تخزين", "١٠٠٬٠٠٠ AI credit/شهر", "كل مزايا انطلق +", "🤖 AI متقدم (GPT-4/Claude)", "📊 تحليلات AI للقضايا", "🔍 OCR — استخراج النصوص", "💾 نسخ احتياطي يومي", "تقارير متقدمة + KPIs"],
    featureFlags: { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: true, ai: true, aiAnalytics: true, aiCfo: false, customAiTraining: false, documentTemplates: true, contractsAi: true, ocr: true, backup: true, website: true, serviceStore: true, payments: true, mobileApp: true, whatsapp: false, workflow: false, reportsAdvanced: true, clientPortal: false, customDomain: false, apiAccess: false, whiteLabel: false, sla: false, dedicatedManager: false, priorityInfrastructure: false },
    limits: { users: 5, storage: "٥٠ GB", aiRequests: 100000, branches: 0 },
  },
  {
    id: "growth", nameAr: "توسّع", nameEn: "Business",
    monthlyPrice: 1799, yearlyPrice: 1439, color: "#8B5CF6",
    description: "المكتب الذكي — فروع + واتساب + بوابة عملاء + تشغيل آلي",
    badge: "🏢 للمكاتب الذكية", recommended: false, isContactOnly: false, sortOrder: 3,
    features: ["١٥ مستخدماً", "١٥٠ جيجا تخزين", "٣٠٠٬٠٠٠ AI credit/شهر", "كل مزايا أتقن +", "🏢 ٣ فروع مستقلة", "💬 WhatsApp Business", "📲 Telegram Bot", "👥 بوابة الموكّلين", "⚙️ سير عمل آلي", "📊 تقارير KPIs"],
    featureFlags: { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: true, ai: true, aiAnalytics: true, aiCfo: false, customAiTraining: false, documentTemplates: true, contractsAi: true, ocr: true, backup: true, website: true, serviceStore: true, payments: true, mobileApp: true, whatsapp: true, workflow: true, reportsAdvanced: true, clientPortal: true, customDomain: false, apiAccess: false, whiteLabel: false, sla: false, dedicatedManager: false, priorityInfrastructure: false },
    limits: { users: 15, storage: "١٥٠ GB", aiRequests: 300000, branches: 3 },
  },
  {
    id: "advanced", nameAr: "تميّز", nameEn: "Advanced",
    monthlyPrice: 3999, yearlyPrice: 3199, color: "#EC4899",
    description: "نظام تشغيل مكتب قانوني متكامل — محاسبة + HR + هوية كاملة",
    badge: "🔥 ERP قانوني كامل", recommended: false, isContactOnly: false, sortOrder: 4,
    features: ["٣٠ مستخدماً", "٣٠٠ جيجا تخزين", "٨٠٠٬٠٠٠ AI credit/شهر", "كل مزايا توسّع +", "١٠ فروع", "🌐 نطاق خاص", "🔌 API كامل", "🏷️ وايت لابل", "🧠 CFO ذكي", "⚖️ محاسبة ERP", "👥 HR متكامل"],
    featureFlags: { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: true, ai: true, aiAnalytics: true, aiCfo: true, customAiTraining: false, documentTemplates: true, contractsAi: true, ocr: true, backup: true, website: true, serviceStore: true, payments: true, mobileApp: true, whatsapp: true, workflow: true, reportsAdvanced: true, clientPortal: true, customDomain: true, apiAccess: true, whiteLabel: true, sla: false, dedicatedManager: false, priorityInfrastructure: false },
    limits: { users: 30, storage: "٣٠٠ GB", aiRequests: 800000, branches: 10 },
  },
  {
    id: "enterprise", nameAr: "هيمن", nameEn: "Enterprise",
    monthlyPrice: 0, yearlyPrice: 0, color: "#10B981",
    description: "بنية تحتية خاصة · AI غير محدود · مدير حساب مخصص · SLA 24/7",
    badge: "🏆 للمجموعات الكبرى", recommended: false, isContactOnly: true, sortOrder: 5,
    features: ["مستخدمون غير محدود", "تخزين غير محدود", "AI credits غير محدودة", "فروع غير محدودة", "🤝 مدير حساب مخصص", "🛡️ SLA 24/7", "☁️ Private Cloud", "🔗 تكاملات ERP خارجية", "📜 عقد SLA ملزم"],
    featureFlags: { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: true, ai: true, aiAnalytics: true, aiCfo: true, customAiTraining: false, documentTemplates: true, contractsAi: true, ocr: true, backup: true, website: true, serviceStore: true, payments: true, mobileApp: true, whatsapp: true, workflow: true, reportsAdvanced: true, clientPortal: true, customDomain: true, apiAccess: true, whiteLabel: true, sla: true, dedicatedManager: true, priorityInfrastructure: false },
    limits: { users: "unlimited", storage: "غير محدود", aiRequests: "unlimited", branches: "unlimited" },
  },
  {
    id: "elite", nameAr: "الأسطورة", nameEn: "Elite",
    monthlyPrice: 0, yearlyPrice: 0, color: "#F59E0B",
    description: "AI مدرَّب على بياناتك · بنية تحتية مخصصة · لا سقف ولا حدود",
    badge: "👑 القمة المطلقة", recommended: false, isContactOnly: true, sortOrder: 6,
    features: ["كل Enterprise +", "🤖 AI مدرَّب على بيانات مكتبك", "🏗️ بنية تحتية معزولة", "📜 SLA 99.99% قانوني", "🚀 هجرة مجانية من أي نظام", "🌟 مدير نجاح ٢٤/٧"],
    featureFlags: { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: true, ai: true, aiAnalytics: true, aiCfo: true, customAiTraining: true, documentTemplates: true, contractsAi: true, ocr: true, backup: true, website: true, serviceStore: true, payments: true, mobileApp: true, whatsapp: true, workflow: true, reportsAdvanced: true, clientPortal: true, customDomain: true, apiAccess: true, whiteLabel: true, sla: true, dedicatedManager: true, priorityInfrastructure: true },
    limits: { users: "unlimited", storage: "غير محدود", aiRequests: "unlimited", branches: "unlimited" },
  },
];

/* ── Ensure table + new columns ─────────────────────────── */
async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS plan_cms (
      id              TEXT PRIMARY KEY,
      name_ar         TEXT NOT NULL,
      name_en         TEXT NOT NULL,
      monthly_price   INTEGER NOT NULL DEFAULT 0,
      yearly_price    INTEGER NOT NULL DEFAULT 0,
      color           TEXT NOT NULL DEFAULT '#64748B',
      description     TEXT,
      badge           TEXT,
      features        JSONB NOT NULL DEFAULT '[]',
      recommended     BOOLEAN NOT NULL DEFAULT false,
      is_contact_only BOOLEAN NOT NULL DEFAULT false,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  /* Add feature_flags and limits columns if not present */
  await db.execute(sql`ALTER TABLE plan_cms ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'`);
  await db.execute(sql`ALTER TABLE plan_cms ADD COLUMN IF NOT EXISTS limits JSONB NOT NULL DEFAULT '{}'`);

  /* Seed if empty */
  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM plan_cms`) as any;
  const rows = Array.isArray(result) ? result : (result?.rows ?? []);
  const cnt  = Number(rows[0]?.cnt ?? rows[0]?.count ?? 0);
  if (cnt === 0) {
    for (const p of DEFAULT_PLANS) {
      await db.execute(sql`
        INSERT INTO plan_cms (id, name_ar, name_en, monthly_price, yearly_price, color, description, badge, features, recommended, is_contact_only, sort_order, feature_flags, limits)
        VALUES (
          ${p.id}, ${p.nameAr}, ${p.nameEn}, ${p.monthlyPrice}, ${p.yearlyPrice},
          ${p.color}, ${p.description}, ${p.badge ?? null},
          ${JSON.stringify(p.features)}::jsonb,
          ${p.recommended}, ${p.isContactOnly}, ${p.sortOrder},
          ${JSON.stringify(p.featureFlags)}::jsonb,
          ${JSON.stringify(p.limits)}::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
  } else {
    /* Backfill feature_flags/limits for existing rows that have empty {} */
    for (const p of DEFAULT_PLANS) {
      await db.execute(sql`
        UPDATE plan_cms SET
          feature_flags = CASE WHEN feature_flags = '{}'::jsonb THEN ${JSON.stringify(p.featureFlags)}::jsonb ELSE feature_flags END,
          limits        = CASE WHEN limits        = '{}'::jsonb THEN ${JSON.stringify(p.limits)}::jsonb        ELSE limits        END
        WHERE id = ${p.id}
      `);
    }
  }
}

/* ── Convert DB row → plan object ─────────────────────────── */
function rowToPlan(row: any) {
  const ff = row.feature_flags ?? {};
  const lim = row.limits ?? {};
  return {
    id:            row.id,
    nameAr:        row.name_ar,
    nameEn:        row.name_en,
    name:          row.name_ar,
    monthlyPrice:  Number(row.monthly_price),
    yearlyPrice:   Number(row.yearly_price),
    price:         Number(row.monthly_price),
    color:         row.color,
    description:   row.description,
    badge:         row.badge,
    features:      Array.isArray(row.features) ? row.features : (typeof row.features === "string" ? JSON.parse(row.features) : []),
    featureFlags:  typeof ff === "string" ? JSON.parse(ff) : ff,
    limits:        typeof lim === "string" ? JSON.parse(lim) : lim,
    recommended:   !!row.recommended,
    popular:       !!row.recommended,
    isContactOnly: !!row.is_contact_only,
    sortOrder:     Number(row.sort_order),
    isFree:        Number(row.monthly_price) === 0,
  };
}

/* ── Public helper for billing.ts ─────────────────────────── */
export async function getDbPlans() {
  try {
    await ensureTable();
    const result = await db.execute(sql`SELECT * FROM plan_cms ORDER BY sort_order ASC`) as any;
    const rows = Array.isArray(result) ? result : (result?.rows ?? []);
    if (!rows.length) return DEFAULT_PLANS.map(p => ({ ...p, name: p.nameAr, price: p.monthlyPrice, popular: p.recommended, isFree: p.monthlyPrice === 0 }));
    return rows.map(rowToPlan);
  } catch {
    return DEFAULT_PLANS.map(p => ({ ...p, name: p.nameAr, price: p.monthlyPrice, popular: p.recommended, isFree: p.monthlyPrice === 0 }));
  }
}

/* ══════════════════════════════════════════════════════
   PUBLIC: GET /api/plans
══════════════════════════════════════════════════════ */
router.get("/plans", async (_req, res) => {
  try {
    const plans = await getDbPlans();
    return res.json(plans);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: GET /api/admin/plans
══════════════════════════════════════════════════════ */
router.get("/admin/plans", adminOnly, async (_req, res) => {
  try {
    const plans = await getDbPlans();
    return res.json(plans);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: PUT /api/admin/plans/:id  — update one plan
══════════════════════════════════════════════════════ */
router.put("/admin/plans/:id", adminOnly, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params as Record<string, string>;
    const { nameAr, nameEn, monthlyPrice, yearlyPrice, color, description, badge, features, recommended, isContactOnly, sortOrder, featureFlags, limits } = req.body;

    await db.execute(sql`
      UPDATE plan_cms SET
        name_ar         = ${nameAr},
        name_en         = ${nameEn},
        monthly_price   = ${Number(monthlyPrice ?? 0)},
        yearly_price    = ${Number(yearlyPrice ?? 0)},
        color           = ${color ?? "#64748B"},
        description     = ${description ?? null},
        badge           = ${badge ?? null},
        features        = ${JSON.stringify(features ?? [])}::jsonb,
        recommended     = ${!!recommended},
        is_contact_only = ${!!isContactOnly},
        sort_order      = ${Number(sortOrder ?? 0)},
        feature_flags   = ${JSON.stringify(featureFlags ?? {})}::jsonb,
        limits          = ${JSON.stringify(limits ?? {})}::jsonb,
        updated_at      = NOW()
      WHERE id = ${id}
    `);

    const updated = await db.execute(sql`SELECT * FROM plan_cms WHERE id = ${id}`) as any;
    const updatedRows = Array.isArray(updated) ? updated : (updated?.rows ?? []);
    return res.json(updatedRows[0] ? rowToPlan(updatedRows[0]) : { ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: POST /api/admin/plans  — create new plan
══════════════════════════════════════════════════════ */
router.post("/admin/plans", adminOnly, async (req, res) => {
  try {
    await ensureTable();
    const { id, nameAr, nameEn, monthlyPrice, yearlyPrice, color, description, badge, features, recommended, isContactOnly, sortOrder, featureFlags, limits } = req.body;

    if (!id || !nameAr) return res.status(400).json({ error: "id و nameAr مطلوبان" });

    /* Ensure unique ID */
    const existing = await db.execute(sql`SELECT id FROM plan_cms WHERE id = ${id}`) as any;
    const existingRows = Array.isArray(existing) ? existing : (existing?.rows ?? []);
    if (existingRows.length > 0) return res.status(409).json({ error: "المعرّف مستخدم مسبقاً" });

    const defaultFlags = { cases: true, invoices: true, reminders: true, calendar: true, exportPdf: true, reportsBasic: true, aiBasic: false, ai: false, aiAnalytics: false, aiCfo: false, customAiTraining: false, documentTemplates: false, contractsAi: false, ocr: false, backup: false, website: false, serviceStore: false, payments: false, mobileApp: false, whatsapp: false, workflow: false, reportsAdvanced: false, clientPortal: false, customDomain: false, apiAccess: false, whiteLabel: false, sla: false, dedicatedManager: false, priorityInfrastructure: false };
    const defaultLimits = { users: 1, storage: "١ GB", aiRequests: 10, branches: 0 };

    await db.execute(sql`
      INSERT INTO plan_cms (id, name_ar, name_en, monthly_price, yearly_price, color, description, badge, features, recommended, is_contact_only, sort_order, feature_flags, limits)
      VALUES (
        ${id}, ${nameAr}, ${nameEn ?? nameAr}, ${Number(monthlyPrice ?? 0)}, ${Number(yearlyPrice ?? 0)},
        ${color ?? "#64748B"}, ${description ?? null}, ${badge ?? null},
        ${JSON.stringify(features ?? [])}::jsonb,
        ${!!recommended}, ${!!isContactOnly}, ${Number(sortOrder ?? 99)},
        ${JSON.stringify(featureFlags ?? defaultFlags)}::jsonb,
        ${JSON.stringify(limits ?? defaultLimits)}::jsonb
      )
    `);

    const created = await db.execute(sql`SELECT * FROM plan_cms WHERE id = ${id}`) as any;
    const createdRows = Array.isArray(created) ? created : (created?.rows ?? []);
    return res.status(201).json(createdRows[0] ? rowToPlan(createdRows[0]) : { ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: DELETE /api/admin/plans/:id  — delete plan
══════════════════════════════════════════════════════ */
router.delete("/admin/plans/:id", adminOnly, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params as Record<string, string>;
    const builtIn = ["free", "basic", "pro", "growth", "advanced", "enterprise", "elite"];
    if (builtIn.includes(id)) return res.status(400).json({ error: "لا يمكن حذف الباقات الافتراضية" });
    await db.execute(sql`DELETE FROM plan_cms WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: POST /api/admin/plans/reset  — restore defaults
══════════════════════════════════════════════════════ */
router.post("/admin/plans/reset", adminOnly, async (_req, res) => {
  try {
    await ensureTable();
    for (const p of DEFAULT_PLANS) {
      await db.execute(sql`
        INSERT INTO plan_cms (id, name_ar, name_en, monthly_price, yearly_price, color, description, badge, features, recommended, is_contact_only, sort_order, feature_flags, limits)
        VALUES (
          ${p.id}, ${p.nameAr}, ${p.nameEn}, ${p.monthlyPrice}, ${p.yearlyPrice},
          ${p.color}, ${p.description}, ${p.badge ?? null},
          ${JSON.stringify(p.features)}::jsonb,
          ${p.recommended}, ${p.isContactOnly}, ${p.sortOrder},
          ${JSON.stringify(p.featureFlags)}::jsonb,
          ${JSON.stringify(p.limits)}::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
          monthly_price = EXCLUDED.monthly_price, yearly_price = EXCLUDED.yearly_price,
          color = EXCLUDED.color, description = EXCLUDED.description,
          badge = EXCLUDED.badge, features = EXCLUDED.features,
          recommended = EXCLUDED.recommended, is_contact_only = EXCLUDED.is_contact_only,
          sort_order = EXCLUDED.sort_order,
          feature_flags = EXCLUDED.feature_flags,
          limits = EXCLUDED.limits,
          updated_at = NOW()
      `);
    }
    const plans = await getDbPlans();
    return res.json(plans);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
