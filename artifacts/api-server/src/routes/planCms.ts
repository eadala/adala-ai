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

/* ── Default plans (fallback when DB is empty) ──────────── */
export const DEFAULT_PLANS = [
  {
    id: "free", nameAr: "مجاني", nameEn: "Free",
    monthlyPrice: 0, yearlyPrice: 0, color: "#64748B",
    description: "للمحامين الجدد لاستكشاف المنصة",
    badge: null, recommended: false, isContactOnly: false, sortOrder: 0,
    features: ["٥ قضايا نشطة","مستخدم واحد","١ جيجا تخزين","٥ طلبات AI يومياً","فواتير إلكترونية","تذكيرات وتقويم","تصدير PDF","موقع فرعي من عدالة","متجر خدمات قانونية","بوابة دفع إلكترونية"],
  },
  {
    id: "basic", nameAr: "مبتدئ", nameEn: "Basic",
    monthlyPrice: 99, yearlyPrice: 79, color: "#3B82F6",
    description: "للمحامين المستقلين والمكاتب الصغيرة",
    badge: null, recommended: false, isContactOnly: false, sortOrder: 1,
    features: ["٢٠ قضية نشطة","مستخدمان","٥ جيجا تخزين","٢٠ طلب AI يومياً","موقع فرعي من عدالة","متجر خدمات قانونية","بوابة دفع إلكترونية","عقود ذكية بالذكاء الاصطناعي","قوالب مستندات قانونية","تطبيق جوال"],
  },
  {
    id: "pro", nameAr: "احترافي", nameEn: "Professional",
    monthlyPrice: 299, yearlyPrice: 239, color: "#C9A84C",
    description: "للمكاتب المتوسطة في طور النمو",
    badge: "⭐ الأكثر شعبية", recommended: true, isContactOnly: false, sortOrder: 2,
    features: ["١٠٠ قضية نشطة","٥ مستخدمين","٢٥ جيجا تخزين","١٠٠ طلب AI يومياً","كل مزايا مبتدئ +","تحليلات ذكاء اصطناعي متقدمة","OCR استخراج نصوص تلقائي","نسخ احتياطي تلقائي","تقارير متقدمة"],
  },
  {
    id: "growth", nameAr: "نمو", nameEn: "Growth",
    monthlyPrice: 599, yearlyPrice: 479, color: "#8B5CF6",
    description: "للمكاتب الكبيرة متعددة الفروع",
    badge: null, recommended: false, isContactOnly: false, sortOrder: 3,
    features: ["٥٠٠ قضية نشطة","١٥ مستخدماً","١٠٠ جيجا تخزين","٣٠٠ طلب AI يومياً","كل مزايا احترافي +","بوابة العملاء الذكية","٣ فروع","WhatsApp Business","محرك سير العمل الآلي"],
  },
  {
    id: "advanced", nameAr: "متقدم", nameEn: "Advanced",
    monthlyPrice: 999, yearlyPrice: 799, color: "#EC4899",
    description: "للمكاتب المتخصصة عالية الأداء",
    badge: "🔥 قوة المؤسسات", recommended: false, isContactOnly: false, sortOrder: 4,
    features: ["٢٠٠٠ قضية نشطة","٣٠ مستخدماً","٢٠٠ جيجا تخزين","١٠٠٠ طلب AI يومياً","كل مزايا نمو +","نطاق خاص مخصص","وصول API كامل","مساعد مالي AI (CFO)","علامة تجارية بيضاء"],
  },
  {
    id: "enterprise", nameAr: "مؤسسي", nameEn: "Enterprise",
    monthlyPrice: 2999, yearlyPrice: 2399, color: "#10B981",
    description: "للشركات الكبرى والمجموعات القانونية",
    badge: null, recommended: false, isContactOnly: false, sortOrder: 5,
    features: ["قضايا غير محدودة","١٠٠ مستخدم","١ تيرابايت تخزين","AI غير محدود","فروع غير محدودة","SLA مضمون ٢٤/٧","مدير حساب مخصص","تكاملات مخصصة","تدريب وإعداد شامل"],
  },
  {
    id: "elite", nameAr: "النخبة", nameEn: "Elite",
    monthlyPrice: 9999, yearlyPrice: 7999, color: "#F59E0B",
    description: "بنية تحتية مخصصة · AI مدرَّب خصيصاً",
    badge: "👑 القمة المطلقة", recommended: false, isContactOnly: true, sortOrder: 6,
    features: ["كل شيء غير محدود","تخزين غير محدود","AI مدرَّب خصيصاً على بياناتك","بنية تحتية مخصصة","SLA مضمون ٩٩.٩٩٪","مدير نجاح مخصص","أولوية دعم فوري ٢٤/٧","إعداد وهجرة بيانات مجانية","عقد SLA قانوني ملزم"],
  },
];

/* ── Ensure table + seed ─────────────────────────────────── */
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
  /* seed defaults if table is empty */
  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM plan_cms`) as any;
  const rows = Array.isArray(result) ? result : (result?.rows ?? []);
  const cnt  = Number(rows[0]?.cnt ?? rows[0]?.count ?? 0);
  if (cnt === 0) {
    for (const p of DEFAULT_PLANS) {
      await db.execute(sql`
        INSERT INTO plan_cms (id, name_ar, name_en, monthly_price, yearly_price, color, description, badge, features, recommended, is_contact_only, sort_order)
        VALUES (
          ${p.id}, ${p.nameAr}, ${p.nameEn}, ${p.monthlyPrice}, ${p.yearlyPrice},
          ${p.color}, ${p.description}, ${p.badge ?? null},
          ${JSON.stringify(p.features)}::jsonb,
          ${p.recommended}, ${p.isContactOnly}, ${p.sortOrder}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }
  }
}

/* ── Convert DB row → plan object ─────────────────────────── */
function rowToPlan(row: any) {
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
    features:      Array.isArray(row.features) ? row.features : [],
    recommended:   !!row.recommended,
    popular:       !!row.recommended,
    isContactOnly: !!row.is_contact_only,
    sortOrder:     Number(row.sort_order),
    isFree:        Number(row.monthly_price) === 0,
  };
}

/* ── Public: shared helper used by billing.ts ─────────────── */
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
   PUBLIC: GET /api/plans  — returns all plans from DB
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
   ADMIN: GET /api/admin/plans  — all plans for editor
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
    const { nameAr, nameEn, monthlyPrice, yearlyPrice, color, description, badge, features, recommended, isContactOnly, sortOrder } = req.body;

    await db.execute(sql`
      UPDATE plan_cms SET
        name_ar         = ${nameAr},
        name_en         = ${nameEn},
        monthly_price   = ${Number(monthlyPrice)},
        yearly_price    = ${Number(yearlyPrice)},
        color           = ${color},
        description     = ${description ?? null},
        badge           = ${badge ?? null},
        features        = ${JSON.stringify(features ?? [])}::jsonb,
        recommended     = ${!!recommended},
        is_contact_only = ${!!isContactOnly},
        sort_order      = ${Number(sortOrder ?? 0)},
        updated_at      = NOW()
      WHERE id = ${id}
    `);

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
        INSERT INTO plan_cms (id, name_ar, name_en, monthly_price, yearly_price, color, description, badge, features, recommended, is_contact_only, sort_order)
        VALUES (
          ${p.id}, ${p.nameAr}, ${p.nameEn}, ${p.monthlyPrice}, ${p.yearlyPrice},
          ${p.color}, ${p.description}, ${p.badge ?? null},
          ${JSON.stringify(p.features)}::jsonb,
          ${p.recommended}, ${p.isContactOnly}, ${p.sortOrder}
        )
        ON CONFLICT (id) DO UPDATE SET
          name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
          monthly_price = EXCLUDED.monthly_price, yearly_price = EXCLUDED.yearly_price,
          color = EXCLUDED.color, description = EXCLUDED.description,
          badge = EXCLUDED.badge, features = EXCLUDED.features,
          recommended = EXCLUDED.recommended, is_contact_only = EXCLUDED.is_contact_only,
          sort_order = EXCLUDED.sort_order, updated_at = NOW()
      `);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
