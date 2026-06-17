import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { contractsTable } from "@workspace/db/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { callAI } from "../ai/aiChat";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildSql(q: string, params: any[]) {
  if (!params.length) return sql.raw(q);
  const segs = q.split(/\$\d+/g);
  let built: any = sql.raw(segs[0]);
  for (let i = 0; i < params.length; i++) {
    built = sql`${built}${params[i]}${sql.raw(segs[i + 1] ?? "")}`;
  }
  return built;
}
async function sqlOne<T = any>(q: string, params: any[] = []): Promise<T | null> {
  const r = await db.execute(buildSql(q, params) as any);
  const rows = (r as any).rows ?? r;
  return (rows[0] as T) ?? null;
}
async function sqlAll<T = any>(q: string, params: any[] = []): Promise<T[]> {
  const r = await db.execute(buildSql(q, params) as any);
  return ((r as any).rows ?? r) as T[];
}

// ── Ensure new tables ─────────────────────────────────────────────────────────
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS contract_categories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id   TEXT,
      name        TEXT NOT NULL,
      name_en     TEXT,
      icon        TEXT DEFAULT 'FileText',
      color       TEXT DEFAULT '#6366F1',
      is_system   BOOLEAN DEFAULT true,
      sort_order  INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contract_templates (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id  UUID REFERENCES contract_categories(id) ON DELETE SET NULL,
      office_id    TEXT,
      name         TEXT NOT NULL,
      name_en      TEXT,
      description  TEXT,
      content      TEXT NOT NULL DEFAULT '',
      variables    JSONB DEFAULT '[]',
      is_system    BOOLEAN DEFAULT true,
      usage_count  INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contract_versions (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id    UUID NOT NULL,
      office_id      TEXT,
      version_number INTEGER NOT NULL DEFAULT 1,
      content        TEXT,
      note           TEXT,
      created_by     TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contract_ai_history (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id  UUID NOT NULL,
      office_id    TEXT,
      action       TEXT NOT NULL,
      prompt       TEXT,
      result       TEXT,
      model_used   TEXT,
      tokens_used  INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS template_id UUID;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS value_amount TEXT;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_method TEXT;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS lawyer_id TEXT;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
  `);
}

ensureTables().catch(console.error);

// ── Seed system categories ────────────────────────────────────────────────────
const SYSTEM_CATEGORIES = [
  { name: "المحاماة",       name_en: "Legal",         icon: "Scale",       color: "#7C3AED", sort_order: 1 },
  { name: "الشركات",        name_en: "Corporate",     icon: "Building2",   color: "#2563EB", sort_order: 2 },
  { name: "العقارات",       name_en: "Real Estate",   icon: "Home",        color: "#059669", sort_order: 3 },
  { name: "الموارد البشرية",name_en: "HR",            icon: "Users",       color: "#D97706", sort_order: 4 },
  { name: "التقنية",        name_en: "Technology",    icon: "Cpu",         color: "#0891B2", sort_order: 5 },
  { name: "التجارية",       name_en: "Commercial",    icon: "ShoppingBag", color: "#EA580C", sort_order: 6 },
  { name: "الحكومية",       name_en: "Government",    icon: "Landmark",    color: "#DC2626", sort_order: 7 },
];

const CONTRACT_TEMPLATE_CONTENT: Record<string, string> = {
  "عقد أتعاب محاماة": `بسم الله الرحمن الرحيم

عقد أتعاب محاماة

الطرف الأول: {{اسم_المكتب}} (المحامي)
الطرف الثاني: {{اسم_الموكل}} (الموكّل)

أولاً: موضوع التوكيل
يتعهد الطرف الأول بتقديم خدمات قانونية تتعلق بـ {{موضوع_القضية}}، وتمثيل الموكّل أمام الجهات المختصة.

ثانياً: الأتعاب
تبلغ أتعاب المحاماة المتفق عليها مبلغاً إجمالياً قدره {{قيمة_الأتعاب}} ({{الأتعاب_كتابة}}).

ثالثاً: طريقة السداد
يُسدَّد المبلغ على النحو الآتي: {{طريقة_السداد}}.

رابعاً: مدة التوكيل
تبدأ مدة هذا العقد من تاريخ التوقيع وتنتهي بانتهاء القضية أو بانقضاء مدة {{مدة_العقد}} أيهما أقرب.

خامساً: التزامات المحامي
- بذل أقصى جهد ممكن في الدفاع عن مصالح الموكّل.
- إطلاع الموكّل على مجريات القضية بصفة دورية.
- المحافظة على سرية المعلومات المتعلقة بالقضية.

سادساً: التزامات الموكّل
- تقديم جميع المستندات والمعلومات اللازمة للمحامي فور طلبها.
- سداد الأتعاب في مواعيدها المتفق عليها.
- عدم التواصل مع الخصم أو الجهات القضائية دون علم المحامي.

سابعاً: إنهاء العقد
يحق لأي من الطرفين إنهاء هذا العقد بإشعار كتابي مسبق لا يقل عن (15) خمسة عشر يوماً، مع الوفاء بالالتزامات المترتبة حتى تاريخ الإنهاء.

ثامناً: تسوية النزاعات
في حال نشوء أي خلاف حول تفسير أو تطبيق هذا العقد، يتم حله بالتراضي أولاً، فإن تعذّر ذلك تختص المحاكم السعودية بالفصل فيه.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}

الطرف الأول: .............................
الطرف الثاني: .............................`,

  "عقد استشارات قانونية": `بسم الله الرحمن الرحيم

عقد تقديم استشارات قانونية

الطرف الأول: {{اسم_المكتب}} (مقدم الخدمة)
الطرف الثاني: {{اسم_العميل}} (المستفيد)

أولاً: نطاق الخدمات
يلتزم الطرف الأول بتقديم استشارات قانونية متخصصة في مجال {{مجال_الاستشارة}}، تشمل الرأي القانوني الكتابي والشفهي، ومراجعة العقود، وتحليل المخاطر القانونية.

ثانياً: مقابل الخدمات
تبلغ قيمة الاستشارات {{رسوم_الاستشارة}} {{العملة}} شهرياً / {{عدد_الاستشارات}} استشارة.

ثالثاً: مدة العقد
يسري هذا العقد لمدة {{مدة_العقد}}، اعتباراً من {{تاريخ_البدء}}، ويتجدد تلقائياً ما لم يُبلَّغ بعدم التجديد قبل شهر من انتهائه.

رابعاً: السرية
يلتزم الطرف الأول بالمحافظة التامة على سرية المعلومات التي يطلع عليها في سياق تنفيذ هذا العقد.

خامساً: الاستثناءات
لا تشمل هذه الخدمات التمثيل القضائي أمام المحاكم، إلا بموجب اتفاق مستقل.

سادساً: حل النزاعات
يُختص بالفصل في النزاعات الناشئة عن هذا العقد محاكم {{مدينة_الاختصاص}}.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,

  "عقد شراكة": `بسم الله الرحمن الرحيم

عقد شراكة تجارية

الطرف الأول: {{اسم_الشريك_الأول}} (الشريك الأول)
الطرف الثاني: {{اسم_الشريك_الثاني}} (الشريك الثاني)

أولاً: اسم الشراكة ونطاقها
يتفق الطرفان على إنشاء شراكة تجارية باسم "{{اسم_الشراكة}}" لمزاولة نشاط {{نوع_النشاط}}.

ثانياً: رأس المال
يبلغ رأس مال الشراكة {{رأس_المال}} ريال سعودي، يساهم فيه:
- الطرف الأول: {{نسبة_الأول}}٪
- الطرف الثاني: {{نسبة_الثاني}}٪

ثالثاً: توزيع الأرباح والخسائر
توزَّع الأرباح والخسائر بالنسبة ذاتها المحددة في رأس المال.

رابعاً: الإدارة
يتولى إدارة الشراكة {{المدير_المفوض}}، ويكون قراره ملزماً في الأعمال الاعتيادية، فيما تستوجب الأعمال الاستثنائية موافقة الشركاء.

خامساً: الحسابات والتدقيق
تُقفَّل الحسابات في نهاية كل سنة مالية، وتوزَّع الأرباح خلال (30) يوماً من إقفالها.

سادساً: انتهاء الشراكة
تنتهي الشراكة بانقضاء مدتها {{مدة_الشراكة}}، أو بوفاة أحد الشركاء أو انسحابه، أو بقرار متفق عليه.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,

  "عقد عمل": `بسم الله الرحمن الرحيم

عقد عمل

صاحب العمل: {{اسم_الشركة}}
الموظف: {{اسم_الموظف}}

أولاً: المسمى الوظيفي
يُعيَّن الموظف في وظيفة {{المسمى_الوظيفي}}، إدارة {{الإدارة}}.

ثانياً: بدء العمل
يبدأ العمل بموجب هذا العقد في {{تاريخ_البدء}}.

ثالثاً: مدة العقد
هذا عقد {{نوع_العقد}}، وتبلغ مدته {{مدة_العقد}}.

رابعاً: الراتب والمزايا
- الراتب الأساسي: {{الراتب_الأساسي}} ريال سعودي شهرياً.
- بدل السكن: {{بدل_السكن}} ريال.
- بدل النقل: {{بدل_النقل}} ريال.
- إجمالي الراتب: {{الراتب_الإجمالي}} ريال.

خامساً: ساعات العمل
ثماني ساعات يومياً، خمسة أيام أسبوعياً.

سادساً: الإجازات
يستحق الموظف إجازة سنوية مدفوعة الأجر وفقاً لنظام العمل السعودي.

سابعاً: الإنهاء
يمكن إنهاء هذا العقد من قبل أي طرف بإشعار مسبق مدته {{مدة_الإشعار}} وفقاً لنظام العمل السعودي.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,

  "اتفاقية سرية NDA": `بسم الله الرحمن الرحيم

اتفاقية عدم الإفصاح والسرية (NDA)

الطرف الأول (المُفصِح): {{اسم_الطرف_الأول}}
الطرف الثاني (المُستقبِل): {{اسم_الطرف_الثاني}}

أولاً: تعريف المعلومات السرية
تشمل "المعلومات السرية" في إطار هذه الاتفاقية جميع المعلومات التقنية والتجارية والمالية وبيانات العملاء وخطط العمل والملكية الفكرية التي يُفصَح عنها بشكل مباشر أو غير مباشر.

ثانياً: الالتزام بالسرية
يتعهد الطرف الثاني بـ:
- عدم الإفصاح عن أي معلومات سرية لأي طرف ثالث دون إذن كتابي مسبق.
- استخدام المعلومات السرية لغرض {{الغرض_المحدد}} فقط.
- اتخاذ إجراءات حماية معقولة لصون سرية المعلومات.

ثالثاً: الاستثناءات
لا تسري الالتزامات السابقة على المعلومات التي:
- كانت في حوزة الطرف الثاني قبل الإفصاح.
- أصبحت متاحة للعموم دون إخلال من الطرف الثاني.
- صدر أمر قضائي بالإفصاح عنها.

رابعاً: مدة الاتفاقية
تسري هذه الاتفاقية لمدة {{مدة_السرية}} من تاريخ التوقيع.

خامساً: العقوبات
يحق للطرف الأول المطالبة بالتعويض الكامل عن أي أضرار ناجمة عن الإخلال بهذه الاتفاقية.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,

  "عقد إيجار": `بسم الله الرحمن الرحيم

عقد إيجار

المؤجِّر: {{اسم_المؤجر}}
المستأجِر: {{اسم_المستأجر}}

أولاً: العقار المؤجَّر
يؤجر الطرف الأول للطرف الثاني {{نوع_العقار}} الواقع في {{عنوان_العقار}}، المكوّن من {{وصف_العقار}}.

ثانياً: مدة الإيجار
تبدأ مدة الإيجار في {{تاريخ_البدء}} وتنتهي في {{تاريخ_الانتهاء}}.

ثالثاً: قيمة الإيجار
يبلغ الإيجار السنوي {{قيمة_الإيجار}} ريال سعودي، يُسدَّد {{طريقة_السداد}}.

رابعاً: التزامات المستأجر
- المحافظة على العقار وإعادته بالحالة ذاتها.
- عدم التأجير من الباطن دون إذن كتابي.
- سداد الإيجار في مواعيده.

خامساً: التزامات المؤجر
- تسليم العقار بالحالة الصالحة للاستخدام.
- صيانة الأعطال الجوهرية على نفقته.
- عدم التعرض للمستأجر في الانتفاع المشروع.

سادساً: إنهاء العقد
يمكن إنهاؤه بإشعار كتابي مسبق لا يقل عن {{مدة_الإشعار}} يوماً.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,

  "عقد SaaS": `بسم الله الرحمن الرحيم

اتفاقية خدمات البرمجيات كخدمة (SaaS)

مزود الخدمة: {{اسم_الشركة_التقنية}}
العميل: {{اسم_العميل}}

أولاً: الخدمة المقدمة
يلتزم مزود الخدمة بتوفير الوصول إلى منصة {{اسم_المنصة}}، وتشمل: {{قائمة_الميزات}}.

ثانياً: رسوم الخدمة
تبلغ رسوم الاشتراك {{قيمة_الاشتراك}} ريال {{دورية_الدفع}}، تُسدَّد مسبقاً.

ثالثاً: مستوى الخدمة (SLA)
- متاحية الخدمة: لا تقل عن {{نسبة_المتاحية}}٪ شهرياً.
- الدعم التقني: {{ساعات_الدعم}}.
- وقت الاستجابة للأعطال الحرجة: {{وقت_الاستجابة}}.

رابعاً: ملكية البيانات
تظل بيانات العميل ملكاً حصرياً له، ولمزود الخدمة معالجتها لأغراض تقديم الخدمة فقط.

خامساً: السرية والأمان
يلتزم مزود الخدمة بتطبيق معايير أمنية متوافقة مع {{معيار_الأمن}}، وعدم الإفصاح عن بيانات العميل لأي طرف ثالث.

سادساً: مدة الاتفاقية وإنهاؤها
تسري الاتفاقية لمدة {{مدة_العقد}}، وتتجدد تلقائياً ما لم يُبلَّغ بعدم التجديد قبل {{مدة_الإشعار}} أيام.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,

  "عقد توريد": `بسم الله الرحمن الرحيم

عقد توريد

المورِّد: {{اسم_المورد}}
المشتري: {{اسم_المشتري}}

أولاً: موضوع العقد
يلتزم المورد بتوريد {{وصف_البضاعة}} بالمواصفات المحددة في الملحق (أ).

ثانياً: الكميات والأسعار
- الكمية: {{الكمية}} {{وحدة_القياس}}.
- السعر الإجمالي: {{السعر_الإجمالي}} ريال سعودي شاملاً الضريبة.

ثالثاً: التسليم
- موعد التسليم: {{موعد_التسليم}}.
- مكان التسليم: {{مكان_التسليم}}.
- مسؤولية النقل: {{مسؤولية_النقل}}.

رابعاً: الجودة والضمان
يضمن المورد مطابقة البضاعة للمواصفات المتفق عليها لمدة {{مدة_الضمان}} من تاريخ التسليم.

خامساً: الغرامات
في حال التأخر عن موعد التسليم، تُستحق غرامة تأخير بنسبة {{نسبة_الغرامة}}٪ عن كل يوم تأخير.

سادساً: تسوية النزاعات
يختص بالفصل في النزاعات محاكم {{مدينة_الاختصاص}}.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,

  "عقد مقاولات": `بسم الله الرحمن الرحيم

عقد مقاولات

صاحب العمل: {{اسم_صاحب_العمل}}
المقاول: {{اسم_المقاول}}

أولاً: نطاق الأعمال
يلتزم المقاول بتنفيذ أعمال {{وصف_المشروع}} وفق المخططات والمواصفات المعتمدة.

ثانياً: قيمة العقد
تبلغ قيمة العقد الإجمالية {{قيمة_العقد}} ريال سعودي ({{القيمة_كتابة}).

ثالثاً: مدة التنفيذ
تبدأ أعمال التنفيذ في {{تاريخ_البدء}} وتنتهي في {{تاريخ_الانتهاء}}.

رابعاً: الدفعات
تُسدَّد قيمة العقد على دفعات حسب نسب الإنجاز المتفق عليها.

خامساً: غرامات التأخير
تُستحق غرامة تأخير قدرها {{نسبة_الغرامة}}٪ من قيمة العقد عن كل يوم تأخير، بحد أقصى {{الحد_الأقصى_للغرامات}}٪.

سادساً: الضمانات
يقدم المقاول ضمان حسن التنفيذ بنسبة {{نسبة_الضمان}}٪ من قيمة العقد.

حرر في {{المدينة}} بتاريخ {{تاريخ_العقد}}`,
};

const TEMPLATE_SEEDS = [
  { category: "المحاماة",       templates: ["عقد أتعاب محاماة", "عقد استشارات قانونية"] },
  { category: "الشركات",        templates: ["عقد شراكة"] },
  { category: "العقارات",       templates: ["عقد إيجار"] },
  { category: "الموارد البشرية",templates: ["عقد عمل"] },
  { category: "التقنية",        templates: ["اتفاقية سرية NDA", "عقد SaaS"] },
  { category: "التجارية",       templates: ["عقد توريد"] },
  { category: "الحكومية",       templates: ["عقد مقاولات"] },
];

async function seedSystemTemplates() {
  try {
    const existing = await sqlOne<{count: string}>("SELECT COUNT(*) as count FROM contract_categories WHERE is_system = true");
    if (existing && parseInt(existing.count) > 0) return;

    for (const cat of SYSTEM_CATEGORIES) {
      const catRow = await sqlOne<{id: string}>(
        `INSERT INTO contract_categories (name, name_en, icon, color, is_system, sort_order) VALUES ($1,$2,$3,$4,true,$5) RETURNING id`,
        [cat.name, cat.name_en, cat.icon, cat.color, cat.sort_order]
      );
      if (!catRow) continue;
      const seed = TEMPLATE_SEEDS.find(s => s.category === cat.name);
      if (!seed) continue;
      for (const tName of seed.templates) {
        const content = CONTRACT_TEMPLATE_CONTENT[tName] ?? `نموذج ${tName}`;
        await sqlOne(
          `INSERT INTO contract_templates (category_id, name, content, is_system) VALUES ($1,$2,$3,true)`,
          [catRow.id, tName, content]
        );
      }
    }
  } catch (e: any) {
    console.error("seed error:", e.message);
  }
}

// Seed after tables created
setTimeout(seedSystemTemplates, 3000);

// ── GET /contracts/stats ──────────────────────────────────────────────────────
router.get("/contracts/stats", requireAuthWithTenant, async (req, res) => {
  try {
    const tid = (req as any).tenantId;
    const rows = await sqlAll(
      `SELECT status, COUNT(*) as count FROM contracts WHERE office_id = $1 GROUP BY status`,
      [tid]
    );
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) { byStatus[r.status] = parseInt(r.count); total += parseInt(r.count); }

    const expiring = await sqlOne<{count: string}>(
      `SELECT COUNT(*) as count FROM contracts WHERE office_id = $1 AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days' AND status != 'expired'`,
      [tid]
    );
    const pendingSig = await sqlOne<{count: string}>(
      `SELECT COUNT(*) as count FROM document_signatures ds JOIN contracts c ON c.id::text = ds.document_id WHERE c.office_id = $1 AND ds.status = 'pending'`,
      [tid]
    );
    const aiGenerated = await sqlOne<{count: string}>(
      `SELECT COUNT(*) as count FROM contracts WHERE office_id = $1 AND ai_generated = true`,
      [tid]
    );
    const valueSum = await sqlOne<{sum: string}>(
      `SELECT SUM(CAST(NULLIF(REGEXP_REPLACE(value_amount, '[^0-9.]', '', 'g'), '') AS NUMERIC)) as sum FROM contracts WHERE office_id = $1`,
      [tid]
    );

    res.json({
      total,
      draft:       byStatus.draft ?? 0,
      review:      byStatus.review ?? 0,
      signed:      byStatus.signed ?? 0,
      expired:     byStatus.expired ?? 0,
      terminated:  byStatus.terminated ?? 0,
      expiringSoon: parseInt(expiring?.count ?? "0"),
      pendingSignature: parseInt(pendingSig?.count ?? "0"),
      aiGenerated: parseInt(aiGenerated?.count ?? "0"),
      totalValue:  parseFloat(valueSum?.sum ?? "0"),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contract-categories ──────────────────────────────────────────────────
router.get("/contract-categories", requireAuth, async (_req, res) => {
  try {
    const cats = await sqlAll(
      `SELECT c.*, COUNT(t.id) as template_count FROM contract_categories c
       LEFT JOIN contract_templates t ON t.category_id = c.id
       GROUP BY c.id ORDER BY c.sort_order ASC`
    );
    res.json(cats);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contract-templates ───────────────────────────────────────────────────
router.get("/contract-templates", requireAuth, async (req, res) => {
  try {
    const { category_id } = req.query as Record<string, string>;
    let q = `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
             FROM contract_templates t LEFT JOIN contract_categories c ON c.id = t.category_id`;
    const params: any[] = [];
    if (category_id) { q += ` WHERE t.category_id = $1`; params.push(category_id); }
    q += ` ORDER BY t.usage_count DESC, t.name ASC`;
    const templates = await sqlAll(q, params);
    res.json(templates);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contract-templates/:id ───────────────────────────────────────────────
router.get("/contract-templates/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const t = await sqlOne(
      `SELECT t.*, c.name as category_name FROM contract_templates t LEFT JOIN contract_categories c ON c.id = t.category_id WHERE t.id = $1`,
      [id]
    );
    if (!t) return res.status(404).json({ error: "القالب غير موجود" });
    res.json(t);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contracts ────────────────────────────────────────────────────────────
router.get("/contracts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { search, status, type } = req.query as Record<string, string>;
    let q = `SELECT c.*, cl.full_name as client_name, cs.title as case_title
             FROM contracts c
             LEFT JOIN clients cl ON cl.id::text = c.client_id::text AND cl.office_id = c.office_id
             LEFT JOIN cases cs ON cs.id::text = c.case_id::text AND cs.office_id = c.office_id
             WHERE c.office_id = $1`;
    const params: any[] = [tenantId];
    if (search) { q += ` AND (c.title ILIKE $${params.length+1} OR c.notes ILIKE $${params.length+1})`; params.push(`%${search}%`); }
    if (status && status !== "all") { q += ` AND c.status = $${params.length+1}`; params.push(status); }
    if (type && type !== "all") { q += ` AND c.type = $${params.length+1}`; params.push(type); }
    q += ` ORDER BY c.created_at DESC`;
    const contracts = await sqlAll(q, params);
    res.json(contracts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contracts/:id ────────────────────────────────────────────────────────
router.get("/contracts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const contract = await sqlOne(
      `SELECT c.*, cl.full_name as client_name, cs.title as case_title
       FROM contracts c
       LEFT JOIN clients cl ON cl.id::text = c.client_id::text
       LEFT JOIN cases cs ON cs.id::text = c.case_id::text
       WHERE c.id = $1 AND c.office_id = $2`,
      [id, tenantId]
    );
    if (!contract) return res.status(404).json({ error: "العقد غير موجود" });
    res.json(contract);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /contracts ───────────────────────────────────────────────────────────
router.post("/contracts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { title, type, parties, details, aiGenerate, notes, expiresAt, clientId, caseId, content: bodyContent, templateId, valueAmount, paymentMethod } = req.body;
    let content = bodyContent ?? "";

    if (aiGenerate && !content) {
      const prompt = `صِغ ${type ?? "عقد عام"} قانونياً احترافياً باللغة العربية الفصحى متوافقاً مع الأنظمة السعودية.
الأطراف: ${Array.isArray(parties) ? parties.join(" و") : parties ?? "الطرف الأول والطرف الثاني"}
التفاصيل: ${details ?? title}
${valueAmount ? `القيمة المالية: ${valueAmount}` : ""}
يجب أن يتضمن: ديباجة، تعريفات، موضوع العقد، الالتزامات، المقابل المالي، المدة، الإنهاء، تسوية النزاعات.`;
      try {
        const { reply } = await callAI("أنت محامٍ خبير في القانون السعودي.", prompt, [], "auto", tenantId);
        content = reply;
      } catch { content = ""; }
    }

    if (templateId) {
      await sqlOne(`UPDATE contract_templates SET usage_count = usage_count + 1 WHERE id = $1`, [templateId]);
    }

    const [contract] = await db.insert(contractsTable).values({
      title, type: type ?? "general",
      parties: Array.isArray(parties) ? parties : (parties ? String(parties).split(/[،,]/).map((s: string) => s.trim()) : []),
      content, aiGenerated: !!aiGenerate, notes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      clientId: clientId ?? undefined,
      caseId: caseId ?? undefined,
      officeId: tenantId,
    } as any).returning();

    if (templateId || valueAmount || paymentMethod) {
      await sqlOne(
        `UPDATE contracts SET template_id = $1, value_amount = $2, payment_method = $3 WHERE id = $4`,
        [templateId ?? null, valueAmount ?? null, paymentMethod ?? null, (contract as any).id]
      );
    }

    res.json(contract);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /contracts/:id ──────────────────────────────────────────────────────
router.patch("/contracts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const { content, title, status, notes, expiresAt, clientId, caseId, valueAmount, paymentMethod, isLocked } = req.body;

    const current = await sqlOne(`SELECT * FROM contracts WHERE id = $1 AND office_id = $2`, [id, tenantId]);
    if (!current) return res.status(404).json({ error: "العقد غير موجود" });
    if (current.is_locked && status !== "draft") return res.status(403).json({ error: "العقد مقفل" });

    const fields: string[] = [];
    const vals: any[] = [];
    const add = (col: string, val: any) => { fields.push(`${col} = $${vals.length + 1}`); vals.push(val); };

    if (content !== undefined) add("content", content);
    if (title !== undefined) add("title", title);
    if (status !== undefined) add("status", status);
    if (notes !== undefined) add("notes", notes);
    if (expiresAt !== undefined) add("expires_at", expiresAt ? new Date(expiresAt) : null);
    if (clientId !== undefined) add("client_id", clientId);
    if (caseId !== undefined) add("case_id", caseId);
    if (valueAmount !== undefined) add("value_amount", valueAmount);
    if (paymentMethod !== undefined) add("payment_method", paymentMethod);
    if (isLocked !== undefined) add("is_locked", isLocked);
    add("updated_at", new Date());

    if (content && current.content !== content) {
      const vn = (current.version_number ?? 1) + 1;
      await sqlOne(
        `INSERT INTO contract_versions (contract_id, office_id, version_number, content, note) VALUES ($1,$2,$3,$4,$5)`,
        [id, tenantId, vn, current.content, "حفظ تلقائي"]
      );
      add("version_number", vn);
    }

    vals.push(id, tenantId);
    const updated = await sqlOne(
      `UPDATE contracts SET ${fields.join(", ")} WHERE id = $${vals.length - 1} AND office_id = $${vals.length} RETURNING *`,
      vals
    );
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /contracts/:id ─────────────────────────────────────────────────────
router.delete("/contracts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    await sqlOne(`DELETE FROM contracts WHERE id = $1 AND office_id = $2`, [id, tenantId]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contracts/:id/versions ───────────────────────────────────────────────
router.get("/contracts/:id/versions", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const versions = await sqlAll(
      `SELECT id, version_number, note, created_by, created_at FROM contract_versions WHERE contract_id = $1 AND office_id = $2 ORDER BY version_number DESC`,
      [id, tenantId]
    );
    res.json(versions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contracts/:id/versions/:vid ─────────────────────────────────────────
router.get("/contracts/:id/versions/:vid", requireAuthWithTenant, async (req, res) => {
  try {
    const { vid } = req.params as Record<string, string>;
    const v = await sqlOne(`SELECT * FROM contract_versions WHERE id = $1`, [vid]);
    if (!v) return res.status(404).json({ error: "الإصدار غير موجود" });
    res.json(v);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /contracts/:id/ai-action ─────────────────────────────────────────────
router.post("/contracts/:id/ai-action", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const { action, selection } = req.body;

    const contract = await sqlOne(`SELECT * FROM contracts WHERE id = $1 AND office_id = $2`, [id, tenantId]);
    if (!contract) return res.status(404).json({ error: "العقد غير موجود" });

    const targetText = selection || contract.content?.substring(0, 4000) || "";

    const ACTION_PROMPTS: Record<string, string> = {
      improve:       `حسّن صياغة النص القانوني التالي بلغة عربية فصحى احترافية مع الحفاظ على المعنى:\n\n${targetText}`,
      add_arbitration: `أضف بنداً قانونياً متكاملاً للتحكيم مناسباً للعقد السعودي. أرجع البند فقط بدون أي شرح.`,
      add_confidentiality: `أضف بنداً للسرية وعدم الإفصاح مناسباً للعقد السعودي. أرجع البند فقط.`,
      add_non_compete: `أضف بنداً لعدم المنافسة مناسباً للقانون السعودي. أرجع البند فقط.`,
      risk_analysis: `حلّل المخاطر القانونية في العقد التالي وقدّم تقريراً منظماً يشمل: المخاطر، نقاط القوة، التوصيات، ودرجة المخاطرة من 10:\n\n${targetText}`,
      summarize:     `لخّص العقد التالي في نقاط رئيسية لا تتجاوز 10 نقاط:\n\n${targetText}`,
      missing_clauses: `اكشف البنود الناقصة في العقد التالي بناءً على أفضل الممارسات القانونية السعودية:\n\n${targetText}`,
      add_jurisdiction: `أضف بنداً لتحديد الاختصاص القضائي والقانون الواجب التطبيق مناسباً للعقد السعودي. أرجع البند فقط.`,
    };

    const prompt = ACTION_PROMPTS[action] ?? `${action}:\n\n${targetText}`;
    const { reply, modelUsed } = await callAI(
      "أنت محامٍ خبير في القانون السعودي والعقود التجارية. أجب بالعربية الفصحى.",
      prompt, [], "auto", tenantId
    );

    await sqlOne(
      `INSERT INTO contract_ai_history (contract_id, office_id, action, result, model_used) VALUES ($1,$2,$3,$4,$5)`,
      [id, tenantId, action, reply, modelUsed]
    );

    res.json({ result: reply, action, modelUsed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /contracts/:id/analyze ───────────────────────────────────────────────
router.post("/contracts/:id/analyze", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const contract = await sqlOne(`SELECT * FROM contracts WHERE id = $1 AND office_id = $2`, [id, tenantId]);
    if (!contract) return res.status(404).json({ error: "العقد غير موجود" });

    const prompt = `حلل العقد التالي واستخرج:
1. المخاطر القانونية الرئيسية (قائمة)
2. نقاط القوة (قائمة)
3. التوصيات للتحسين (قائمة)
4. البنود الناقصة (قائمة)
5. درجة المخاطرة من 1-10 (رقم فقط في السطر الأخير بصيغة: درجة المخاطرة: X)

العقد:\n${contract.content?.substring(0, 3000)}

أجب بتنسيق منظم بالعربية.`;

    const { reply } = await callAI(
      "أنت محامٍ خبير في القانون السعودي.", prompt, [], "auto", tenantId
    );

    const riskMatch = reply.match(/درجة المخاطرة:\s*(\d+)/);
    const riskScore = riskMatch?.[1] ?? "5";
    await sqlOne(`UPDATE contracts SET risk_score = $1, updated_at = NOW() WHERE id = $2`, [riskScore, id]);

    res.json({ analysis: reply, riskScore });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /contracts/generate-from-prompt ──────────────────────────────────────
router.post("/contracts/generate-from-prompt", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { prompt: userPrompt } = req.body;
    if (!userPrompt) return res.status(400).json({ error: "يرجى توفير وصف العقد" });

    const sysPrompt = `أنت محامٍ خبير في القانون السعودي. المستخدم يصف عقداً يريد إنشاءه. قم بـ:
1. تحديد نوع العقد
2. استخراج بيانات الأطراف والتفاصيل المهمة
3. صياغة عقد قانوني كامل احترافي

أرجع رداً بالتنسيق التالي:
---TITLE---
[عنوان العقد]
---TYPE---
[نوع العقد بالإنجليزية: general/employment/partnership/lease/service/nda/investment/construction]
---PARTIES---
[الطرف الأول]
[الطرف الثاني]
---CONTENT---
[نص العقد الكامل]`;

    const { reply } = await callAI(sysPrompt, userPrompt, [], "auto", tenantId);

    const titleMatch = reply.match(/---TITLE---\s*([\s\S]*?)(?=---TYPE---|---PARTIES---|---CONTENT---|$)/);
    const typeMatch  = reply.match(/---TYPE---\s*([\s\S]*?)(?=---TITLE---|---PARTIES---|---CONTENT---|$)/);
    const partiesMatch = reply.match(/---PARTIES---\s*([\s\S]*?)(?=---TITLE---|---TYPE---|---CONTENT---|$)/);
    const contentMatch = reply.match(/---CONTENT---\s*([\s\S]*)/);

    res.json({
      title:   titleMatch?.[1]?.trim() ?? "عقد جديد",
      type:    typeMatch?.[1]?.trim() ?? "general",
      parties: partiesMatch?.[1]?.trim().split("\n").filter(Boolean) ?? [],
      content: contentMatch?.[1]?.trim() ?? reply,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /contracts/:id/ai-history ─────────────────────────────────────────────
router.get("/contracts/:id/ai-history", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const history = await sqlAll(
      `SELECT * FROM contract_ai_history WHERE contract_id = $1 AND office_id = $2 ORDER BY created_at DESC LIMIT 20`,
      [id, tenantId]
    );
    res.json(history);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /contracts/:id/signature-request ─────────────────────────────────────
router.post("/contracts/:id/signature-request", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params as Record<string, string>;
    const { signerName, signerEmail, notes: sigNotes } = req.body;

    const contract = await sqlOne(`SELECT * FROM contracts WHERE id = $1 AND office_id = $2`, [id, tenantId]);
    if (!contract) return res.status(404).json({ error: "العقد غير موجود" });

    const token = `ctr_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    await sqlOne(
      `INSERT INTO document_signatures (document_id, document_title, document_content, signer_name, signer_email, sign_token, status, requested_by, notes, office_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)`,
      [id, contract.title, contract.content, signerName, signerEmail, token, (req as any).auth?.userId ?? "system", sigNotes ?? null, tenantId]
    );
    await sqlOne(`UPDATE contracts SET status = 'review', updated_at = NOW() WHERE id = $1`, [id]);

    res.json({ success: true, token, signUrl: `/sign/${token}` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
