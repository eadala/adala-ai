import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(['"])[^'"]*\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function parseFields(fields: any): any[] {
  if (Array.isArray(fields)) return fields;
  if (typeof fields === "string") {
    try { return JSON.parse(fields); } catch { return []; }
  }
  return [];
}

function requireAuth(req: any, res: any): boolean {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return false; }
  return true;
}

async function sqlOne(q: any) {
  try {
    const r = await db.execute(q) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    return rows[0] ?? null;
  } catch { return null; }
}
async function sqlAll(q: any) {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_templates (
      id           SERIAL PRIMARY KEY,
      office_id    TEXT NOT NULL DEFAULT 'default',
      name         TEXT NOT NULL,
      type         TEXT NOT NULL DEFAULT 'other',
      category     TEXT NOT NULL DEFAULT 'contracts',
      description  TEXT,
      body         TEXT NOT NULL,
      fields       JSONB NOT NULL DEFAULT '[]',
      is_default   BOOLEAN NOT NULL DEFAULT FALSE,
      is_custom    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS generated_documents (
      id             SERIAL PRIMARY KEY,
      office_id      TEXT NOT NULL DEFAULT 'default',
      template_id    INTEGER REFERENCES document_templates(id) ON DELETE SET NULL,
      name           TEXT NOT NULL,
      template_name  TEXT,
      case_id        TEXT,
      client_id      TEXT,
      filled_data    JSONB NOT NULL DEFAULT '{}',
      generated_html TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await sqlOne(sql`SELECT id FROM document_templates WHERE is_default = TRUE LIMIT 1`);
  if (!existing) {
    await seedDefaultTemplates();
  }
}

async function seedDefaultTemplates() {
  const templates = [
    {
      name: "عقد توكيل",
      type: "power_of_attorney",
      category: "contracts",
      description: "عقد توكيل رسمي لتمثيل الموكّل أمام الجهات القضائية والإدارية",
      fields: JSON.stringify([
        { key: "attorney_name", label: "اسم المحامي", type: "text", required: true },
        { key: "attorney_id", label: "رقم هوية المحامي", type: "text", required: true },
        { key: "license_number", label: "رقم الترخيص", type: "text", required: true },
        { key: "client_name", label: "اسم الموكّل", type: "text", required: true },
        { key: "client_id", label: "رقم هوية الموكّل", type: "text", required: true },
        { key: "case_description", label: "موضوع التوكيل", type: "textarea", required: true },
        { key: "court_name", label: "اسم المحكمة", type: "text", required: false },
        { key: "city", label: "المدينة", type: "text", required: true },
        { key: "date", label: "تاريخ العقد", type: "date", required: true },
      ]),
      body: `<div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 40px; line-height: 2; font-size: 14px;">
  <h1 style="text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px;">عقد توكيل</h1>
  
  <p>إنه في يوم {{date}} بمدينة {{city}}،</p>
  
  <p><strong>أولاً: الموكِّل</strong><br/>
  السيد/ {{client_name}}، حامل بطاقة الهوية الوطنية رقم {{client_id}}، (يُشار إليه فيما يلي بـ "الموكِّل").</p>
  
  <p><strong>ثانياً: الوكيل</strong><br/>
  المحامي/ {{attorney_name}}، حامل بطاقة الهوية الوطنية رقم {{attorney_id}}، المرخّص له بمزاولة مهنة المحاماة بموجب الترخيص رقم {{license_number}}، (يُشار إليه فيما يلي بـ "الوكيل").</p>
  
  <p><strong>موضوع التوكيل:</strong><br/>
  يوكّل الموكِّل بموجب هذا العقد وكيله المذكور أعلاه في: {{case_description}}</p>
  
  <p><strong>صلاحيات الوكيل:</strong><br/>
  يحق للوكيل بموجب هذا التوكيل تمثيل الموكِّل أمام {{court_name}} وسائر الجهات القضائية والإدارية ذات الصلة، والقيام بجميع الإجراءات القانونية اللازمة.</p>
  
  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div style="text-align: center;">
      <p>توقيع الموكِّل</p>
      <p>{{client_name}}</p>
      <div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
    </div>
    <div style="text-align: center;">
      <p>توقيع الوكيل</p>
      <p>{{attorney_name}}</p>
      <div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
    </div>
  </div>
</div>`,
    },
    {
      name: "عقد إيجار",
      type: "lease_agreement",
      category: "contracts",
      description: "عقد إيجار عقار سكني أو تجاري وفق أحكام نظام الإيجار السعودي",
      fields: JSON.stringify([
        { key: "landlord_name", label: "اسم المؤجِّر", type: "text", required: true },
        { key: "landlord_id", label: "رقم هوية المؤجِّر", type: "text", required: true },
        { key: "tenant_name", label: "اسم المستأجِر", type: "text", required: true },
        { key: "tenant_id", label: "رقم هوية المستأجِر", type: "text", required: true },
        { key: "property_address", label: "عنوان العقار", type: "text", required: true },
        { key: "property_type", label: "نوع العقار", type: "text", required: true },
        { key: "monthly_rent", label: "الإيجار الشهري (ريال)", type: "number", required: true },
        { key: "lease_start", label: "تاريخ بداية الإيجار", type: "date", required: true },
        { key: "lease_end", label: "تاريخ انتهاء الإيجار", type: "date", required: true },
        { key: "security_deposit", label: "مبلغ التأمين (ريال)", type: "number", required: false },
        { key: "city", label: "المدينة", type: "text", required: true },
        { key: "date", label: "تاريخ إبرام العقد", type: "date", required: true },
      ]),
      body: `<div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 40px; line-height: 2; font-size: 14px;">
  <h1 style="text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px;">عقد إيجار</h1>
  
  <p>إنه في تاريخ {{date}} بمدينة {{city}}، تم الاتفاق بين كل من:</p>
  
  <p><strong>الطرف الأول (المؤجِّر):</strong><br/>
  السيد/ {{landlord_name}}، حامل بطاقة الهوية الوطنية رقم {{landlord_id}}.</p>
  
  <p><strong>الطرف الثاني (المستأجِر):</strong><br/>
  السيد/ {{tenant_name}}، حامل بطاقة الهوية الوطنية رقم {{tenant_id}}.</p>
  
  <p><strong>المادة الأولى: محل العقد</strong><br/>
  أجّر الطرف الأول للطرف الثاني {{property_type}} الكائن في {{property_address}}.</p>
  
  <p><strong>المادة الثانية: مدة الإيجار</strong><br/>
  تبدأ مدة الإيجار من {{lease_start}} وتنتهي في {{lease_end}}، وهي مدة غير قابلة للتجديد التلقائي إلا بموافقة خطية من الطرفين.</p>
  
  <p><strong>المادة الثالثة: بدل الإيجار</strong><br/>
  يبلغ الإيجار الشهري {{monthly_rent}} ريال سعودي، يُسدَّد في مطلع كل شهر ميلادي.</p>
  
  <p><strong>المادة الرابعة: مبلغ التأمين</strong><br/>
  دفع المستأجِر مبلغ تأمين قدره {{security_deposit}} ريال سعودي، يُعاد إليه عند انتهاء العقد بعد التثبت من سلامة العقار.</p>
  
  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div style="text-align: center;">
      <p>توقيع المؤجِّر</p>
      <p>{{landlord_name}}</p>
      <div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
    </div>
    <div style="text-align: center;">
      <p>توقيع المستأجِر</p>
      <p>{{tenant_name}}</p>
      <div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
    </div>
  </div>
</div>`,
    },
    {
      name: "اتفاقية سرية وعدم إفصاح",
      type: "nda",
      category: "contracts",
      description: "اتفاقية لحماية المعلومات السرية والملكية الفكرية بين طرفين",
      fields: JSON.stringify([
        { key: "party_a", label: "الطرف الأول (اسم الشخص/الجهة)", type: "text", required: true },
        { key: "party_a_id", label: "رقم الهوية/السجل التجاري", type: "text", required: true },
        { key: "party_b", label: "الطرف الثاني (اسم الشخص/الجهة)", type: "text", required: true },
        { key: "party_b_id", label: "رقم الهوية/السجل التجاري", type: "text", required: true },
        { key: "confidential_info", label: "وصف المعلومات السرية", type: "textarea", required: true },
        { key: "purpose", label: "الغرض من الإفصاح", type: "text", required: true },
        { key: "duration_years", label: "مدة السرية (سنوات)", type: "number", required: true },
        { key: "city", label: "المدينة", type: "text", required: true },
        { key: "date", label: "تاريخ الاتفاقية", type: "date", required: true },
      ]),
      body: `<div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 40px; line-height: 2; font-size: 14px;">
  <h1 style="text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px;">اتفاقية سرية وعدم إفصاح (NDA)</h1>
  
  <p>إنه في تاريخ {{date}} بمدينة {{city}}، أُبرمت هذه الاتفاقية بين:</p>
  
  <p><strong>الطرف الأول:</strong> {{party_a}}، رقم الهوية/السجل التجاري: {{party_a_id}}</p>
  <p><strong>الطرف الثاني:</strong> {{party_b}}، رقم الهوية/السجل التجاري: {{party_b_id}}</p>
  
  <p><strong>المادة الأولى: المعلومات السرية</strong><br/>
  تشمل المعلومات السرية الخاضعة لهذه الاتفاقية: {{confidential_info}}</p>
  
  <p><strong>المادة الثانية: الغرض</strong><br/>
  يتم الإفصاح عن المعلومات السرية بغرض: {{purpose}}</p>
  
  <p><strong>المادة الثالثة: الالتزامات</strong><br/>
  يلتزم الطرفان بعدم الإفصاح عن أي معلومات سرية لأي طرف ثالث، وعدم استخدامها لأي غرض آخر غير المذكور أعلاه.</p>
  
  <p><strong>المادة الرابعة: مدة الاتفاقية</strong><br/>
  تسري هذه الاتفاقية لمدة {{duration_years}} سنوات من تاريخ توقيعها.</p>
  
  <p><strong>المادة الخامسة: القانون المطبّق</strong><br/>
  تخضع هذه الاتفاقية لأحكام نظام المعاملات التجارية الإلكترونية وأنظمة المملكة العربية السعودية.</p>
  
  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div style="text-align: center;"><p>توقيع الطرف الأول</p><p>{{party_a}}</p><div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div></div>
    <div style="text-align: center;"><p>توقيع الطرف الثاني</p><p>{{party_b}}</p><div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div></div>
  </div>
</div>`,
    },
    {
      name: "عقد شراكة تجارية",
      type: "partnership",
      category: "contracts",
      description: "عقد لتأسيس شراكة تجارية وتحديد حصص الشركاء ومسؤولياتهم",
      fields: JSON.stringify([
        { key: "partner_a", label: "اسم الشريك الأول", type: "text", required: true },
        { key: "partner_a_id", label: "رقم هوية الشريك الأول", type: "text", required: true },
        { key: "partner_b", label: "اسم الشريك الثاني", type: "text", required: true },
        { key: "partner_b_id", label: "رقم هوية الشريك الثاني", type: "text", required: true },
        { key: "company_name", label: "اسم الشركة/المشروع", type: "text", required: true },
        { key: "business_purpose", label: "الغرض التجاري", type: "text", required: true },
        { key: "capital", label: "رأس المال الإجمالي (ريال)", type: "number", required: true },
        { key: "partner_a_share", label: "حصة الشريك الأول (%)", type: "number", required: true },
        { key: "partner_b_share", label: "حصة الشريك الثاني (%)", type: "number", required: true },
        { key: "duration_years", label: "مدة الشراكة (سنوات)", type: "number", required: true },
        { key: "city", label: "المدينة", type: "text", required: true },
        { key: "date", label: "تاريخ العقد", type: "date", required: true },
      ]),
      body: `<div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 40px; line-height: 2; font-size: 14px;">
  <h1 style="text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px;">عقد شراكة تجارية</h1>
  
  <p>إنه في تاريخ {{date}} بمدينة {{city}}، تم الاتفاق على إنشاء شراكة تجارية بين:</p>
  
  <p><strong>الشريك الأول:</strong> {{partner_a}}، رقم الهوية: {{partner_a_id}}</p>
  <p><strong>الشريك الثاني:</strong> {{partner_b}}، رقم الهوية: {{partner_b_id}}</p>
  
  <p><strong>المادة الأولى: اسم الشركة والغرض</strong><br/>
  يُؤسَّس بموجب هذا العقد مشروع تجاري باسم "{{company_name}}" يمارس نشاطه في: {{business_purpose}}</p>
  
  <p><strong>المادة الثانية: رأس المال والحصص</strong><br/>
  يبلغ رأس المال الإجمالي للشراكة {{capital}} ريال سعودي، يتوزع على الشركاء كالآتي:
  <br/>- {{partner_a}}: {{partner_a_share}}%
  <br/>- {{partner_b}}: {{partner_b_share}}%</p>
  
  <p><strong>المادة الثالثة: الأرباح والخسائر</strong><br/>
  توزَّع الأرباح والخسائر بين الشركاء بنسب مساوية لحصصهم في رأس المال.</p>
  
  <p><strong>المادة الرابعة: مدة الشراكة</strong><br/>
  تمتد الشراكة لمدة {{duration_years}} سنوات قابلة للتجديد باتفاق الطرفين.</p>
  
  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div style="text-align: center;"><p>{{partner_a}}</p><div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div></div>
    <div style="text-align: center;"><p>{{partner_b}}</p><div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div></div>
  </div>
</div>`,
    },
    {
      name: "صحيفة دعوى قضائية",
      type: "lawsuit",
      category: "litigation",
      description: "صحيفة دعوى مُنسَّقة وفق متطلبات المحاكم السعودية",
      fields: JSON.stringify([
        { key: "court_name", label: "اسم المحكمة", type: "text", required: true },
        { key: "plaintiff_name", label: "اسم المدّعي", type: "text", required: true },
        { key: "plaintiff_id", label: "رقم هوية المدّعي", type: "text", required: true },
        { key: "plaintiff_phone", label: "هاتف المدّعي", type: "text", required: false },
        { key: "defendant_name", label: "اسم المدّعى عليه", type: "text", required: true },
        { key: "defendant_id", label: "رقم هوية المدّعى عليه", type: "text", required: false },
        { key: "case_type", label: "نوع الدعوى", type: "text", required: true },
        { key: "claim_description", label: "موضوع الدعوى وطلبات المدّعي", type: "textarea", required: true },
        { key: "claim_amount", label: "قيمة المطالبة (ريال)", type: "number", required: false },
        { key: "attorney_name", label: "اسم المحامي", type: "text", required: false },
        { key: "city", label: "المدينة", type: "text", required: true },
        { key: "date", label: "تاريخ تقديم الصحيفة", type: "date", required: true },
      ]),
      body: `<div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 40px; line-height: 2; font-size: 14px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <p style="font-size: 16px; font-weight: bold;">بسم الله الرحمن الرحيم</p>
    <h1 style="font-size: 22px; margin: 10px 0; border-bottom: 2px solid #000; padding-bottom: 10px;">صحيفة دعوى قضائية</h1>
    <p>{{court_name}}</p>
    <p>تاريخ التقديم: {{date}}</p>
  </div>
  
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold; width: 30%;">المدّعي</td>
      <td style="border: 1px solid #000; padding: 8px;">{{plaintiff_name}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">رقم الهوية</td>
      <td style="border: 1px solid #000; padding: 8px;">{{plaintiff_id}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">الهاتف</td>
      <td style="border: 1px solid #000; padding: 8px;">{{plaintiff_phone}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">المدّعى عليه</td>
      <td style="border: 1px solid #000; padding: 8px;">{{defendant_name}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">رقم الهوية</td>
      <td style="border: 1px solid #000; padding: 8px;">{{defendant_id}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">نوع الدعوى</td>
      <td style="border: 1px solid #000; padding: 8px;">{{case_type}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">قيمة المطالبة</td>
      <td style="border: 1px solid #000; padding: 8px;">{{claim_amount}} ريال سعودي</td>
    </tr>
  </table>
  
  <p><strong>موضوع الدعوى وطلبات المدّعي:</strong></p>
  <div style="border: 1px solid #ccc; padding: 15px; min-height: 150px; background: #fafafa;">
    <p>{{claim_description}}</p>
  </div>
  
  <div style="margin-top: 40px; display: flex; justify-content: space-between;">
    <div style="text-align: center;">
      <p>توقيع المدّعي</p>
      <p>{{plaintiff_name}}</p>
      <div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
    </div>
    <div style="text-align: center;">
      <p>توقيع المحامي</p>
      <p>{{attorney_name}}</p>
      <div style="margin-top: 40px; border-top: 1px solid #000; width: 200px;"></div>
    </div>
  </div>
</div>`,
    },
  ];

  for (const t of templates) {
    await db.execute(sql`
      INSERT INTO document_templates (office_id, name, type, category, description, body, fields, is_default, is_custom)
      VALUES ('default', ${t.name}, ${t.type}, ${t.category}, ${t.description}, ${t.body}, ${t.fields}::jsonb, TRUE, FALSE)
    `);
  }
}

router.get("/document-templates", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const rows = await sqlAll(sql`
      SELECT id, name, type, category, description, fields, is_default, is_custom, created_at
      FROM document_templates
      WHERE office_id = 'default'
      ORDER BY is_default DESC, created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/document-templates/:id", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const row = await sqlOne(sql`
      SELECT * FROM document_templates WHERE id = ${parseInt(req.params.id)} AND office_id = 'default'
    `);
    if (!row) return res.status(404).json({ error: "القالب غير موجود" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/document-templates", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const { name, type, category, description, body, fields } = req.body;
    if (!name || !body) return res.status(400).json({ error: "name و body مطلوبان" });
    const safeBody = sanitizeHtml(body);
    const parsedFields = parseFields(fields);
    const row = await sqlOne(sql`
      INSERT INTO document_templates (office_id, name, type, category, description, body, fields, is_custom)
      VALUES ('default', ${name}, ${type ?? 'other'}, ${category ?? 'contracts'}, ${description ?? null}, ${safeBody}, ${JSON.stringify(parsedFields)}::jsonb, TRUE)
      RETURNING id, name, type, category, description, fields, is_default, is_custom, created_at
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/document-templates/:id", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const { name, type, category, description, body, fields } = req.body;
    const existing = await sqlOne(sql`SELECT * FROM document_templates WHERE id = ${parseInt(req.params.id)}`);
    if (!existing) return res.status(404).json({ error: "القالب غير موجود" });
    if (existing.is_default) return res.status(403).json({ error: "لا يمكن تعديل القوالب الافتراضية" });
    const safeBody = body ? sanitizeHtml(body) : existing.body;
    const parsedFields = fields !== undefined ? parseFields(fields) : existing.fields;
    const row = await sqlOne(sql`
      UPDATE document_templates SET
        name = ${name ?? existing.name},
        type = ${type ?? existing.type},
        category = ${category ?? existing.category},
        description = ${description ?? existing.description},
        body = ${safeBody},
        fields = ${JSON.stringify(parsedFields)}::jsonb,
        updated_at = NOW()
      WHERE id = ${parseInt(req.params.id)}
      RETURNING id, name, type, category, description, fields, is_default, is_custom, created_at
    `);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/document-templates/:id", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const existing = await sqlOne(sql`SELECT * FROM document_templates WHERE id = ${parseInt(req.params.id)}`);
    if (!existing) return res.status(404).json({ error: "القالب غير موجود" });
    if (existing.is_default) return res.status(403).json({ error: "لا يمكن حذف القوالب الافتراضية" });
    await db.execute(sql`DELETE FROM document_templates WHERE id = ${parseInt(req.params.id)}`);
    res.status(204).end();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/document-templates/:id/generate", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const template = await sqlOne(sql`SELECT * FROM document_templates WHERE id = ${parseInt(req.params.id)}`);
    if (!template) return res.status(404).json({ error: "القالب غير موجود" });

    const { filledData, caseId, clientId, documentName } = req.body;
    if (!filledData) return res.status(400).json({ error: "filledData مطلوب" });

    let generatedHtml = template.body as string;
    for (const [key, value] of Object.entries(filledData as Record<string, string>)) {
      const safeValue = sanitizeHtml(String(value || ""));
      generatedHtml = generatedHtml.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), safeValue);
    }
    generatedHtml = generatedHtml.replace(/\{\{[^}]+\}\}/g, "");
    generatedHtml = sanitizeHtml(generatedHtml);

    const name = documentName || `${template.name} - ${new Date().toLocaleDateString("ar-EG")}`;
    const row = await sqlOne(sql`
      INSERT INTO generated_documents (office_id, template_id, name, template_name, case_id, client_id, filled_data, generated_html)
      VALUES ('default', ${template.id}, ${name}, ${template.name}, ${caseId ?? null}, ${clientId ?? null}, ${JSON.stringify(filledData)}::jsonb, ${generatedHtml})
      RETURNING *
    `);
    res.json({ ok: true, document: row });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/generated-documents", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const rows = await sqlAll(sql`
      SELECT id, name, template_name, case_id, client_id, created_at
      FROM generated_documents WHERE office_id = 'default'
      ORDER BY created_at DESC LIMIT 50
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/generated-documents/:id", async (req, res) => {
  if (!requireAuth(req, res)) return;
  await ensureTables();
  try {
    const row = await sqlOne(sql`
      SELECT * FROM generated_documents WHERE id = ${parseInt(req.params.id)} AND office_id = 'default'
    `);
    if (!row) return res.status(404).json({ error: "الوثيقة غير موجودة" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
