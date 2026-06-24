import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth";

const router = Router();
export default router;

/* ── helpers ── */
function sqlAll(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function sqlOne(r: any): any   { return sqlAll(r)[0] ?? null; }
function rnd(arr: any[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rndAmt(min: number, max: number) { return Math.round(Math.random() * (max - min) + min) * 1000; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function daysFuture(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

const NORTH_ID = "demo-north-bk-2026";
const SOUTH_ID = "demo-south-bk-2026";

const COURTS     = ["محكمة التجارة بالرياض", "محكمة التجارة بجدة", "محكمة التجارة بالدمام"];
const TRUSTEES   = ["أ. محمد العتيبي", "أ. عبدالله الشمري", "أ. سالم الحربي", "أ. خالد المطيري"];

/* ═══════════════════════════════════════════════════
   ADD is_demo COLUMN TO ALL TABLES (IDEMPOTENT)
═══════════════════════════════════════════════════ */
async function ensureDemoColumns() {
  const tbls = [
    "bankruptcy_cases","bk_creditors","bk_claims","bk_assets",
    "bk_meetings","bk_distributions","bk_distribution_items",
    "bk_reports","bk_ai_analysis","bk_tasks","bk_alerts",
    "bk_opening_requests","bk_opening_request_documents",
  ];
  for (const t of tbls) {
    await db.execute(sql`ALTER TABLE ${sql.raw(t)} ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════
   SEED — POST /admin/bankruptcy/demo/seed
═══════════════════════════════════════════════════ */
async function isSuperAdmin(req: any): Promise<boolean> {
  const userId = req.auth?.userId as string | undefined;
  if (!userId) return false;
  const r = await db.execute(sql`SELECT role FROM users WHERE id = ${userId} LIMIT 1`).catch(() => null);
  const row = sqlOne(r);
  if (row?.role === "super_admin") return true;
  const ownerEmails = (process.env.PLATFORM_OWNER_EMAIL ?? "").split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);
  const uRow = sqlOne(await db.execute(sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`).catch(() => null));
  return ownerEmails.includes((uRow?.email ?? "").toLowerCase());
}
async function adminOnly(req: any, res: any, next: any) {
  if (!(await isSuperAdmin(req))) return res.status(403).json({ error: "غير مصرح" });
  next();
}

router.get("/admin/bankruptcy/demo/status", adminOnly, async (_req, res) => {
  try {
    await ensureDemoColumns();
    const north = sqlOne(await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM bankruptcy_cases WHERE office_id = ${NORTH_ID} AND is_demo = TRUE`));
    const south = sqlOne(await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM bankruptcy_cases WHERE office_id = ${SOUTH_ID} AND is_demo = TRUE`));
    res.json({
      exists: (Number(north?.cnt) + Number(south?.cnt)) > 0,
      north_cases: Number(north?.cnt),
      south_cases: Number(south?.cnt),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/admin/bankruptcy/demo/seed", adminOnly, async (_req, res) => {
  try {
    await ensureDemoColumns();

    /* delete any existing demo data first */
    await deleteDemoData();

    /* seed both offices */
    const northCounts = await seedOffice(NORTH_ID, "مكتب الشمال للمحاماة", NORTH_CASES);
    const southCounts = await seedOffice(SOUTH_ID, "مكتب الجنوب للمحاماة", SOUTH_CASES);

    res.json({ ok: true, north: northCounts, south: southCounts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/admin/bankruptcy/demo", adminOnly, async (_req, res) => {
  try {
    await ensureDemoColumns();
    const counts = await deleteDemoData();
    res.json({ ok: true, deleted: counts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ═══════════════════════════════════════════════════
   DELETE DEMO DATA
═══════════════════════════════════════════════════ */
async function deleteDemoData() {
  /* child tables first (CASCADE handles most, but be explicit) */
  const tables = [
    "bk_alerts","bk_tasks","bk_ai_analysis","bk_reports",
    "bk_distribution_items","bk_distributions","bk_meetings",
    "bk_assets","bk_claims","bk_creditors","bk_opening_request_documents",
    "bk_opening_requests","bankruptcy_cases",
  ];
  const counts: Record<string,number> = {};
  for (const t of tables) {
    const r = sqlOne(await db.execute(sql`DELETE FROM ${sql.raw(t)} WHERE is_demo = TRUE RETURNING 1`).catch(() => null));
    counts[t] = r ? 1 : 0;
  }
  /* Also delete by office_id for tables that might not have is_demo yet */
  for (const oid of [NORTH_ID, SOUTH_ID]) {
    await db.execute(sql`DELETE FROM bankruptcy_cases WHERE office_id = ${oid}`).catch(() => {});
    await db.execute(sql`DELETE FROM bk_opening_requests WHERE office_id = ${oid}`).catch(() => {});
  }
  return counts;
}

/* ═══════════════════════════════════════════════════
   CASE DEFINITIONS
═══════════════════════════════════════════════════ */
interface CaseDef {
  debtor_name: string;
  debtor_type: "company" | "individual" | "partnership";
  procedure_type: "liquidation"|"reorganization"|"protective_settlement"|"restructuring";
  status: "active"|"suspended"|"claims_review"|"asset_management"|"distribution"|"closed"|"archived";
  creditors: number;
  claims: number;
  assets: number;
  tasks: number;
  alerts: number;
  meetings: number;
  hasDistribution: boolean;
  reports: number;
}

const NORTH_CASES: CaseDef[] = [
  { debtor_name:"شركة النور التجارية",       debtor_type:"company",     procedure_type:"liquidation",           status:"active",           creditors:7,  claims:18, assets:5, tasks:6,  alerts:3, meetings:3, hasDistribution:false, reports:4 },
  { debtor_name:"شركة الخليج الصناعية",      debtor_type:"company",     procedure_type:"reorganization",        status:"claims_review",    creditors:8,  claims:22, assets:5, tasks:6,  alerts:2, meetings:2, hasDistribution:false, reports:3 },
  { debtor_name:"شركة البناء المتقدم",        debtor_type:"company",     procedure_type:"liquidation",           status:"asset_management", creditors:6,  claims:16, assets:5, tasks:5,  alerts:2, meetings:2, hasDistribution:false, reports:3 },
  { debtor_name:"شركة المدى اللوجستية",      debtor_type:"company",     procedure_type:"protective_settlement", status:"distribution",     creditors:5,  claims:14, assets:4, tasks:4,  alerts:2, meetings:2, hasDistribution:true,  reports:3 },
  { debtor_name:"شركة التقنية الحديثة",      debtor_type:"company",     procedure_type:"restructuring",         status:"closed",           creditors:5,  claims:12, assets:4, tasks:3,  alerts:1, meetings:3, hasDistribution:true,  reports:4 },
  { debtor_name:"شركة الأمان للخدمات",       debtor_type:"company",     procedure_type:"liquidation",           status:"active",           creditors:5,  claims:13, assets:4, tasks:5,  alerts:2, meetings:2, hasDistribution:false, reports:2 },
  { debtor_name:"مؤسسة الريادة العقارية",    debtor_type:"partnership", procedure_type:"reorganization",        status:"suspended",        creditors:5,  claims:13, assets:4, tasks:4,  alerts:2, meetings:2, hasDistribution:false, reports:3 },
  { debtor_name:"شركة نجد للمقاولات",        debtor_type:"company",     procedure_type:"liquidation",           status:"archived",         creditors:4,  claims:12, assets:4, tasks:3,  alerts:1, meetings:2, hasDistribution:true,  reports:3 },
];

const SOUTH_CASES: CaseDef[] = [
  { debtor_name:"شركة الجنوب التجارية",      debtor_type:"company",     procedure_type:"liquidation",           status:"active",           creditors:6,  claims:15, assets:4, tasks:5,  alerts:2, meetings:2, hasDistribution:false, reports:3 },
  { debtor_name:"شركة ساحل الأعمال",         debtor_type:"company",     procedure_type:"reorganization",        status:"claims_review",    creditors:6,  claims:14, assets:4, tasks:4,  alerts:2, meetings:2, hasDistribution:false, reports:3 },
  { debtor_name:"شركة الحضارة للصناعة",      debtor_type:"company",     procedure_type:"liquidation",           status:"asset_management", creditors:5,  claims:13, assets:4, tasks:4,  alerts:2, meetings:2, hasDistribution:false, reports:2 },
  { debtor_name:"شركة الوفاء للمقاولات",     debtor_type:"company",     procedure_type:"protective_settlement", status:"distribution",     creditors:5,  claims:12, assets:3, tasks:4,  alerts:2, meetings:2, hasDistribution:true,  reports:3 },
  { debtor_name:"شركة البحر للتجارة",        debtor_type:"company",     procedure_type:"liquidation",           status:"closed",           creditors:4,  claims:11, assets:3, tasks:4,  alerts:1, meetings:2, hasDistribution:true,  reports:3 },
  { debtor_name:"شركة الربيع للاستثمار",     debtor_type:"company",     procedure_type:"restructuring",         status:"active",           creditors:4,  claims:10, assets:2, tasks:4,  alerts:1, meetings:2, hasDistribution:false, reports:2 },
];

const NORTH_REQS = [
  { company_name:"شركة الأفق للاستثمار",     industry:"استثمار",         status:"ready_for_filing",     elig:78, readiness:82 },
  { company_name:"شركة الوطن للمقاولات",     industry:"مقاولات",          status:"ai_analysis",          elig:65, readiness:60 },
  { company_name:"شركة التطوير العمراني",    industry:"عقارات",           status:"under_legal_review",   elig:88, readiness:90 },
];
const SOUTH_REQS = [
  { company_name:"شركة الجزيرة التجارية",   industry:"تجارة",            status:"submitted_to_court",   elig:72, readiness:85 },
  { company_name:"شركة الأصالة للصناعة",   industry:"صناعة",            status:"documents_pending",    elig:55, readiness:45 },
];

/* ═══════════════════════════════════════════════════
   MAIN SEED FUNCTION
═══════════════════════════════════════════════════ */
async function seedOffice(officeId: string, officeName: string, caseDefs: CaseDef[]) {
  let totalCases=0, totalCreditors=0, totalClaims=0, totalAssets=0;
  let totalTasks=0, totalAlerts=0, totalMeetings=0, totalDistributions=0, totalReports=0;

  const isNorth = officeId === NORTH_ID;
  const reqDefs  = isNorth ? NORTH_REQS : SOUTH_REQS;

  /* ── Opening Requests ── */
  for (let ri = 0; ri < reqDefs.length; ri++) {
    const rd = reqDefs[ri];
    const reqNum = `OR-DEMO-${isNorth ? "N" : "S"}${String(ri+1).padStart(3,"0")}`;
    const totalA = rndAmt(5000, 50000);
    const totalL = rndAmt(3000, 45000);
    const aiResult = JSON.stringify({
      eligibility_score: rd.elig,
      financial_distress_score: rndInt(50, 90),
      liquidity_risk_score:     rndInt(40, 85),
      recovery_potential_score: rndInt(30, 80),
      confidence_level:         rndInt(70, 95),
      procedure_recommendation: rd.elig >= 75 ? "financial_reorganization" : rd.elig >= 55 ? "preventive_settlement" : "liquidation",
      reasoning: `بناءً على تحليل البيانات المالية لـ${rd.company_name}، تبيّن أن الشركة تعاني من ضائقة مالية تستوجب التدخل الفوري. نسبة المديونية ${(totalL/totalA*100).toFixed(1)}%، مما يشير إلى ضرورة إعادة الهيكلة.`,
      financial_observations: [`نسبة السيولة: ${(Math.random()*0.8+0.2).toFixed(2)}`, `معدل التغطية: ${(Math.random()*1.5+0.5).toFixed(2)}`, "انخفاض ملحوظ في الإيرادات خلال آخر 6 أشهر"],
      recommendations: ["مراجعة هيكل الديون", "التفاوض مع كبار الدائنين", "تعيين أمين إفلاس فوري"],
    });
    await db.execute(sql`
      INSERT INTO bk_opening_requests (
        office_id, request_number, company_name, commercial_registration, entity_type, industry,
        employee_count, annual_revenue, total_assets, total_liabilities, available_cash, due_debts,
        procedure_recommendation, eligibility_score, financial_distress_score, liquidity_risk_score,
        recovery_potential_score, confidence_level, ai_analysis, readiness_score,
        readiness_details, court_package_content, status, is_demo
      ) VALUES (
        ${officeId}, ${reqNum}, ${rd.company_name}, ${"CR-"+rndInt(1000000,9999999)}, 'شركة ذات مسؤولية محدودة', ${rd.industry},
        ${rndInt(20,500)}, ${rndAmt(2000,20000)}, ${totalA}, ${totalL},
        ${rndAmt(50,500)}, ${rndAmt(1000,8000)},
        ${rd.elig >= 75 ? "financial_reorganization" : rd.elig >= 55 ? "preventive_settlement" : "liquidation"},
        ${rd.elig}, ${rndInt(50,90)}, ${rndInt(40,85)}, ${rndInt(30,80)}, ${rndInt(70,95)},
        ${aiResult}::jsonb, ${rd.readiness},
        ${'{"checks":{"financial_statements":true,"creditor_list":true,"asset_inventory":true,"ai_analysis":true}}'}::jsonb,
        ${'حزمة المحكمة: طلب افتتاح إجراءات الإفلاس وفق نظام الإفلاس السعودي\n\nبيانات الشركة: ' + rd.company_name + '\nالإجراء الموصى به: إعادة الهيكلة المالية'},
        ${rd.status}, TRUE
      )
    `);

    /* documents for each request */
    const docTypes = ["financial_statements","auditor_report","commercial_registration","creditor_list","asset_inventory"];
    for (const dt of docTypes) {
      await db.execute(sql`
        INSERT INTO bk_opening_request_documents (office_id, request_id, document_type, file_name, file_url, is_demo)
        SELECT ${officeId}, id, ${dt}, ${dt + "_" + rd.company_name.replace(/\s/g,"_") + ".pdf"}, ${"/demo/docs/"+dt+".pdf"}, TRUE
        FROM bk_opening_requests WHERE request_number = ${reqNum} AND office_id = ${officeId}
      `).catch(() => {});
    }
  }

  /* ── Cases ── */
  for (let ci = 0; ci < caseDefs.length; ci++) {
    const cd = caseDefs[ci];
    const caseNum = `BK-DEMO-${isNorth ? "N" : "S"}${String(ci+1).padStart(3,"0")}`;
    const startDate = daysAgo(rndInt(90, 365));

    const caseRow = sqlOne(await db.execute(sql`
      INSERT INTO bankruptcy_cases (
        office_id, case_number, debtor_name, debtor_type, procedure_type,
        court_name, trustee_name, status, notes, start_date, is_demo
      ) VALUES (
        ${officeId}, ${caseNum}, ${cd.debtor_name}, ${cd.debtor_type}, ${cd.procedure_type},
        ${rnd(COURTS)}, ${rnd(TRUSTEES)}, ${cd.status},
        ${"ملف إفلاس تجريبي — " + cd.debtor_name + " — أُنشئ للعرض التوضيحي فقط"},
        ${startDate}, TRUE
      ) RETURNING id
    `));
    const caseId: string = caseRow.id;
    totalCases++;

    /* ── Creditors ── */
    const credTypes = ["secured","unsecured","preferred","government","subordinated"];
    const credNames = [
      ["بنك الرياض","بنك الجزيرة","بنك الأهلي","البنك السعودي الفرنسي","بنك البلاد"],
      ["شركة الموارد للتوريد","شركة التجهيزات الصناعية","مؤسسة الخدمات التجارية","شركة المستلزمات المتكاملة"],
      ["موظف / عبدالله المطيري","موظف / خالد العنزي","موظف / سالم الشمري","موظف / محمد الحربي"],
      ["هيئة الزكاة والضريبة والجمارك","وزارة الموارد البشرية","الضمان الاجتماعي"],
      ["مؤسسة التشغيل العقاري","شركة خدمات البنية التحتية"],
    ];
    const insertedCreditors: string[] = [];
    for (let ci2 = 0; ci2 < cd.creditors; ci2++) {
      const typeIdx = ci2 % credTypes.length;
      const credType = credTypes[typeIdx];
      const namePool = credNames[typeIdx];
      const name = namePool[ci2 % namePool.length] + (ci2 >= namePool.length ? ` (${ci2+1})` : "");
      const credRow = sqlOne(await db.execute(sql`
        INSERT INTO bk_creditors (case_id, office_id, name, type, email, phone, is_demo)
        VALUES (${caseId}::uuid, ${officeId}, ${name}, ${credType},
                ${"cred"+ci2+"@demo.sa"}, ${"05"+rndInt(10000000,99999999)}, TRUE)
        RETURNING id
      `));
      insertedCreditors.push(credRow.id);
      totalCreditors++;
    }

    /* ── Claims ── */
    const claimStatuses = ["pending","submitted","under_review","approved","partially_approved","rejected","disputed","finalized"];
    const claimPriority = ["secured","preferred","unsecured","subordinated"];
    for (let cli = 0; cli < cd.claims; cli++) {
      const credId = insertedCreditors[cli % insertedCreditors.length];
      const status = rnd(claimStatuses);
      await db.execute(sql`
        INSERT INTO bk_claims (case_id, creditor_id, office_id, claim_number, amount, currency, priority_level, status, submitted_at, notes, is_demo)
        VALUES (${caseId}::uuid, ${credId}::uuid, ${officeId},
                ${"CLM-"+caseNum+"-"+String(cli+1).padStart(3,"0")},
                ${rndAmt(50, 5000)}, 'SAR', ${rnd(claimPriority)}, ${status},
                ${daysAgo(rndInt(10, 90))},
                ${"مطالبة ديون تجريبية رقم " + (cli+1) + " للعرض التوضيحي"},
                TRUE)
      `);
      totalClaims++;
    }

    /* ── Assets ── */
    const assetTypes = ["real_estate","vehicle","equipment","inventory","cash","receivables","intellectual","securities","other"];
    const assetNames: Record<string,string[]> = {
      real_estate:   ["مستودع صناعي في الرياض","مبنى إداري في جدة","أرض تجارية في الدمام"],
      vehicle:       ["أسطول شاحنات نقل","سيارات شركة","معدات ثقيلة"],
      equipment:     ["خط إنتاج متكامل","معدات تصنيع","أجهزة حاسوبية"],
      receivables:   ["ذمم مدينة من عملاء","مستحقات عقود","فواتير معلقة"],
      cash:          ["أرصدة بنكية","ودائع تحت الطلب"],
      intellectual:  ["براءة اختراع","علامة تجارية مسجلة"],
      securities:    ["محفظة أسهم","سندات استثمارية"],
      inventory:     ["مخزون بضائع","مواد خام"],
      other:         ["أصول متنوعة","ممتلكات إضافية"],
    };
    const assetStatuses = ["identified","valuation","listed","sold","collected","closed","active"];
    for (let ai = 0; ai < cd.assets; ai++) {
      const aType = assetTypes[ai % assetTypes.length];
      const names = assetNames[aType];
      const estVal = rndAmt(100, 20000);
      await db.execute(sql`
        INSERT INTO bk_assets (case_id, office_id, asset_name, asset_type, description, estimated_value, market_value, status, location, is_demo)
        VALUES (${caseId}::uuid, ${officeId},
                ${names[ai % names.length]},
                ${aType}, ${"أصل تجريبي للعرض — " + cd.debtor_name},
                ${estVal}, ${Math.round(estVal * (0.85 + Math.random() * 0.3))},
                ${rnd(assetStatuses)}, ${rnd(COURTS).replace("محكمة","منطقة")}, TRUE)
      `);
      totalAssets++;
    }

    /* ── Meetings ── */
    const meetingTypes = ["creditors","trustee","court","committee","valuation","other"];
    const meetingStatuses = ["scheduled","completed","cancelled"];
    for (let mi = 0; mi < cd.meetings; mi++) {
      const mStatus = mi < Math.ceil(cd.meetings * 0.6) ? "completed" : mi < cd.meetings - 1 ? "scheduled" : rnd(["scheduled","cancelled"]);
      const mDate = mStatus === "completed" ? daysAgo(rndInt(5, 60)) : daysFuture(rndInt(5, 40));
      await db.execute(sql`
        INSERT INTO bk_meetings (case_id, office_id, title, meeting_date, location, meeting_type, status, minutes_text, is_demo)
        VALUES (${caseId}::uuid, ${officeId},
                ${"اجتماع " + (mi===0?"الدائنين الأول":mi===1?"مجلس الأمناء":"مراجعة الأصول") + " — " + cd.debtor_name},
                ${mDate}, ${rnd(COURTS)}, ${meetingTypes[mi % meetingTypes.length]},
                ${mStatus},
                ${mStatus === "completed" ? "تمّ الاجتماع وناقش الأطراف الوضع المالي وتوزيع الأصول" : null},
                TRUE)
      `);
      totalMeetings++;
    }

    /* ── Distributions ── */
    if (cd.hasDistribution) {
      const distStatuses = cd.status === "closed" ? ["executed","executed"] : ["approved","draft"];
      for (let di = 0; di < 2; di++) {
        const totalAmt = rndAmt(500, 10000);
        const distRow = sqlOne(await db.execute(sql`
          INSERT INTO bk_distributions (case_id, office_id, distribution_round, total_amount, distribution_date, status, notes, is_demo)
          VALUES (${caseId}::uuid, ${officeId}, ${di+1}, ${totalAmt},
                  ${daysAgo(rndInt(di*30, di*30+30))},
                  ${distStatuses[di] ?? "draft"},
                  ${"جولة توزيع رقم " + (di+1) + " — " + cd.debtor_name},
                  TRUE)
          RETURNING id
        `));
        /* distribution items (first 3 creditors) */
        const perCred = Math.round(totalAmt / 3);
        for (let dii = 0; dii < Math.min(3, insertedCreditors.length); dii++) {
          await db.execute(sql`
            INSERT INTO bk_distribution_items (distribution_id, creditor_id, office_id, allocated_amount, payment_status, is_demo)
            VALUES (${distRow.id}::uuid, ${insertedCreditors[dii]}::uuid, ${officeId},
                    ${perCred}, ${distStatuses[di] === "executed" ? "paid" : "pending"}, TRUE)
          `).catch(() => {});
        }
        totalDistributions++;
      }
    }

    /* ── Reports ── */
    const reportTypes = ["progress","financial","assets","claims","trustee","final","court"];
    const reportTitles: Record<string,string> = {
      progress: "تقرير المتابعة الدورية", financial: "التقرير المالي الشامل",
      assets: "تقرير تقييم الأصول", claims: "تقرير مراجعة المطالبات",
      trustee: "تقرير أمين الإفلاس", final: "التقرير الختامي", court: "حزمة التقديم للمحكمة",
    };
    for (let ri = 0; ri < cd.reports; ri++) {
      const rType = reportTypes[ri % reportTypes.length];
      await db.execute(sql`
        INSERT INTO bk_reports (case_id, office_id, report_type, report_title, content, generated_by, category, is_demo)
        VALUES (${caseId}::uuid, ${officeId}, ${rType},
                ${(reportTitles[rType] ?? "تقرير") + " — " + cd.debtor_name},
                ${"محتوى تقرير تجريبي للعرض التوضيحي. يشمل هذا التقرير تحليل الوضع المالي وتفاصيل الأصول والمطالبات المقدمة في قضية " + cd.debtor_name + "."},
                ${rnd(TRUSTEES)}, ${rType === "court" ? "court_package" : "general"}, TRUE)
      `);
      totalReports++;
    }

    /* ── AI Analysis ── */
    const aiTypes = ["general","claims","assets","risk","financial","summary","trustee_report"];
    for (const aType of aiTypes.slice(0, 4)) {
      await db.execute(sql`
        INSERT INTO bk_ai_analysis (case_id, office_id, analysis_type, input_source, result, token_count, is_demo)
        VALUES (${caseId}::uuid, ${officeId}, ${aType}, 'demo',
                ${"تحليل ذكاء اصطناعي تجريبي من نوع [" + aType + "] لقضية " + cd.debtor_name + ".\n\n**النتيجة:** استناداً إلى البيانات المتاحة، يُقدَّر مستوى المخاطر بـ" + rndInt(30,80) + "% وإمكانية الاسترداد بـ" + rndInt(40,85) + "%.\n\n**التوصية:** مراجعة هيكل الديون وتعيين أمين إفلاس مؤهل."},
                ${rndInt(800, 2500)}, TRUE)
      `);
    }

    /* ── Tasks ── */
    const taskTitles = [
      "مراجعة قائمة الدائنين","تقييم الأصول العقارية","تحضير حزمة المحكمة",
      "إشعار الدائنين","مراجعة المطالبات المقدمة","إعداد التقرير المالي",
      "جدولة اجتماع الدائنين","متابعة إجراءات البيع","التحقق من صحة المستندات",
      "رفع التقرير الدوري للمحكمة","تحديث سجل الأصول","إتمام إجراءات التوزيع",
    ];
    const taskPriorities = ["low","medium","high","critical"];
    const taskStatuses   = ["pending","in_progress","completed","cancelled","overdue"];
    for (let ti = 0; ti < cd.tasks; ti++) {
      const tPriority = taskPriorities[ti % taskPriorities.length];
      const isOverdue = ti < Math.ceil(cd.tasks * 0.2);
      const tStatus   = isOverdue ? "overdue" : ti < Math.ceil(cd.tasks * 0.4) ? "completed" : ti < Math.ceil(cd.tasks * 0.7) ? "in_progress" : "pending";
      await db.execute(sql`
        INSERT INTO bk_tasks (office_id, case_id, title, description, task_type, priority, status, due_date, is_demo)
        VALUES (${officeId}, ${caseId}::uuid,
                ${taskTitles[ti % taskTitles.length]},
                ${"مهمة تجريبية رقم " + (ti+1) + " لقضية " + cd.debtor_name},
                ${"manual"}, ${tPriority}, ${tStatus},
                ${isOverdue ? daysAgo(rndInt(5, 20)) : daysFuture(rndInt(3, 30))},
                TRUE)
      `);
      totalTasks++;
    }

    /* ── Alerts ── */
    const alertTypes = [
      "high_risk_case","large_claim_dispute","missing_documents","asset_valuation_delay",
      "distribution_delay","court_deadline","cash_flow_risk","ai_risk_detection","overdue_task",
    ];
    const alertSeverities = ["info","warning","high","critical"];
    const alertTitles: Record<string,string> = {
      high_risk_case:        "قضية عالية المخاطر",
      large_claim_dispute:   "نزاع على مطالبة كبيرة",
      missing_documents:     "مستندات مفقودة",
      asset_valuation_delay: "تأخر في تقييم الأصول",
      distribution_delay:    "تأخر في التوزيع",
      court_deadline:        "موعد نهائي للمحكمة",
      cash_flow_risk:        "خطر سيولة نقدية",
      ai_risk_detection:     "اكتشاف مخاطر (AI)",
      overdue_task:          "مهمة متأخرة",
    };
    for (let ali = 0; ali < cd.alerts; ali++) {
      const aType = alertTypes[ali % alertTypes.length];
      const aSeverity = ali === 0 ? "critical" : ali === 1 ? "high" : rnd(alertSeverities);
      await db.execute(sql`
        INSERT INTO bk_alerts (office_id, case_id, alert_type, severity, title, message, status, is_demo)
        VALUES (${officeId}, ${caseId}::uuid, ${aType}, ${aSeverity},
                ${(alertTitles[aType] ?? aType) + " — " + cd.debtor_name},
                ${"تنبيه تجريبي: " + (alertTitles[aType] ?? aType) + " في قضية " + cd.debtor_name + ". يرجى المراجعة الفورية."},
                ${ali < Math.ceil(cd.alerts * 0.6) ? "active" : rnd(["acknowledged","resolved"])},
                TRUE)
      `).catch(() => {});
      totalAlerts++;
    }
  }

  return { cases: totalCases, creditors: totalCreditors, claims: totalClaims, assets: totalAssets, tasks: totalTasks, alerts: totalAlerts, meetings: totalMeetings, distributions: totalDistributions, reports: totalReports };
}
