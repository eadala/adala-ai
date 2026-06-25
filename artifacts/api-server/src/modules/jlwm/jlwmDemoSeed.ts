/**
 * JLWM Demo Seed — North & South Law Firm
 * Comprehensive, idempotent seed for all JLWM modules.
 * Run from api-server/src/demo.ts or via POST /api/admin/jlwm-seed (adminOnly).
 *
 * Isolation guarantee:
 *   – North cases/clients/docs have case_number prefix "DEMO-N-"
 *   – South cases/clients/docs have case_number prefix "DEMO-S-"
 *   – jlwm_memory_nodes use node_ref prefixed "demo-n-" / "demo-s-"
 *   – All inserts use ON CONFLICT DO NOTHING where possible
 */

import { db }  from "@workspace/db";
import { sql } from "drizzle-orm";

export const NORTH_ID = "aaaabbbb-0001-0001-0001-000000000001";
export const SOUTH_ID = "bbbbcccc-0002-0002-0002-000000000002";

/* ── Helpers ─────────────────────────────────────────────────── */
type Row = Record<string, any>;

async function qOne(q: any): Promise<Row> {
  const { rows } = await db.execute(q).catch(() => ({ rows: [{}] }));
  return (rows[0] as Row) ?? {};
}
async function qAll(q: any): Promise<Row[]> {
  const { rows } = await db.execute(q).catch(() => ({ rows: [] }));
  return rows as Row[];
}

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand  = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const randF = (lo: number, hi: number) => parseFloat((lo + Math.random() * (hi - lo)).toFixed(3));
const daysAgo   = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** Format a JS string array as a PostgreSQL text-array literal: '{"a","b"}' */
const pgArr = (arr: string[]): string =>
  `{${arr.map(s => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;


/* ── Check if already seeded ────────────────────────────────── */
export async function isJLWMDemoSeeded(): Promise<{ north: boolean; south: boolean }> {
  const [n, s] = await Promise.all([
    qOne(sql`SELECT COUNT(*)::int AS cnt FROM jlwm_memory_nodes WHERE office_id=${NORTH_ID}`),
    qOne(sql`SELECT COUNT(*)::int AS cnt FROM jlwm_memory_nodes WHERE office_id=${SOUTH_ID}`),
  ]);
  return {
    north: Number(n.cnt ?? 0) >= 50,
    south: Number(s.cnt ?? 0) >= 50,
  };
}

export async function clearJLWMDemoData(): Promise<void> {
  const JLWM_TABLES = [
    "jlwm_memory_edges","jlwm_memory_nodes","jlwm_world_states","jlwm_legal_patterns",
    "jlwm_case_twins","jlwm_client_twins","jlwm_firm_twin",
    "jlwm_predictions","jlwm_recommendations","jlwm_radar_alerts","jlwm_feedback",
    "jlwm_litigation_intel","jlwm_simulations","jlwm_future_paths",
    "jlwm_accuracy_records","jlwm_trust_scores","jlwm_data_quality",
    "jlwm_ai_audit","jlwm_recommendation_tracking","jlwm_learning_events",
  ];
  for (const t of JLWM_TABLES) {
    await db.execute(sql`DELETE FROM ${sql.raw(t)} WHERE office_id IN (${NORTH_ID}, ${SOUTH_ID})`).catch(() => {});
  }
  /* Clear demo main-system records */
  await db.execute(sql`DELETE FROM cases    WHERE office_id IN (${NORTH_ID}, ${SOUTH_ID}) AND case_number LIKE 'DEMO-%'`).catch(() => {});
  await db.execute(sql`DELETE FROM clients  WHERE office_id IN (${NORTH_ID}, ${SOUTH_ID}) AND notes LIKE '%[DEMO]%'`).catch(() => {});
  await db.execute(sql`DELETE FROM documents WHERE office_id IN (${NORTH_ID}, ${SOUTH_ID})`).catch(() => {});
  await db.execute(sql`DELETE FROM revenues WHERE office_id IN (${NORTH_ID}, ${SOUTH_ID}) AND notes LIKE '%[DEMO]%'`).catch(() => {});
  await db.execute(sql`DELETE FROM expenses WHERE office_id IN (${NORTH_ID}, ${SOUTH_ID}) AND notes LIKE '%[DEMO]%'`).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   STATIC CONTENT POOLS
═══════════════════════════════════════════════════════════════ */

const COURTS = [
  "المحكمة التجارية بالرياض","المحكمة العمالية بالرياض","المحكمة المدنية بالرياض",
  "المحكمة التجارية بجدة","المحكمة العمالية بجدة","المحكمة العقارية بالرياض",
  "دائرة تنفيذ الرياض","دائرة الإفلاس التجارية","محكمة الاستئناف التجارية",
  "المحكمة الجزائية بالرياض","المحكمة الإدارية","دائرة تنفيذ جدة",
];
const CITIES = ["الرياض","جدة","الدمام","المدينة المنورة","مكة المكرمة","أبها","الطائف"];
const LAWYERS = [
  "خالد السعد","فيصل الحربي","نورة العتيبي","محمد القحطاني","سارة الزهراني",
  "عبدالله الدوسري","منى العنزي","طارق الشمري","هند المطيري","سلطان الغامدي",
  "ريم الحسن","يوسف الرشيد","دلال السبيعي","أحمد البقمي","ليلى الجهني",
];
const OPPONENTS = [
  "المقاول العام للإنشاءات","شركة الأفق للتطوير","مجموعة الفجر التجارية",
  "شركة النماء للاستثمار","مؤسسة البناء والتشييد","شركة الشرق للتجارة",
  "مجموعة الخليج الصناعية","شركة الرياض للمقاولات","مؤسسة التطوير العقاري",
  "شركة الأمل للتوريدات","مجموعة الفتح الاستثمارية","شركة الصحراء للنقل",
];
const CASE_STRENGTHS = [
  "توافر مستندات دعم قوية وموثقة","سوابق قضائية مشابهة حُسمت لصالح موكلنا",
  "اكتمال الإجراءات الشكلية والموضوعية","شهود موثوقون وأدلة ظرفية داعمة",
  "خبير قضائي معتمد يدعم موقف الموكل","الموكل التزم بجميع التزاماته التعاقدية",
  "الخصم لديه سوابق في إخلال المواعيد","عقود موثقة توثيقاً قانونياً محكماً",
];
const CASE_WEAKNESSES = [
  "بعض المستندات الداعمة تحتاج توثيقاً إضافياً","تأخر في تقديم بعض المستندات المطلوبة",
  "وجود خلاف حول تفسير بند في العقد","بعض الشهود خارج نطاق الاختصاص القضائي",
  "مضت مدة طويلة على تاريخ النزاع","الخصم يملك مستشاراً قانونياً متمرساً",
  "وجود ثغرات إجرائية يجب معالجتها","حاجة إلى تقرير خبير إضافي",
];
const RECOMMENDATIONS_POOL = [
  { title: "تسريع جمع المستندات المفقودة", cat: "action", pri: "critical", impact: "رفع دقة التنبؤ 15%" },
  { title: "إرسال خطاب إنذار للخصم قبل الجلسة", cat: "action", pri: "high", impact: "تقليل مخاطر التأجيل" },
  { title: "طلب تمديد مهلة تقديم المستندات", cat: "deadline", pri: "high", impact: "تجنب سقوط الحق" },
  { title: "مراجعة بنود التسوية المقترحة", cat: "opportunity", pri: "medium", impact: "توفير 6 أشهر" },
  { title: "الاستعانة بخبير مالي معتمد", cat: "resource", pri: "high", impact: "تعزيز المطالبة المالية" },
  { title: "إعداد مذكرة قانونية شاملة", cat: "action", pri: "medium", impact: "تحسين الموقف 20%" },
  { title: "متابعة طلب التنفيذ المقدم", cat: "action", pri: "critical", impact: "استرداد 850,000 ريال" },
  { title: "التفاوض على جدول دفع للمدين", cat: "opportunity", pri: "medium", impact: "تحسين معدل التحصيل" },
  { title: "تحديث بيانات الاتصال بالعميل", cat: "action", pri: "low", impact: "تحسين جودة البيانات" },
  { title: "مراجعة شروط عقد التوريد", cat: "risk", pri: "high", impact: "سد ثغرة قانونية" },
  { title: "رفع دعوى استئناف فورية", cat: "action", pri: "critical", impact: "استرداد الحكم المكسور" },
  { title: "مراجعة صيغة عقد الشراكة", cat: "risk", pri: "medium", impact: "حماية مصالح الموكل" },
  { title: "طلب إدراج شاهد الدفاع", cat: "action", pri: "high", impact: "دعم الحجة القانونية" },
  { title: "دراسة إمكانية تسوية ودية", cat: "opportunity", pri: "medium", impact: "توفير 12 شهراً" },
  { title: "تحصيل الفاتورة المتأخرة فوراً", cat: "action", pri: "critical", impact: "240,000 ريال معلقة" },
  { title: "مراجعة جدول الجلسات الشهرية", cat: "deadline", pri: "medium", impact: "تجنب التضارب" },
  { title: "إعداد عرض تسوية للخصم", cat: "opportunity", pri: "high", impact: "قطع مسار نزاع طويل" },
  { title: "نشر بيانات العميل على قاعدة المكتب", cat: "action", pri: "low", impact: "تحسين جودة الخدمة" },
  { title: "مراجعة عقود العمالة المنتهية", cat: "risk", pri: "high", impact: "تجنب مطالبات عمالية" },
  { title: "تدريب فريق المكتب على إجراءات الإفلاس", cat: "resource", pri: "medium", impact: "رفع كفاءة الفريق" },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN SEED FUNCTIONS
═══════════════════════════════════════════════════════════════ */

async function seedOfficeClients(officeId: string, prefix: "N" | "S"): Promise<string[]> {
  const corporateClients = [
    { name: "شركة النخيل للتجارة الدولية",    company: "النخيل",    type: "corporate", phone: "0501110001", tags: ["vip","corporate"] },
    { name: "مجموعة الأفق للاستثمار",          company: "الأفق",     type: "corporate", phone: "0501110002", tags: ["corporate","high_value"] },
    { name: "شركة الصقر للمقاولات",            company: "الصقر",     type: "corporate", phone: "0501110003", tags: ["contractor"] },
    { name: "مؤسسة البناء الحديث",             company: "البناء",    type: "corporate", phone: "0501110004", tags: ["construction"] },
    { name: "شركة الخليج للتطوير العقاري",     company: "الخليج",    type: "corporate", phone: "0501110005", tags: ["real_estate","vip"] },
    { name: "مجموعة الفجر للتجارة والصناعة",   company: "الفجر",     type: "corporate", phone: "0501110006", tags: ["corporate"] },
    { name: "شركة النماء للتكنولوجيا المالية", company: "النماء",    type: "corporate", phone: "0501110007", tags: ["fintech"] },
    { name: "الشركة العربية للتأمين",          company: "العربية",   type: "corporate", phone: "0501110008", tags: ["insurance"] },
    { name: "مؤسسة التوريد والتجهيز الوطنية",  company: "التوريد",   type: "corporate", phone: "0501110009", tags: ["supply"] },
    { name: "شركة الرقي للاستثمار العقاري",    company: "الرقي",     type: "corporate", phone: "0501110010", tags: ["real_estate"] },
    { name: "مجموعة المدار للخدمات اللوجستية", company: "المدار",    type: "corporate", phone: "0501110011", tags: ["logistics"] },
    { name: "شركة أبعاد للاستشارات الإدارية",  company: "أبعاد",     type: "corporate", phone: "0501110012", tags: ["consulting"] },
    { name: "شركة جواهر للتجزئة",              company: "جواهر",     type: "corporate", phone: "0501110013", tags: ["retail"] },
    { name: "مؤسسة الأصالة للإنتاج الغذائي",  company: "الأصالة",   type: "corporate", phone: "0501110014", tags: ["food"] },
    { name: "شركة الإبداع للبرمجة والحلول",    company: "الإبداع",   type: "corporate", phone: "0501110015", tags: ["tech"] },
  ];

  const individualClients = [
    { name: "عبدالرحمن محمد الغامدي",   type: "individual", phone: "0551110001", tags: ["loyal"] },
    { name: "سعود عبدالله القحطاني",     type: "individual", phone: "0551110002", tags: [] },
    { name: "نورة خالد العتيبي",         type: "individual", phone: "0551110003", tags: ["vip"] },
    { name: "محمد فيصل الشمري",          type: "individual", phone: "0551110004", tags: [] },
    { name: "فاطمة أحمد الزهراني",       type: "individual", phone: "0551110005", tags: ["loyal"] },
    { name: "خالد سلطان المطيري",        type: "individual", phone: "0551110006", tags: [] },
    { name: "منيرة عبدالعزيز الدوسري",  type: "individual", phone: "0551110007", tags: ["high_risk"] },
    { name: "ناصر حمد الحربي",           type: "individual", phone: "0551110008", tags: [] },
    { name: "هند محمد الجهني",           type: "individual", phone: "0551110009", tags: ["loyal","vip"] },
    { name: "عبدالله سعود السبيعي",      type: "individual", phone: "0551110010", tags: [] },
    { name: "ريم فهد العنزي",            type: "individual", phone: "0551110011", tags: [] },
    { name: "طارق نايف البقمي",          type: "individual", phone: "0551110012", tags: ["high_risk"] },
    { name: "دلال حسن الرشيد",           type: "individual", phone: "0551110013", tags: [] },
    { name: "يوسف عمر المالكي",          type: "individual", phone: "0551110014", tags: [] },
    { name: "لمياء عبدالله الحسن",       type: "individual", phone: "0551110015", tags: ["loyal"] },
  ];

  const all = prefix === "N"
    ? [...corporateClients, ...individualClients]
    : [...corporateClients.slice(0,10), ...individualClients];

  const ids: string[] = [];
  for (const c of all) {
    const row = await qOne(sql`
      INSERT INTO clients (full_name, type, email, phone, company, status, notes, tags, office_id)
      VALUES (
        ${c.name},
        ${c.type},
        ${`${c.phone.slice(-4)}@demo-${prefix.toLowerCase()}.adala.ai`},
        ${c.phone},
        ${(c as any).company ?? null},
        'active',
        ${`[DEMO] بيانات تجريبية - ${prefix === "N" ? "مكتب الشمال" : "مكتب الجنوب"}`},
        ${JSON.stringify(c.tags)}::jsonb,
        ${officeId}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    if (row.id) ids.push(String(row.id));
  }
  return ids;
}

/* ── Cases ───────────────────────────────────────────────────── */
const CASE_TEMPLATES = [
  /* Commercial */
  { title: "نزاع تجاري حول عقد توريد", type: "تجاري", court: "المحكمة التجارية بالرياض", status: "open",    value: 850000 },
  { title: "دعوى مطالبة بقيمة بضاعة مُسلَّمة", type: "تجاري", court: "المحكمة التجارية بجدة",    status: "open",    value: 420000 },
  { title: "نزاع شراكة تجارية وتوزيع أرباح", type: "تجاري",  court: "المحكمة التجارية بالرياض", status: "open",    value: 1200000 },
  { title: "دعوى الإخلال بالعقد التجاري",    type: "تجاري",  court: "محكمة الاستئناف التجارية", status: "appeal",  value: 680000 },
  { title: "نزاع توزيع أسهم الشركة",          type: "تجاري",  court: "المحكمة التجارية بالرياض", status: "closed",  value: 2100000 },
  /* Real Estate */
  { title: "نزاع ملكية عقارية في الرياض",     type: "عقاري",  court: "المحكمة العقارية بالرياض", status: "open",    value: 3500000 },
  { title: "دعوى إخلاء وحدة تجارية",         type: "عقاري",  court: "المحكمة العقارية بالرياض", status: "open",    value: 180000 },
  { title: "نزاع حول شرط فسخ عقد الإيجار",   type: "عقاري",  court: "المحكمة المدنية بالرياض",  status: "closed",  value: 240000 },
  { title: "دعوى استرداد دفعة حجز عقاري",    type: "عقاري",  court: "المحكمة التجارية بجدة",    status: "open",    value: 320000 },
  /* Labor */
  { title: "مطالبة عمالية بمكافأة نهاية خدمة", type: "عمالي", court: "المحكمة العمالية بالرياض", status: "open",    value: 85000 },
  { title: "نزاع إنهاء عقد عمل تعسفي",       type: "عمالي",  court: "المحكمة العمالية بجدة",    status: "open",    value: 120000 },
  { title: "دعوى مطالبة بأجر الساعات الإضافية", type: "عمالي",court: "المحكمة العمالية بالرياض", status: "settled", value: 45000 },
  /* Civil */
  { title: "دعوى تعويض عن ضرر مادي",         type: "مدني",   court: "المحكمة المدنية بالرياض",  status: "open",    value: 150000 },
  { title: "نزاع حول صحة عقد البيع",          type: "مدني",   court: "المحكمة المدنية بالرياض",  status: "open",    value: 95000 },
  { title: "دعوى استرداد مبالغ محجوزة",       type: "مدني",   court: "المحكمة المدنية بجدة",     status: "closed",  value: 67000 },
  /* Execution */
  { title: "تنفيذ حكم مدني بالتعويض",         type: "تنفيذ",  court: "دائرة تنفيذ الرياض",       status: "execution",value: 380000 },
  { title: "تنفيذ صك ملكية عقار",             type: "تنفيذ",  court: "دائرة تنفيذ الرياض",       status: "execution",value: 1800000 },
  { title: "تنفيذ حكم عمالي نهائي",           type: "تنفيذ",  court: "دائرة تنفيذ جدة",          status: "execution",value: 95000 },
  /* Bankruptcy */
  { title: "إجراءات إشهار إفلاس شركة مقاولات", type: "إفلاس", court: "دائرة الإفلاس التجارية",  status: "open",    value: 8500000 },
  { title: "إعادة هيكلة مالية لمؤسسة تجارية", type: "إفلاس", court: "دائرة الإفلاس التجارية",  status: "open",    value: 4200000 },
  /* Contract Disputes */
  { title: "نزاع تفسير بند في عقد الصيانة",   type: "عقود",   court: "المحكمة التجارية بالرياض", status: "open",    value: 220000 },
  { title: "دعوى فسخ عقد المقاولة",           type: "عقود",   court: "المحكمة التجارية بالرياض", status: "open",    value: 1600000 },
  { title: "نزاع ضمان عيوب عقد التوريد",      type: "عقود",   court: "المحكمة التجارية بجدة",    status: "settled", value: 310000 },
  /* Additional active cases */
  { title: "دعوى استحقاق عمولة وكالة",        type: "تجاري",  court: "المحكمة التجارية بالرياض", status: "open",    value: 175000 },
  { title: "نزاع حقوق الامتياز التجاري",      type: "تجاري",  court: "محكمة الاستئناف التجارية", status: "appeal",  value: 900000 },
  { title: "دعوى التزوير في وثيقة ملكية",     type: "جزائي",  court: "المحكمة الجزائية بالرياض", status: "open",    value: 0 },
  { title: "طعن إداري في قرار ترخيص",         type: "إداري",  court: "المحكمة الإدارية",         status: "open",    value: 0 },
  { title: "دعوى تعويض حوادث مرورية",         type: "مدني",   court: "المحكمة المدنية بالرياض",  status: "closed",  value: 55000 },
  { title: "نزاع عقد الوكالة التجارية",        type: "تجاري",  court: "المحكمة التجارية بجدة",    status: "open",    value: 430000 },
  { title: "دعوى استرداد أرض مخططة",          type: "عقاري",  court: "المحكمة العقارية بالرياض", status: "open",    value: 6800000 },
];

async function seedOfficeCases(officeId: string, prefix: "N" | "S", clientNames: string[]): Promise<string[]> {
  const caseIds: string[] = [];
  const year = new Date().getFullYear();

  const templates = prefix === "N"
    ? CASE_TEMPLATES
    : CASE_TEMPLATES.slice(0).sort(() => Math.random() - 0.5);

  for (let i = 0; i < templates.length; i++) {
    const t    = templates[i];
    const cNum = `DEMO-${prefix}-${year}-${String(i + 1).padStart(4, "0")}`;
    const clientName = pick(clientNames);
    const daysBack   = rand(10, 365);
    const hearingIn  = rand(3, 60);
    const isActive   = !["closed","settled"].includes(t.status);

    const row = await qOne(sql`
      INSERT INTO cases
        (title, description, case_type, status, client_name, office_id,
         case_number, court_name, court_city, assigned_to,
         next_hearing_date, closed_at, created_at, updated_at)
      VALUES (
        ${t.title},
        ${`قضية ${t.type} - ${t.title}. موكلنا ${clientName}. المبلغ المطالب به: ${t.value.toLocaleString()} ريال. [DEMO]`},
        ${t.type}, ${t.status}, ${clientName}, ${officeId},
        ${cNum}, ${t.court}, ${pick(CITIES)}, ${pick(LAWYERS)},
        ${isActive ? daysAhead(hearingIn) : null},
        ${!isActive ? daysAgo(rand(5, 90)) : null},
        ${daysAgo(daysBack)}, ${daysAgo(rand(1, daysBack))}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    if (row.id) caseIds.push(String(row.id));
  }

  /* Extra cases to reach 75+ total across both offices */
  const EXTRA = prefix === "N" ? 20 : 15;
  for (let i = 0; i < EXTRA; i++) {
    const types = ["تجاري","مدني","عمالي","عقاري","تنفيذ","عقود","إفلاس"];
    const statuses = ["open","open","open","closed","appeal","execution","settled"];
    const t  = pick(types);
    const st = pick(statuses);
    const cNum = `DEMO-${prefix}-EX-${year}-${String(i + 1).padStart(3, "0")}`;
    const val  = rand(30, 500) * 1000;
    const row  = await qOne(sql`
      INSERT INTO cases
        (title, description, case_type, status, client_name, office_id,
         case_number, court_name, court_city, assigned_to, next_hearing_date, created_at, updated_at)
      VALUES (
        ${`قضية ${t} تجريبية #${i + 1}`},
        ${`قضية ${t} إضافية للعرض التجريبي. المبلغ: ${val.toLocaleString()} ريال. [DEMO]`},
        ${t}, ${st}, ${pick(clientNames)}, ${officeId},
        ${cNum}, ${pick(COURTS)}, ${pick(CITIES)}, ${pick(LAWYERS)},
        ${["open","appeal"].includes(st) ? daysAhead(rand(5,90)) : null},
        ${daysAgo(rand(30,400))}, ${daysAgo(rand(1,30))}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    if (row.id) caseIds.push(String(row.id));
  }
  return caseIds;
}

/* ── Documents ───────────────────────────────────────────────── */
async function seedOfficeDocuments(officeId: string, caseIds: string[], prefix: string): Promise<void> {
  const docTypes  = ["عقد","مذكرة دفاع","حكم ابتدائي","صحيفة دعوى","تقرير خبير","وثيقة ملكية","مستند تجاري","خطاب رسمي"];
  const cats      = ["contracts","pleadings","judgments","evidence","reports","official"];
  const summaries = [
    "مستند قانوني يتضمن تفاصيل النزاع والطلبات القانونية المقدمة من الموكل.",
    "وثيقة رسمية موثقة تثبت ملكية الموكل وحقوقه التعاقدية.",
    "تقرير خبير مرفق يدعم موقف موكلنا في النزاع.",
    "صحيفة دعوى تتضمن الوقائع والطلبات القانونية المفصلة.",
    "عقد موثق يحدد التزامات الطرفين وشروط التسوية.",
  ];

  for (const caseId of caseIds) {
    const docCount = rand(5, 12);
    for (let d = 0; d < docCount; d++) {
      const docType = pick(docTypes);
      await db.execute(sql`
        INSERT INTO documents
          (case_id, file_url, file_type, file_name, ai_summary, office_id, legal_category)
        VALUES (
          ${caseId},
          ${`/demo-docs/${prefix}/${caseId}/${d}.pdf`},
          'application/pdf',
          ${`${docType}_${d + 1}.pdf`},
          ${pick(summaries)},
          ${officeId},
          ${pick(cats)}
        )
      `).catch(() => {});
    }
  }
}

/* ── Tasks ───────────────────────────────────────────────────── */
async function seedOfficeTasks(officeId: string, caseIds: string[]): Promise<void> {
  const taskTemplates = [
    { title: "تجهيز مستندات الجلسة القادمة",      status: "todo",        priority: "high" },
    { title: "مراجعة رد الخصم وتحليله",            status: "in_progress", priority: "high" },
    { title: "التواصل مع الخبير القضائي",           status: "todo",        priority: "medium" },
    { title: "إعداد مذكرة قانونية",                 status: "todo",        priority: "medium" },
    { title: "تحصيل رسوم أتعاب المرحلة الأولى",    status: "todo",        priority: "high" },
    { title: "متابعة طلب التأجيل المقدم",           status: "in_progress", priority: "medium" },
    { title: "مراجعة محضر الجلسة السابقة",          status: "completed",   priority: "low" },
    { title: "تقديم طعن استئناف",                   status: "todo",        priority: "critical" },
  ];

  for (const caseId of caseIds.slice(0, 40)) {
    const taskCount = rand(2, 4);
    for (let i = 0; i < taskCount; i++) {
      const t = pick(taskTemplates);
      await db.execute(sql`
        INSERT INTO tasks
          (office_id, title, status, priority, due_date, case_id,
           assignee_name, created_at, updated_at)
        VALUES (
          ${officeId}::uuid,
          ${t.title},
          ${t.status},
          ${t.priority},
          ${daysAhead(rand(1, 30))},
          ${caseId},
          ${pick(LAWYERS)},
          ${daysAgo(rand(1, 60))},
          NOW()
        )
      `).catch(() => {});
    }
  }
}

/* ── Events/Hearings ─────────────────────────────────────────── */
async function seedOfficeEvents(officeId: string, caseIds: string[]): Promise<void> {
  const eventTypes = ["hearing","موعد","جلسة استئناف","جلسة خبير","تسوية"];
  const locations  = ["قاعة 3","قاعة 7","القاعة الكبرى","مبنى المحكمة","القاعة الرئيسية"];

  for (const caseId of caseIds) {
    const hearingCount = rand(1, 3);
    for (let h = 0; h < hearingCount; h++) {
      const isPast   = Math.random() > 0.4;
      const startAt  = isPast ? daysAgo(rand(5, 180)) : daysAhead(rand(1, 60));
      const statusH  = isPast ? "done" : "upcoming";
      await db.execute(sql`
        INSERT INTO events
          (id, user_id, title, event_type, start_at, case_id,
           location, description, status, office_id)
        VALUES (
          gen_random_uuid()::text,
          'demo-system',
          ${pick(["جلسة مرافعة","جلسة استماع","جلسة نطق الحكم","جلسة خبير","جلسة صلح"])},
          ${pick(eventTypes)},
          ${startAt},
          ${caseId},
          ${pick(locations)},
          'جلسة قانونية مجدولة [DEMO]',
          ${statusH},
          ${officeId}
        )
      `).catch(() => {});
    }
  }
}

/* ── Revenues & Expenses ──────────────────────────────────────── */
async function seedFinancials(officeId: string, isNorth: boolean): Promise<void> {
  const monthlyTarget = isNorth ? 1_800_000 : 600_000;
  const expTarget     = isNorth ? 1_100_000 :  400_000;

  /* Generate 12 months of revenues */
  for (let m = 11; m >= 0; m--) {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - m);
    const baseDate = monthDate.toISOString().slice(0, 7);
    const variance = 0.8 + Math.random() * 0.4;

    /* 6-8 revenue entries per month */
    const revEntries = rand(6, 8);
    const perEntry = Math.round(monthlyTarget * variance / revEntries);
    for (let r = 0; r < revEntries; r++) {
      await db.execute(sql`
        INSERT INTO revenues (title, category, amount, payment_method, date, notes, office_id)
        VALUES (
          ${pick(["أتعاب محاماة","استشارة قانونية","تمثيل قضائي","رسوم تسجيل","عمولة تسوية"])},
          ${pick(["أتعاب محاماة","استشارات قانونية","تمثيل قضائي"])},
          ${perEntry + rand(-10000, 10000)},
          ${pick(["bank","transfer","cash"])},
          ${`${baseDate}-${String(rand(1,28)).padStart(2,"0")}`},
          '[DEMO] إيراد تجريبي',
          ${officeId}
        )
      `).catch(() => {});
    }

    /* 4-5 expense entries per month */
    const expEntries = rand(4, 5);
    const expPerEntry = Math.round(expTarget * variance / expEntries);
    for (let e = 0; e < expEntries; e++) {
      await db.execute(sql`
        INSERT INTO expenses (title, category, amount, payment_method, date, notes, office_id)
        VALUES (
          ${pick(["رواتب المحامين","إيجار المكتب","رسوم المحاكم","مستلزمات مكتبية","بدل سفر وانتقالات"])},
          ${pick(["رواتب","إيجار","رسوم رسمية","مصاريف تشغيلية"])},
          ${expPerEntry + rand(-5000, 5000)},
          ${pick(["bank","transfer"])},
          ${`${baseDate}-${String(rand(1,28)).padStart(2,"0")}`},
          '[DEMO] مصروف تجريبي',
          ${officeId}
        )
      `).catch(() => {});
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   JLWM TABLES
═══════════════════════════════════════════════════════════════ */

async function seedJLWMConfig(officeId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO jlwm_config (office_id, enabled, enabled_modules, ai_model)
    VALUES (${officeId}, TRUE,
      ARRAY['memory_graph','world_state','command_center','digital_twins',
            'predictions','litigation_intel','simulation','future_explorer',
            'radar','recommendations','reliability'],
      'gemini')
    ON CONFLICT (office_id) DO UPDATE
      SET enabled = TRUE, enabled_modules = EXCLUDED.enabled_modules
  `).catch(() => {});
}

/* ── Memory Graph ─────────────────────────────────────────────── */
async function seedMemoryGraph(
  officeId: string, prefix: "N" | "S",
  caseIds: string[], clientIds: string[],
): Promise<void> {
  const p = `demo-${prefix.toLowerCase()}-`;
  const nodeMap: Record<string, string> = {};

  const insertNode = async (
    type: string, ref: string, label: string,
    importance: number, props: object,
  ): Promise<string> => {
    const r = await qOne(sql`
      INSERT INTO jlwm_memory_nodes
        (office_id, node_type, node_ref, label, properties, importance_score, is_auto)
      VALUES (${officeId}, ${type}, ${ref}, ${label}, ${JSON.stringify(props)}::jsonb, ${importance}, FALSE)
      ON CONFLICT (office_id, node_type, node_ref) WHERE node_ref IS NOT NULL
      DO UPDATE SET label = EXCLUDED.label, importance_score = EXCLUDED.importance_score
      RETURNING id
    `);
    return String(r.id ?? "");
  };

  const insertEdge = async (fromId: string, toId: string, edgeType: string, weight: number): Promise<void> => {
    if (!fromId || !toId) return;
    await db.execute(sql`
      INSERT INTO jlwm_memory_edges (office_id, from_node_id, to_node_id, edge_type, weight)
      VALUES (${officeId}, ${fromId}, ${toId}, ${edgeType}, ${weight})
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  };

  /* Lawyer nodes */
  const lawyerNodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const name = LAWYERS[i];
    const id   = await insertNode("lawyer", `${p}l${i}`, name, randF(0.5, 0.95),
      { speciality: pick(["تجاري","مدني","عمالي","عقاري"]), years_exp: rand(3, 20), city: pick(CITIES) });
    if (id) { lawyerNodes.push(id); nodeMap[`${p}l${i}`] = id; }
  }

  /* Court nodes */
  const courtNodes: string[] = [];
  for (let i = 0; i < COURTS.length; i++) {
    const id = await insertNode("court", `${p}ct${i}`, COURTS[i], randF(0.5, 0.9),
      { city: pick(CITIES), type: pick(["تجاري","مدني","عمالي","عقاري"]) });
    if (id) { courtNodes.push(id); nodeMap[`${p}ct${i}`] = id; }
  }

  /* Judge nodes */
  const judgeNames = ["القاضي سعود الغريب","القاضية نورة الفريح","القاضي محمد الجريان",
    "القاضي خالد الزيد","القاضية ريم الطلحة","القاضي عبدالله المطيري","القاضي فهد الخالد"];
  const judgeNodes: string[] = [];
  for (let i = 0; i < judgeNames.length; i++) {
    const id = await insertNode("judge", `${p}j${i}`, judgeNames[i], randF(0.6, 0.9),
      { court: COURTS[i % COURTS.length], specialty: pick(["تجاري","مدني","عمالي"]) });
    if (id) { judgeNodes.push(id); nodeMap[`${p}j${i}`] = id; }
  }

  /* Opponent nodes */
  const opponentNodes: string[] = [];
  for (let i = 0; i < OPPONENTS.length; i++) {
    const id = await insertNode("opponent", `${p}op${i}`, OPPONENTS[i], randF(0.4, 0.8),
      { type: i < 6 ? "شركة" : "مؤسسة", city: pick(CITIES) });
    if (id) { opponentNodes.push(id); nodeMap[`${p}op${i}`] = id; }
  }

  /* Law/Regulation nodes */
  const laws = [
    "نظام الشركات التجارية","نظام العمل السعودي","نظام التنفيذ",
    "نظام الإفلاس","نظام المنافسة","نظام التحكيم",
  ];
  const lawNodes: string[] = [];
  for (let i = 0; i < laws.length; i++) {
    const id = await insertNode("law", `${p}law${i}`, laws[i], randF(0.5, 0.85),
      { source: "مرسوم ملكي", year: rand(2015, 2023) });
    if (id) { lawNodes.push(id); nodeMap[`${p}law${i}`] = id; }
  }

  /* Contract nodes */
  const contractNodes: string[] = [];
  for (let i = 0; i < 12; i++) {
    const val = rand(50, 2000) * 1000;
    const id  = await insertNode("contract", `${p}cn${i}`,
      `عقد ${pick(["توريد","إنشاء","تشغيل وصيانة","استشارات","وكالة","تأجير"])} #${prefix}${i + 1}`,
      randF(0.4, 0.9), { value: val, currency: "SAR", year: rand(2021, 2024) });
    if (id) { contractNodes.push(id); nodeMap[`${p}cn${i}`] = id; }
  }

  /* Case nodes (from real case IDs) */
  const caseNodes: string[] = [];
  for (let i = 0; i < Math.min(caseIds.length, 50); i++) {
    const caseId = caseIds[i];
    const id     = await insertNode("case", `${p}case${i}`,
      `قضية #${prefix}${String(i + 1).padStart(3, "0")}`,
      randF(0.5, 1.0), { case_id: caseId, type: pick(["تجاري","مدني","عمالي","عقاري"]), status: pick(["جارية","منتهية","استئناف"]) });
    if (id) { caseNodes.push(id); nodeMap[`${p}case${i}`] = id; }
  }

  /* Client nodes (from real client IDs) */
  const clientNodes: string[] = [];
  for (let i = 0; i < Math.min(clientIds.length, 30); i++) {
    const clientId = clientIds[i];
    const isCorp   = i < 15;
    const id       = await insertNode("client", `${p}cl${i}`,
      isCorp ? `شركة تجريبية #${i + 1}` : `موكل فردي #${i + 1}`,
      randF(0.4, 0.95),
      { client_id: clientId, type: isCorp ? "corporate" : "individual",
        sector: pick(["تجارة","مقاولات","عقارات","أفراد"]) });
    if (id) { clientNodes.push(id); nodeMap[`${p}cl${i}`] = id; }
  }

  /* ── Edges ─────────────────────────────────────────── */
  /* Case → Court */
  for (let i = 0; i < caseNodes.length; i++) {
    await insertEdge(caseNodes[i], pick(courtNodes), "filed_at", randF(0.7, 1.0));
  }
  /* Case → Lawyer (handled_by) */
  for (let i = 0; i < caseNodes.length; i++) {
    const l1 = pick(lawyerNodes);
    await insertEdge(l1, caseNodes[i], "handles", randF(0.8, 1.0));
    if (Math.random() > 0.6) await insertEdge(pick(lawyerNodes), caseNodes[i], "supports", randF(0.5, 0.8));
  }
  /* Case → Opponent */
  for (let i = 0; i < caseNodes.length; i++) {
    await insertEdge(pick(opponentNodes), caseNodes[i], "opposed_by", randF(0.7, 1.0));
  }
  /* Client → Case (represents) */
  for (let i = 0; i < clientNodes.length && i < caseNodes.length; i++) {
    await insertEdge(clientNodes[i], caseNodes[i % caseNodes.length], "represents", 1.0);
    if (Math.random() > 0.5 && i + 1 < caseNodes.length) {
      await insertEdge(clientNodes[i], caseNodes[i + 1], "represents", 0.9);
    }
  }
  /* Client → Contract */
  for (let i = 0; i < clientNodes.length && i < contractNodes.length; i++) {
    await insertEdge(clientNodes[i], contractNodes[i % contractNodes.length], "contracted_with", randF(0.6, 0.9));
  }
  /* Contract → Case */
  for (let i = 0; i < contractNodes.length && i < caseNodes.length; i++) {
    await insertEdge(contractNodes[i], caseNodes[i % caseNodes.length], "linked_to", randF(0.5, 0.85));
  }
  /* Judge → Court */
  for (const jn of judgeNodes) {
    await insertEdge(jn, pick(courtNodes), "presides_at", randF(0.7, 1.0));
  }
  /* Lawyer → Judge (appeared_before) */
  for (const ln of lawyerNodes) {
    for (let k = 0; k < 2; k++) {
      await insertEdge(ln, pick(judgeNodes), "appeared_before", randF(0.3, 0.7));
    }
  }
  /* Lawyer → Law (specializes_in) */
  for (const ln of lawyerNodes) {
    await insertEdge(ln, pick(lawNodes), "specializes_in", randF(0.5, 0.9));
  }
  /* Case → Law (governed_by) */
  for (const cn of caseNodes) {
    await insertEdge(cn, pick(lawNodes), "governed_by", randF(0.6, 1.0));
  }
  /* Opponent cross-links */
  for (let i = 0; i < opponentNodes.length - 1; i++) {
    if (Math.random() > 0.6) {
      await insertEdge(opponentNodes[i], opponentNodes[i + 1], "linked_to", randF(0.2, 0.5));
    }
  }
  /* Settled case cross-links */
  for (let i = 0; i < caseNodes.length - 1; i++) {
    if (Math.random() > 0.75) {
      await insertEdge(caseNodes[i], caseNodes[i + 1], "related_to", randF(0.2, 0.6));
    }
  }
}

/* ── World State ──────────────────────────────────────────────── */
async function seedWorldState(officeId: string, isNorth: boolean): Promise<void> {
  const riskLevel = isNorth ? "yellow" : "orange";
  await db.execute(sql`
    INSERT INTO jlwm_world_states
      (office_id, risk_level, state_vector, active_threats, opportunities, state_summary, triggered_by)
    VALUES (
      ${officeId}, ${riskLevel},
      ${JSON.stringify({
        cases_open: isNorth ? 42 : 35,
        cases_critical: isNorth ? 4 : 7,
        overdue_tasks: isNorth ? 6 : 11,
        unpaid_invoices: isNorth ? 8 : 15,
        revenue_momentum: isNorth ? "growing" : "stable",
        predicted_success_rate: isNorth ? 0.84 : 0.71,
        active_lawyers: isNorth ? 10 : 8,
        avg_case_age_days: isNorth ? 145 : 112,
        collection_rate: isNorth ? 0.82 : 0.68,
      })}::jsonb,
      ${JSON.stringify({ items: [
        { type: "deadline_approaching", severity: "critical", detail: "جلسة في 3 أيام لقضية إفلاس بمبلغ 8.5 مليون ريال" },
        { type: "overdue_invoice",      severity: "warning",  detail: "فاتورة متأخرة 45 يوماً بقيمة 380,000 ريال" },
        { type: "execution_risk",       severity: "warning",  detail: "طلب تنفيذ معلق يحتاج متابعة فورية" },
        { type: "missing_evidence",     severity: "warning",  detail: "ملف 3 قضايا يفتقر لتقرير الخبير" },
      ]})}::jsonb,
      ${JSON.stringify({ items: [
        { type: "settlement_opportunity", potential: "عالية", detail: "الخصم أبدى رغبة في التسوية - قضية تجارية بـ 900K" },
        { type: "new_case_potential",     potential: "متوسطة", detail: "عميل جديد يسأل عن خدمات إعادة هيكلة" },
        { type: "recovery_opportunity",   potential: "عالية",  detail: "إمكانية تحصيل 1.2 مليون من ديون قديمة" },
      ]})}::jsonb,
      ${isNorth
        ? "المكتب في وضع جيد مع ضغط متوسط. 4 قضايا تستوجب اهتماماً فورياً. فرصة تسوية واعدة في القضية التجارية الكبرى."
        : "المكتب يواجه ضغطاً أعلى من المعتاد. 7 قضايا في مرحلة حرجة. يُنصح بمراجعة أولويات الفريق."},
      'seed'
    )
  `).catch(() => {});
}

/* ── Legal Patterns ───────────────────────────────────────────── */
async function seedLegalPatterns(officeId: string, isNorth: boolean): Promise<void> {
  const patterns = [
    { type: "outcome",     name: "ترجيح الفوز في قضايا التوريد التجاري",       conf: 0.81, evidence: 28 },
    { type: "timing",      name: "متوسط مدة القضايا العمالية: 8 أشهر",          conf: 0.76, evidence: 35 },
    { type: "financial",   name: "نسبة تحصيل الأحكام المالية: 74%",             conf: 0.74, evidence: 22 },
    { type: "behavioral",  name: "العملاء الشركات يوافقون على التسوية في 60%",   conf: 0.69, evidence: 18 },
    { type: "risk",        name: "قضايا الإفلاس تمتد في المتوسط 18 شهراً",      conf: 0.88, evidence: 12 },
    { type: "outcome",     name: "استئناف الأحكام يرفع احتمال النجاح بـ 15%",   conf: 0.63, evidence: 9 },
    { type: "timing",      name: "تأجيل الجلسات الأول يطيل القضايا 45 يوماً",   conf: 0.79, evidence: 41 },
    { type: "financial",   name: "متوسط الأتعاب للقضية التجارية: 85,000 ريال",  conf: 0.84, evidence: 55 },
    { type: "risk",        name: "نقص المستندات يرفع خطر الخسارة بـ 30%",       conf: 0.87, evidence: 67 },
    { type: "behavioral",  name: "العملاء الأفراد يدفعون في الموعد بنسبة 58%",  conf: 0.72, evidence: 89 },
    { type: "outcome",     name: isNorth ? "الفوز في القضايا العقارية: 78%" : "تسوية العقود: 65%", conf: 0.78, evidence: 24 },
    { type: "timing",      name: "القضايا الجزائية تستغرق 14 شهراً في المتوسط", conf: 0.81, evidence: 11 },
  ];

  for (const p of patterns) {
    await db.execute(sql`
      INSERT INTO jlwm_legal_patterns
        (office_id, pattern_type, pattern_name, description, evidence_count, confidence_score, applies_to, is_active)
      VALUES (
        ${officeId}, ${p.type}, ${p.name},
        ${`نمط مستخلص من ${p.evidence} قضية تاريخية في المكتب. الثقة: ${Math.round(p.conf * 100)}%.`},
        ${p.evidence}, ${p.conf},
        ${JSON.stringify({ office: officeId, case_types: ["تجاري","مدني","عمالي"] })}::jsonb,
        TRUE
      )
    `).catch(() => {});
  }
}

/* ── Digital Twins ────────────────────────────────────────────── */
async function seedDigitalTwins(
  officeId: string, isNorth: boolean,
  caseIds: string[], clientIds: string[],
): Promise<void> {
  /* Case Twins */
  for (const caseId of caseIds) {
    const healthScore     = randF(35, 95);
    const complexityScore = randF(20, 90);
    const risk            = healthScore > 70 ? "low" : healthScore > 45 ? "medium" : "high";
    const outcome         = Math.random() > 0.4 ? "win" : Math.random() > 0.5 ? "settlement" : "loss";

    await db.execute(sql`
      INSERT INTO jlwm_case_twins
        (office_id, case_id, health_score, complexity_score, risk_level,
         predicted_outcome, outcome_confidence, predicted_duration_days,
         financial_exposure, key_entities, critical_dates, strengths, weaknesses, opportunities, state_data)
      VALUES (
        ${officeId}, ${caseId}, ${healthScore}, ${complexityScore}, ${risk},
        ${outcome}, ${randF(0.5, 0.95)}, ${rand(30, 540)},
        ${rand(50, 3000) * 1000},
        ${JSON.stringify([
          { type: "client", label: pick(["موكل رئيسي","عميل مميز"]) },
          { type: "court",  label: pick(COURTS) },
          { type: "lawyer", label: pick(LAWYERS) },
        ])}::jsonb,
        ${JSON.stringify([
          { event: "جلسة قادمة", date: daysAhead(rand(5, 45)) },
          { event: "موعد تقديم مذكرة", date: daysAhead(rand(2, 20)) },
        ])}::jsonb,
        ${pgArr([pick(CASE_STRENGTHS), pick(CASE_STRENGTHS)])}::text[],
        ${pgArr([pick(CASE_WEAKNESSES)])}::text[],
        ${pgArr(["فرصة تسوية ودية","إمكانية الاستناد لسابقة قضائية"])}::text[],
        ${JSON.stringify({ last_activity_days: rand(1, 30), documents_count: rand(3, 15) })}::jsonb
      )
      ON CONFLICT (office_id, case_id) DO NOTHING
    `).catch((e: any) => { if (!String(e.message).includes("conflict")) console.error("[twin]", e.message.slice(0,120)); });
  }

  /* Client Twins */
  for (const clientId of clientIds) {
    const loyaltyScore  = randF(30, 98);
    const riskScore     = randF(5, 75);
    const totalInvoiced = rand(50, 3000) * 1000;
    const paidRatio     = randF(0.55, 1.0);
    const totalPaid     = Math.round(totalInvoiced * paidRatio);
    const churn         = loyaltyScore < 40 ? "high" : loyaltyScore < 65 ? "medium" : "low";

    await db.execute(sql`
      INSERT INTO jlwm_client_twins
        (office_id, client_id, loyalty_score, risk_score, ltv_score,
         total_cases, won_cases, lost_cases, active_cases,
         total_invoiced, total_paid, payment_reliability, churn_risk,
         predicted_next_case, behavioral_patterns)
      VALUES (
        ${officeId}, ${clientId}, ${loyaltyScore}, ${riskScore},
        ${Math.round(totalPaid * 0.001)},
        ${rand(1, 12)}, ${rand(0, 8)}, ${rand(0, 3)}, ${rand(0, 4)},
        ${totalInvoiced}, ${totalPaid}, ${paidRatio}, ${churn},
        ${daysAhead(rand(30, 365))},
        ${JSON.stringify({
          avg_response_days: rand(1, 7),
          preferred_contact: pick(["هاتف","بريد إلكتروني","واتساب"]),
          case_types: [pick(["تجاري","مدني","عمالي"])],
        })}::jsonb
      )
      ON CONFLICT (office_id, client_id) DO NOTHING
    `).catch(() => {});
  }

  /* Firm Twin */
  const monthlyRev = isNorth ? 1_800_000 : 600_000;
  await db.execute(sql`
    INSERT INTO jlwm_firm_twin
      (office_id, performance_score, efficiency_score, health_score,
       monthly_revenue, revenue_trend, active_cases_count, avg_case_duration_days,
       win_rate_pct, client_satisfaction,
       top_case_types, resource_utilization, financial_health, growth_indicators,
       snapshot_date)
    VALUES (
      ${officeId},
      ${isNorth ? 84.2 : 71.5},
      ${isNorth ? 78.6 : 66.3},
      ${isNorth ? 82.0 : 69.8},
      ${monthlyRev},
      ${isNorth ? 0.12 : 0.05},
      ${isNorth ? 61 : 56},
      ${isNorth ? 145 : 112},
      ${isNorth ? 78.0 : 68.0},
      ${isNorth ? 87.0 : 74.0},
      ${JSON.stringify(isNorth
        ? [{ type: "تجاري", pct: 0.45 }, { type: "عقاري", pct: 0.28 }, { type: "مدني", pct: 0.27 }]
        : [{ type: "عمالي", pct: 0.40 }, { type: "مدني", pct: 0.35 }, { type: "تجاري", pct: 0.25 }]
      )}::jsonb,
      ${JSON.stringify({ lawyers: isNorth ? 10 : 8, utilization_pct: isNorth ? 87 : 74 })}::jsonb,
      ${JSON.stringify({
        score: isNorth ? 88 : 71,
        monthly_profit: isNorth ? 700_000 : 200_000,
        collection_rate: isNorth ? 0.82 : 0.68,
        runway_months: isNorth ? 18 : 9,
      })}::jsonb,
      ${JSON.stringify({ new_cases_mom: isNorth ? 0.12 : 0.05, revenue_mom: isNorth ? 0.08 : 0.03 })}::jsonb,
      CURRENT_DATE
    )
    ON CONFLICT (office_id, snapshot_date) DO UPDATE
      SET monthly_revenue   = EXCLUDED.monthly_revenue,
          health_score      = EXCLUDED.health_score,
          performance_score = EXCLUDED.performance_score
  `).catch(() => {});
}

/* ── Predictions ──────────────────────────────────────────────── */
async function seedPredictions(officeId: string, caseIds: string[], clientIds: string[]): Promise<void> {
  const types = ["outcome","duration","settlement","appeal","execution","churn","revenue"];

  /* Case predictions */
  for (const caseId of caseIds) {
    const numPreds = rand(3, 6);
    for (let p = 0; p < numPreds; p++) {
      const ptype = pick(types.slice(0, 5));
      const conf  = randF(0.45, 0.95);
      const pval  = ptype === "outcome"
        ? pick(["win","loss","settlement"])
        : ptype === "duration"
        ? String(rand(30, 480))
        : ptype === "settlement"
        ? String(randF(0.2, 0.85))
        : ptype === "appeal"
        ? String(randF(0.1, 0.6))
        : String(randF(0.3, 0.9));

      await db.execute(sql`
        INSERT INTO jlwm_predictions
          (office_id, subject_type, subject_id, prediction_type, predicted_value,
           confidence_score, supporting_data, model_used, expires_at)
        VALUES (
          ${officeId}, 'case', ${caseId}, ${ptype}, ${pval},
          ${conf},
          ${JSON.stringify({
            win_probability: conf * (pval === "win" ? 1 : 0.3),
            factors: [pick(CASE_STRENGTHS), pick(CASE_WEAKNESSES)],
            similar_cases: rand(3, 15),
            model_version: "v2.3",
          })}::jsonb,
          'gemini-1.5-pro',
          ${daysAhead(rand(7, 30))}
        )
      `).catch(() => {});
    }
  }

  /* Client churn predictions */
  for (const clientId of clientIds) {
    await db.execute(sql`
      INSERT INTO jlwm_predictions
        (office_id, subject_type, subject_id, prediction_type, predicted_value,
         confidence_score, supporting_data, model_used, expires_at)
      VALUES (
        ${officeId}, 'client', ${clientId}, 'churn',
        ${String(randF(0.05, 0.65))},
        ${randF(0.55, 0.92)},
        ${JSON.stringify({ payment_history_score: randF(0.5, 1.0), engagement_score: randF(0.3, 1.0) })}::jsonb,
        'gemini-1.5-flash',
        ${daysAhead(rand(14, 60))}
      )
    `).catch(() => {});
  }

  /* Revenue prediction */
  await db.execute(sql`
    INSERT INTO jlwm_predictions
      (office_id, subject_type, subject_id, prediction_type, predicted_value,
       confidence_score, supporting_data, model_used, expires_at)
    VALUES (
      ${officeId}, 'firm', ${officeId}, 'revenue',
      ${String(officeId === NORTH_ID ? 2_400_000 : 800_000)},
      0.81,
      ${JSON.stringify({
        trend: officeId === NORTH_ID ? "growing" : "stable",
        based_on_months: 6,
        confidence_interval: officeId === NORTH_ID ? [2100000, 2700000] : [650000, 950000],
      })}::jsonb,
      'gemini-1.5-pro',
      ${daysAhead(30)}
    )
  `).catch(() => {});
}

/* ── Litigation Intelligence ──────────────────────────────────── */
async function seedLitigationIntel(officeId: string, caseIds: string[]): Promise<void> {
  for (const caseId of caseIds.slice(0, Math.min(caseIds.length, 40))) {
    const overallScore = randF(0.45, 0.92);
    await db.execute(sql`
      INSERT INTO jlwm_litigation_intel
        (office_id, case_id, strengths, weaknesses, missing_evidence,
         procedural_risks, recommended_actions, overall_score, confidence, model_used)
      VALUES (
        ${officeId}, ${caseId},
        ${JSON.stringify([
          { point: pick(CASE_STRENGTHS), weight: randF(0.5, 1.0) },
          { point: pick(CASE_STRENGTHS), weight: randF(0.3, 0.8) },
        ])}::jsonb,
        ${JSON.stringify([
          { point: pick(CASE_WEAKNESSES), severity: pick(["low","medium","high"]) },
        ])}::jsonb,
        ${JSON.stringify([
          pick(["تقرير خبير مالي معتمد","شهادة شاهد إضافي","عقد أصلي موثق","صورة محضر اجتماع مجلس الإدارة"]),
        ])}::jsonb,
        ${JSON.stringify([
          { risk: pick(["تأجيل الجلسة","رفض الطلب الشكلي","إشكالية في الاختصاص"]), probability: randF(0.1, 0.4) },
        ])}::jsonb,
        ${JSON.stringify([
          pick(["تسريع تقديم المستندات الداعمة","التفاوض على تسوية جزئية","الاستعانة بخبير متخصص","طلب تمديد مدة الإثبات"]),
          pick(["إعداد مذكرة تفصيلية قبل الجلسة","مراجعة استراتيجية الإثبات"]),
        ])}::jsonb,
        ${overallScore}, ${randF(0.6, 0.93)},
        'gemini-1.5-pro'
      )
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }
}

/* ── Simulations ──────────────────────────────────────────────── */
async function seedSimulations(officeId: string, caseIds: string[]): Promise<void> {
  const scenarioTypes = ["appeal","settlement","aggressive_litigation","conservative_litigation","expert_witness"];

  for (let i = 0; i < Math.min(25, caseIds.length); i++) {
    const caseId  = caseIds[i];
    const stype   = pick(scenarioTypes);
    const winProb = randF(0.3, 0.85);

    await db.execute(sql`
      INSERT INTO jlwm_simulations
        (office_id, case_id, scenario_type, scenario_params, outcomes, recommended_outcome, model_used)
      VALUES (
        ${officeId}, ${caseId}, ${stype},
        ${JSON.stringify({
          timeline_months: rand(3, 18),
          cost_estimate: rand(20, 200) * 1000,
          team_size: rand(1, 4),
        })}::jsonb,
        ${JSON.stringify([
          { probability: winProb,        outcome: "win",        timeline_days: rand(90, 365),  cost: rand(50, 300) * 1000 },
          { probability: 1 - winProb - 0.1, outcome: "loss",   timeline_days: rand(60, 240),  cost: rand(30, 150) * 1000 },
          { probability: 0.1,            outcome: "settlement", timeline_days: rand(30, 120),  cost: rand(20, 80)  * 1000 },
        ])}::jsonb,
        ${winProb > 0.6 ? "aggressive_litigation" : "settlement"},
        'gemini-1.5-pro'
      )
    `).catch(() => {});
  }
}

/* ── Future Explorer Paths ────────────────────────────────────── */
async function seedFuturePaths(officeId: string, isNorth: boolean, caseIds: string[]): Promise<void> {
  /* Office-level path */
  await db.execute(sql`
    INSERT INTO jlwm_future_paths
      (office_id, subject_type, subject_id, optimistic, realistic, pessimistic, model_used, expires_at)
    VALUES (
      ${officeId}, 'office', ${officeId},
      ${JSON.stringify({
        probability: 0.25,
        description: isNorth
          ? "نمو سريع: إيرادات 3.2M شهرياً، فريق 20 محامياً، فتح فرع جديد"
          : "نمو قوي: إيرادات 1.2M شهرياً، توسع في القضايا التجارية",
        milestones: [
          { month: 3,  milestone: "تحصيل كامل الديون المتأخرة" },
          { month: 6,  milestone: "إضافة 15 عميل مميز جديد" },
          { month: 12, milestone: "افتتاح قسم جديد للتحكيم الدولي" },
        ],
        revenue_12m: isNorth ? 3_200_000 : 1_200_000,
      })}::jsonb,
      ${JSON.stringify({
        probability: 0.55,
        description: isNorth
          ? "نمو مستدام: إيرادات 2.4M شهرياً، الحفاظ على الفريق الحالي مع تطوير مستمر"
          : "استقرار وتحسن: إيرادات 850K شهرياً، تحسن في جودة المحفظة",
        milestones: [
          { month: 3,  milestone: "تسوية 3 قضايا كبرى" },
          { month: 6,  milestone: "رفع معدل التحصيل لـ 88%" },
          { month: 12, milestone: "توسيع قاعدة العملاء بـ 20%" },
        ],
        revenue_12m: isNorth ? 2_400_000 : 850_000,
      })}::jsonb,
      ${JSON.stringify({
        probability: 0.20,
        description: isNorth
          ? "ضغط متزايد: خسارة 2 عملاء رئيسيين، إيرادات تنخفض لـ 1.4M شهرياً"
          : "تحديات: قضايا بلا حسم، إيرادات تتراجع لـ 450K شهرياً",
        milestones: [
          { month: 3,  milestone: "خسارة قضية كبرى تؤثر على السمعة" },
          { month: 6,  milestone: "صعوبة في تحصيل 35% من الفواتير" },
          { month: 12, milestone: "الحاجة لإعادة هيكلة فريق العمل" },
        ],
        revenue_12m: isNorth ? 1_400_000 : 450_000,
      })}::jsonb,
      'gemini-1.5-pro',
      ${daysAhead(90)}
    )
  `).catch(() => {});

  /* Case-level paths (first 15 cases) */
  for (const caseId of caseIds.slice(0, 15)) {
    const winProb = randF(0.4, 0.85);
    await db.execute(sql`
      INSERT INTO jlwm_future_paths
        (office_id, subject_type, subject_id, optimistic, realistic, pessimistic, model_used, expires_at)
      VALUES (
        ${officeId}, 'case', ${caseId},
        ${JSON.stringify({ probability: winProb + 0.1, description: "فوز مبكر أو تسوية مواتية", milestones: [{ month: 2, milestone: "تسوية ودية ناجحة" }] })}::jsonb,
        ${JSON.stringify({ probability: winProb,       description: "مسار طبيعي — فوز بعد مرافعات", milestones: [{ month: 6, milestone: "حكم ابتدائي" }] })}::jsonb,
        ${JSON.stringify({ probability: 1 - winProb,   description: "خسارة أو طعن في الحكم", milestones: [{ month: 8, milestone: "استئناف ضروري" }] })}::jsonb,
        'gemini-1.5-flash',
        ${daysAhead(60)}
      )
    `).catch(() => {});
  }
}

/* ── Radar Alerts ─────────────────────────────────────────────── */
async function seedRadarAlerts(officeId: string, caseIds: string[]): Promise<void> {
  const alerts = [
    /* Critical (10) */
    { type:"deadline",   sev:"critical", title:"جلسة حاسمة خلال 72 ساعة",                body:"قضية إفلاس بمبلغ 8.5 مليون ريال — يجب استكمال الملف فوراً",             url:"/cases" },
    { type:"risk",       sev:"critical", title:"خطر إسقاط الحق بالمطالبة",              body:"مضت 89 يوماً ولم يُقدَّم طلب التنفيذ — الحد الأقصى 90 يوماً",           url:"/cases" },
    { type:"risk",       sev:"critical", title:"عميل VIP أشار إلى عدم رضاه",            body:"شركة النخيل أرسلت رسالة رسمية تطلب مراجعة عاجلة لاستراتيجية القضية",    url:"/clients" },
    { type:"deadline",   sev:"critical", title:"مهلة تقديم مذكرة الاستئناف تنتهي غداً", body:"القضية التجارية #N-0004 — الاستئناف يجب تقديمه خلال 24 ساعة",           url:"/cases" },
    { type:"anomaly",    sev:"critical", title:"تراجع غير طبيعي في التحصيل",            body:"التحصيل انخفض 32% هذا الشهر مقارنة بالشهر الماضي",                      url:"/financial-reports" },
    { type:"risk",       sev:"critical", title:"نزاع داخلي في الشركة الموكِّلة",         body:"خلاف بين مساهمي الشركة الموكِّلة قد يؤثر على التوكيل القانوني",          url:"/clients" },
    { type:"deadline",   sev:"critical", title:"موعد جلسة التسوية خلال 48 ساعة",        body:"يجب تحضير عرض التسوية والتفاوض مع الخصم قبل الجلسة",                     url:"/cases" },
    { type:"risk",       sev:"critical", title:"مشكلة في توثيق وكالة محامٍ",             body:"وكالة محامٍ في قضيتين مشتركتين غير محدَّثة منذ 6 أشهر",                 url:"/documents" },
    { type:"anomaly",    sev:"critical", title:"فاتورة كبرى متأخرة 90+ يوم",            body:"فاتورة بقيمة 380,000 ريال لم تُسدَّد منذ 92 يوماً",                       url:"/finance/collections" },
    { type:"risk",       sev:"critical", title:"طعن من الخصم يهدد حكماً نهائياً",       body:"الخصم تقدم بطعن تمييزي — القضية قد تعود للمحكمة مجدداً",                url:"/cases" },
    /* Warning (20) */
    { type:"deadline",   sev:"warning",  title:"جلسة مجدولة بعد أسبوع",               body:"قضية عمالية — تجهيز المستندات والشهود خلال الأيام السبعة القادمة",        url:"/cases" },
    { type:"risk",       sev:"warning",  title:"3 قضايا تفتقر لتقرير الخبير",          body:"الجلسات القادمة تستوجب تقارير خبراء لم تُعَدَّ بعد",                     url:"/cases" },
    { type:"deadline",   sev:"warning",  title:"تجديد عقد خدمات الاستشارة",            body:"عقد شركة الخليج ينتهي خلال 18 يوماً — التجديد لم يُبدأ",                 url:"/clients" },
    { type:"anomaly",    sev:"warning",  title:"ارتفاع عدد القضايا المعلقة",           body:"12 قضية لم تتحرك منذ 45+ يوماً — تحتاج مراجعة فورية",                   url:"/cases" },
    { type:"risk",       sev:"warning",  title:"عميل متأخر في تسديد الأتعاب",          body:"مؤسسة التوريد لديها فاتورتان غير مسددتان إجماليهما 145,000 ريال",         url:"/finance/collections" },
    { type:"opportunity",sev:"warning",  title:"فرصة تسوية لقضية تجارية",              body:"الخصم أبدى رغبة في التسوية — يُنصح بالتفاوض خلال 10 أيام",               url:"/cases" },
    { type:"risk",       sev:"warning",  title:"تغيير في تشكيل هيئة القضاء",           body:"القاضي المعيَّن للقضية تغيَّر — مراجعة ملف القضية للتكيف مع الجديد",     url:"/cases" },
    { type:"deadline",   sev:"warning",  title:"موعد رد الخصم يوم الأربعاء",           body:"يجب مراجعة رد الخصم وتحضير رد المكتب خلال 5 أيام",                       url:"/cases" },
    { type:"anomaly",    sev:"warning",  title:"انخفاض جودة بيانات 6 ملفات",           body:"Data Quality Score انخفض لـ 67% بسبب حقول فارغة",                         url:"/jlwm/reliability" },
    { type:"risk",       sev:"warning",  title:"عميل جديد ذو مخاطر مالية",             body:"تحليل الملاءة المالية يُظهر مؤشرات خطر — يُنصح بطلب دفعة مقدمة",        url:"/clients" },
    { type:"opportunity",sev:"warning",  title:"إمكانية تحصيل دين قديم",               body:"حكم قابل للتنفيذ بقيمة 420,000 ريال لم يُنفَّذ — فرصة تحصيل",            url:"/cases" },
    { type:"deadline",   sev:"warning",  title:"تجديد ترخيص المكتب",                   body:"ترخيص ممارسة المهنة ينتهي خلال 30 يوماً",                                url:"/settings" },
    { type:"risk",       sev:"warning",  title:"تعارض في جدول الجلسات",                body:"محامٍ لديه جلستان في نفس الوقت — إعادة توزيع ضرورية",                    url:"/calendar" },
    { type:"anomaly",    sev:"warning",  title:"توقف مؤقت في تحديث السجلات",           body:"4 قضايا لم تُحدَّث بياناتها منذ 30+ يوماً",                              url:"/cases" },
    { type:"risk",       sev:"warning",  title:"مخاطر تركز العملاء",                   body:"25% من الإيرادات من عميل واحد — مخاطر إذا خرج",                          url:"/analytics" },
    { type:"opportunity",sev:"warning",  title:"طلب استشارة من عميل محتمل",            body:"شركة تعمل في مجال التكنولوجيا المالية تسأل عن خدمات المكتب",              url:"/clients" },
    { type:"deadline",   sev:"warning",  title:"اجتماع مع عميل كبير هذا الأسبوع",      body:"شركة الأفق تطلب اجتماعاً لمراجعة ملف الدعوى قبل الجلسة الكبرى",          url:"/calendar" },
    { type:"risk",       sev:"warning",  title:"ضعف في مستندات قضية عقارية",           body:"ملف قضية الأرض يفتقر لعدد من الوثائق الجوهرية",                           url:"/cases" },
    { type:"anomaly",    sev:"warning",  title:"ارتفاع متوسط وقت إغلاق القضايا",       body:"متوسط مدة القضايا ارتفع من 6.2 إلى 7.8 أشهر — تحليل مطلوب",             url:"/analytics" },
    { type:"opportunity",sev:"warning",  title:"اتفاقية مشاركة قضايا مع مكتب آخر",    body:"مكتب متخصص في العقارات مهتم بتعاون — فرصة لتوسيع القاعدة",               url:"/marketplace" },
    /* Info (15) */
    { type:"prediction_shift",sev:"info",title:"تحسُّن في توقع قضية تجارية",          body:"الذكاء الاصطناعي رفع احتمال الفوز من 71% إلى 84%",                        url:"/jlwm/predictions" },
    { type:"opportunity",     sev:"info",title:"نمط جديد اكتشفه نظام JLWM",          body:"تم اكتشاف نمط جديد: العملاء الشركات يوافقون على التسوية في 62% من الحالات",url:"/jlwm" },
    { type:"prediction_shift",sev:"info",title:"تحديث توقع إيرادات الربع القادم",     body:"التوقع المحدَّث: 2.4 مليون ريال شهرياً — ثقة 81%",                        url:"/jlwm/executive-intelligence" },
    { type:"opportunity",     sev:"info",title:"اكتمال بيانات 5 قضايا جديدة",         body:"رُفعت جودة بياناتها من 45% إلى 89%",                                      url:"/jlwm/reliability" },
    { type:"anomaly",         sev:"info",title:"ارتفاع طفيف في معدل التحصيل",         body:"التحصيل ارتفع من 79% إلى 82% هذا الشهر",                                  url:"/finance/collections" },
    { type:"prediction_shift",sev:"info",title:"Trust Score ارتفع إلى 88/100",        body:"تحسن ملحوظ في دقة التنبؤات وجودة البيانات",                               url:"/jlwm/reliability" },
    { type:"opportunity",     sev:"info",title:"جاهزية لاستئناف قضية تجارية",         body:"اكتملت مستندات الاستئناف — يمكن تقديمه خلال 48 ساعة",                     url:"/cases" },
    { type:"anomaly",         sev:"info",title:"اتجاه تصاعدي في القضايا الجديدة",     body:"8 قضايا جديدة هذا الشهر مقابل 5 العام الماضي — نمو 60%",                  url:"/analytics" },
    { type:"prediction_shift",sev:"info",title:"تحسّن نتائج حلقة التعلم المستمر",    body:"تم تحديث 7 أنماط تعلمية بناءً على نتائج 12 قضية مغلقة",                   url:"/jlwm/reliability" },
    { type:"opportunity",     sev:"info",title:"عميل وفيّ يبحث عن خدمات إضافية",     body:"شركة النخيل تسأل عن إمكانية التعامل في قضايا التحكيم الدولي",             url:"/clients" },
    { type:"anomaly",         sev:"info",title:"انخفاض مؤقت في عدد الجلسات",         body:"أسبوع الجلسات القادم خفيف — فرصة لتحديث الملفات",                          url:"/calendar" },
    { type:"prediction_shift",sev:"info",title:"تعديل في توقع مدة قضية عمالية",      body:"التوقع المحدَّث: 9 أشهر بدلاً من 6 بسبب تعقيدات إضافية",                 url:"/jlwm/predictions" },
    { type:"opportunity",     sev:"info",title:"فرصة خفض تكاليف قضية عبر التحكيم",   body:"الخصم وافق مبدئياً على اللجوء للتحكيم — توفير 4 أشهر",                    url:"/arbitration" },
    { type:"anomaly",         sev:"info",title:"تحديث تلقائي لمخطط الذاكرة القانونية",body:"أُضيف 23 عقدة و47 علاقة جديدة بعد مزامنة بيانات الأسبوع",                url:"/jlwm/memory-graph" },
    { type:"prediction_shift",sev:"info",title:"Recommendation Success Rate: 79%",    body:"79% من التوصيات المطبَّقة الشهر الماضي أسفرت عن نتائج إيجابية",           url:"/jlwm/reliability" },
  ];

  for (let i = 0; i < alerts.length; i++) {
    const a = alerts[i];
    await db.execute(sql`
      INSERT INTO jlwm_radar_alerts
        (office_id, alert_type, severity, subject_type, subject_id,
         title, body, action_url, is_acknowledged)
      VALUES (
        ${officeId}, ${a.type}, ${a.sev}, 'case',
        ${i < caseIds.length ? caseIds[i % caseIds.length] : null},
        ${a.title}, ${a.body}, ${a.url},
        ${a.sev === "info" && Math.random() > 0.5}
      )
    `).catch(() => {});
  }
}

/* ── Recommendations ──────────────────────────────────────────── */
async function seedRecommendations(officeId: string, caseIds: string[]): Promise<void> {
  /* 50 recommendations per office (100 total) */
  for (let i = 0; i < 50; i++) {
    const r     = RECOMMENDATIONS_POOL[i % RECOMMENDATIONS_POOL.length];
    const extra = i > RECOMMENDATIONS_POOL.length - 1 ? ` #${Math.floor(i / RECOMMENDATIONS_POOL.length) + 1}` : "";

    await db.execute(sql`
      INSERT INTO jlwm_recommendations
        (office_id, target_type, target_id, category, priority, title, body,
         action_items, estimated_impact, expires_at)
      VALUES (
        ${officeId},
        ${pick(["case","firm","client","lawyer"])},
        ${i < caseIds.length ? caseIds[i] : officeId},
        ${r.cat}, ${r.pri},
        ${r.title + extra},
        ${`توصية من نظام JLWM بناءً على تحليل بيانات المكتب. ${r.impact}. الأولوية: ${r.pri}. [DEMO]`},
        ${JSON.stringify([
          { action: r.title, deadline: daysAhead(rand(3, 14)), owner: pick(LAWYERS) },
        ])}::jsonb,
        ${r.impact},
        ${daysAhead(rand(7, 60))}
      )
    `).catch(() => {});
  }
}

/* ── Reliability Layer ────────────────────────────────────────── */
async function seedReliabilityData(officeId: string, isNorth: boolean, caseIds: string[]): Promise<void> {
  /* Accuracy records */
  const predTypes = ["outcome","duration","settlement","appeal","revenue"];
  for (let i = 0; i < 25; i++) {
    const ptype  = pick(predTypes);
    const acc    = randF(0.65, 0.95);
    const caseId = caseIds[i % caseIds.length];
    const pVal   = ptype === "outcome" ? pick(["win","loss","settlement"]) : String(randF(0.3, 0.9).toFixed(2));
    const aVal   = ptype === "outcome" ? pick(["win","loss","settlement"]) : String(randF(0.3, 0.9).toFixed(2));

    await db.execute(sql`
      INSERT INTO jlwm_accuracy_records
        (office_id, case_id, prediction_type, predicted_value, actual_value, accuracy_score, deviation)
      VALUES (
        ${officeId}, ${caseId}, ${ptype},
        ${JSON.stringify({ value: pVal })}::jsonb,
        ${JSON.stringify({ value: aVal })}::jsonb,
        ${acc}, ${randF(0, 0.25)}
      )
    `).catch(() => {});
  }

  /* Trust score snapshot */
  await db.execute(sql`
    INSERT INTO jlwm_trust_scores
      (office_id, trust_score, prediction_accuracy, data_quality, recommendation_success,
       stability_score, audit_completeness, label, breakdown)
    VALUES (
      ${officeId},
      ${isNorth ? 88 : 74},
      ${isNorth ? 84 : 71},
      ${isNorth ? 92 : 78},
      ${isNorth ? 79 : 68},
      ${isNorth ? 85 : 72},
      ${isNorth ? 70 : 55},
      ${isNorth ? "موثوق جداً" : "موثوق"},
      ${JSON.stringify({
        accuracy_records: 25,
        recommendation_records: 50,
        audit_records: isNorth ? 35 : 22,
        accuracy_std_dev: isNorth ? 0.08 : 0.14,
      })}::jsonb
    )
  `).catch(() => {});

  /* Data quality snapshot */
  await db.execute(sql`
    INSERT INTO jlwm_data_quality
      (office_id, overall_score, cases_score, clients_score, documents_score,
       tasks_score, sessions_score, breakdown, issues)
    VALUES (
      ${officeId},
      ${isNorth ? 92 : 78},
      ${isNorth ? 94 : 80},
      ${isNorth ? 90 : 82},
      ${isNorth ? 96 : 75},
      ${isNorth ? 88 : 72},
      ${isNorth ? 91 : 79},
      ${JSON.stringify({ cases: { total: isNorth ? 50 : 40, missing_desc: isNorth ? 3 : 8 } })}::jsonb,
      ${JSON.stringify(isNorth
        ? [{ category: "tasks", severity: "low", message: "6 مهام بدون مسؤول" }]
        : [{ category: "cases", severity: "medium", message: "8 قضايا بدون وصف كافٍ" },
           { category: "tasks", severity: "high", message: "11 مهمة متأخرة عن موعدها" }]
      )}::jsonb
    )
  `).catch(() => {});

  /* AI audit trail entries */
  const queryTypes = ["case_prediction","client_analysis","revenue_forecast","litigation_intel","simulation","risk_scan"];
  const models     = ["gemini-1.5-pro","gemini-1.5-flash","gemini-1.5-pro"];
  for (let i = 0; i < (isNorth ? 40 : 25); i++) {
    const qt = pick(queryTypes);
    const m  = pick(models);
    await db.execute(sql`
      INSERT INTO jlwm_ai_audit
        (office_id, user_id, query_type, model_used, input_summary, output_summary,
         confidence, evidence_count, data_quality, duration_ms, tier)
      VALUES (
        ${officeId}, 'demo-system', ${qt}, ${m},
        ${`تحليل ${qt} للمكتب [DEMO]`},
        ${`نتيجة تحليل ${qt}: ثقة ${rand(65,95)}%`},
        ${randF(0.55, 0.95)},
        ${rand(5, 40)},
        ${randF(0.70, 0.98)},
        ${rand(800, 4500)},
        ${pick(["cheap","mid","expensive"])}
      )
    `).catch(() => {});
  }

  /* Learning events */
  for (let i = 0; i < 10; i++) {
    const ptype = pick(["تجاري","عمالي","مدني","عقاري"]);
    const predT = pick(["outcome","duration","settlement"]);
    const oldW  = randF(0.5, 0.75);
    const newW  = oldW + randF(0.02, 0.12);
    await db.execute(sql`
      INSERT INTO jlwm_learning_events
        (office_id, event_type, pattern_key, old_weight, new_weight, delta, evidence)
      VALUES (
        ${officeId}, 'accuracy_update',
        ${`${ptype}::${predT}`},
        ${oldW}, ${newW}, ${newW - oldW},
        ${JSON.stringify({ case_type: ptype, prediction_type: predT, sample_size: rand(5, 20) })}::jsonb
      )
    `).catch(() => {});
  }

  /* Recommendation tracking */
  for (let i = 0; i < 15; i++) {
    const applied  = Math.random() > 0.3;
    const improved = applied && Math.random() > 0.25;
    const reduced  = applied && Math.random() > 0.4;
    await db.execute(sql`
      INSERT INTO jlwm_recommendation_tracking
        (office_id, title, category, was_applied, outcome_improved, risk_reduced,
         success_score, notes)
      VALUES (
        ${officeId},
        ${RECOMMENDATIONS_POOL[i % RECOMMENDATIONS_POOL.length].title},
        ${RECOMMENDATIONS_POOL[i % RECOMMENDATIONS_POOL.length].cat},
        ${applied}, ${improved}, ${reduced},
        ${applied ? (improved ? randF(0.7, 1.0) : randF(0.4, 0.7)) : 0},
        ${applied ? "تم التطبيق وقياس النتيجة [DEMO]" : null}
      )
    `).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */

export async function seedNorthSouthDemoData(force = false): Promise<{
  north: { clients: number; cases: number };
  south: { clients: number; cases: number };
  skipped: boolean;
}> {
  const status = await isJLWMDemoSeeded();

  if (!force && status.north && status.south) {
    return { north: { clients: 0, cases: 0 }, south: { clients: 0, cases: 0 }, skipped: true };
  }

  /* Ensure expenses table exists */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      category text NOT NULL DEFAULT 'مصاريف تشغيلية',
      amount numeric(15,2) NOT NULL,
      payment_method text DEFAULT 'bank',
      date date NOT NULL,
      notes text,
      office_id text DEFAULT 'default',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  /* ── North Office ────────────────────────────────────────── */
  const northResult = { clients: 0, cases: 0 };
  if (force || !status.north) {
    if (force) {
      /* Clear existing JLWM data for North */
      const JLWM_T = ["jlwm_memory_edges","jlwm_memory_nodes","jlwm_world_states",
        "jlwm_legal_patterns","jlwm_case_twins","jlwm_client_twins","jlwm_firm_twin",
        "jlwm_predictions","jlwm_recommendations","jlwm_radar_alerts",
        "jlwm_litigation_intel","jlwm_simulations","jlwm_future_paths",
        "jlwm_accuracy_records","jlwm_trust_scores","jlwm_data_quality",
        "jlwm_ai_audit","jlwm_recommendation_tracking","jlwm_learning_events"];
      for (const t of JLWM_T) {
        await db.execute(sql`DELETE FROM ${sql.raw(t)} WHERE office_id = ${NORTH_ID}`).catch(() => {});
      }
    }

    const northClients = await seedOfficeClients(NORTH_ID, "N");
    const northCases   = await seedOfficeCases(NORTH_ID, "N", northClients.slice(0, 5).concat(
      ["شركة النخيل للتجارة","مجموعة الأفق للاستثمار","شركة الصقر للمقاولات",
       "شركة الخليج للتطوير","مؤسسة البناء الحديث","عبدالرحمن الغامدي","نورة العتيبي"]
    ));

    await Promise.all([
      seedOfficeDocuments(NORTH_ID, northCases, "N"),
      seedOfficeTasks(NORTH_ID, northCases),
      seedOfficeEvents(NORTH_ID, northCases),
      seedFinancials(NORTH_ID, true),
    ]);

    await seedJLWMConfig(NORTH_ID);
    await seedMemoryGraph(NORTH_ID, "N", northCases, northClients);
    await seedWorldState(NORTH_ID, true);
    await seedLegalPatterns(NORTH_ID, true);
    await seedDigitalTwins(NORTH_ID, true, northCases, northClients);
    await seedPredictions(NORTH_ID, northCases, northClients);
    await seedLitigationIntel(NORTH_ID, northCases);
    await seedSimulations(NORTH_ID, northCases);
    await seedFuturePaths(NORTH_ID, true, northCases);
    await seedRadarAlerts(NORTH_ID, northCases);
    await seedRecommendations(NORTH_ID, northCases);
    await seedReliabilityData(NORTH_ID, true, northCases);

    northResult.clients = northClients.length;
    northResult.cases   = northCases.length;
  }

  /* ── South Office ────────────────────────────────────────── */
  const southResult = { clients: 0, cases: 0 };
  if (force || !status.south) {
    if (force) {
      const JLWM_T = ["jlwm_memory_edges","jlwm_memory_nodes","jlwm_world_states",
        "jlwm_legal_patterns","jlwm_case_twins","jlwm_client_twins","jlwm_firm_twin",
        "jlwm_predictions","jlwm_recommendations","jlwm_radar_alerts",
        "jlwm_litigation_intel","jlwm_simulations","jlwm_future_paths",
        "jlwm_accuracy_records","jlwm_trust_scores","jlwm_data_quality",
        "jlwm_ai_audit","jlwm_recommendation_tracking","jlwm_learning_events"];
      for (const t of JLWM_T) {
        await db.execute(sql`DELETE FROM ${sql.raw(t)} WHERE office_id = ${SOUTH_ID}`).catch(() => {});
      }
    }

    const southClients = await seedOfficeClients(SOUTH_ID, "S");
    const southCases   = await seedOfficeCases(SOUTH_ID, "S", southClients.slice(0, 5).concat(
      ["مجموعة الفجر للتجارة","شركة النماء للتكنولوجيا","محمد القحطاني","فاطمة الزهراني","خالد المطيري"]
    ));

    await Promise.all([
      seedOfficeDocuments(SOUTH_ID, southCases, "S"),
      seedOfficeTasks(SOUTH_ID, southCases),
      seedOfficeEvents(SOUTH_ID, southCases),
      seedFinancials(SOUTH_ID, false),
    ]);

    await seedJLWMConfig(SOUTH_ID);
    await seedMemoryGraph(SOUTH_ID, "S", southCases, southClients);
    await seedWorldState(SOUTH_ID, false);
    await seedLegalPatterns(SOUTH_ID, false);
    await seedDigitalTwins(SOUTH_ID, false, southCases, southClients);
    await seedPredictions(SOUTH_ID, southCases, southClients);
    await seedLitigationIntel(SOUTH_ID, southCases);
    await seedSimulations(SOUTH_ID, southCases);
    await seedFuturePaths(SOUTH_ID, false, southCases);
    await seedRadarAlerts(SOUTH_ID, southCases);
    await seedRecommendations(SOUTH_ID, southCases);
    await seedReliabilityData(SOUTH_ID, false, southCases);

    southResult.clients = southClients.length;
    southResult.cases   = southCases.length;
  }

  return { north: northResult, south: southResult, skipped: false };
}
