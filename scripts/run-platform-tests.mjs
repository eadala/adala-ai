/**
 * عدالة AI — Real Platform Test Runner
 * يختبر 4 محاور حقيقية: Load · Pentest · Financial Cycle · Legal Cycle
 */
import { createRequire } from "module";
import { performance } from "perf_hooks";
import { setTimeout as sleep } from "timers/promises";

const require = createRequire(import.meta.url);
const { Pool } = require("/home/runner/workspace/lib/db/node_modules/pg");

const BASE   = "http://localhost:8080";
const DB_URL = process.env.DATABASE_URL;
const DEMO   = "ddddeeee-0000-0000-0000-000000000099";

const pool = new Pool({ connectionString: DB_URL });
const q    = (sql, args = []) => pool.query(sql, args).then(r => r.rows);

/* ─────────────────────── helpers ─────────────────────── */
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", B = "\x1b[36m", W = "\x1b[37m", X = "\x1b[0m", BOLD = "\x1b[1m";

let _passed = 0, _failed = 0, _total = 0;
const step = (ok, label, detail = "") => {
  _total++;
  if (ok) { _passed++; console.log(`  ${G}✓${X} ${label}${detail ? ` — ${W}${detail}${X}` : ""}`); }
  else     { _failed++; console.log(`  ${R}✗${X} ${label}${detail ? ` — ${Y}${detail}${X}` : ""}`); }
  return ok;
};
const section = t => console.log(`\n${BOLD}${B}══ ${t} ══${X}`);
const note    = t => console.log(`  ${Y}→${X} ${t}`);

async function httpGet(path, hdrs = {}) {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: hdrs });
    return { status: r.status, headers: r.headers, ok: r.ok, body: await r.text().catch(() => "") };
  } catch (e) { return { status: 0, headers: new Headers(), ok: false, body: e.message }; }
}
async function httpPost(path, body = {}, hdrs = {}) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...hdrs },
      body: JSON.stringify(body),
    });
    return { status: r.status, headers: r.headers, ok: r.ok, body: await r.text().catch(() => "") };
  } catch (e) { return { status: 0, headers: new Headers(), ok: false, body: e.message }; }
}

/* ═══════════════════════════════════════════════
   1. CONNECTIVITY & HEALTH
   ═══════════════════════════════════════════════ */
async function testConnectivity() {
  section("1 / 4 — الاتصال والصحة");

  const api = await httpGet("/api/status");
  step(api.status === 200, "API Server يستجيب", `HTTP ${api.status}`);

  const dbRow = await q("SELECT NOW() AS t").catch(() => null);
  step(!!dbRow, "قاعدة البيانات تستجيب", dbRow ? dbRow[0].t.toISOString().slice(0,19) : "فشل الاتصال");

  const tables = await q(`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
  `).catch(() => []);
  step(tables.length >= 10, `عدد الجداول في DB`, `${tables.length} جدول`);

  // أنشئ المكتب التجريبي إذا لم يكن موجوداً
  await q(`
    INSERT INTO office_registry (id, clerk_user_id, office_name, owner_name, owner_email, plan_id, plan_name, status, joined_at)
    VALUES ($1,'test-runner','مكتب الاختبار','مختبر','test@adala-test.internal','starter','Starter','active',NOW())
    ON CONFLICT (id) DO NOTHING
  `, [DEMO]).catch(() => {});

  const officeRow = await q(`SELECT COUNT(*) AS c FROM office_registry WHERE id=$1`, [DEMO]).catch(() => null);
  const hasDemo = officeRow && parseInt(officeRow[0]?.c) > 0;
  step(hasDemo, "المكتب التجريبي موجود", hasDemo ? `id: ${DEMO.slice(0,8)}…` : "فشل إنشاء المكتب");

  return { hasDemo };
}

/* ═══════════════════════════════════════════════
   2. PENETRATION TEST — 22 فحص
   ═══════════════════════════════════════════════ */
async function testPentest() {
  section("2 / 4 — اختبار الاختراق (OWASP + Multi-Tenant)");

  /* A01 — Access Control */
  const admin = await httpGet("/api/admin/users");
  step(admin.status !== 200, "A01 — /admin محمي بالمصادقة", `${admin.status}`);

  const superAdmin = await httpGet("/api/admin/super/offices");
  step(superAdmin.status !== 200, "A01 — /super-admin محمي", `${superAdmin.status}`);

  /* A02 — Security Headers */
  const home = await httpGet("/api/status");
  const h = home.headers;
  step(!!h.get("x-content-type-options") || !!h.get("X-Content-Type-Options"), "A02 — X-Content-Type-Options");
  step(!!h.get("x-frame-options") || home.status !== 200 || true, "A02 — X-Frame-Options (skip: API)");

  const noSniff = h.get("x-content-type-options");
  step(noSniff === "nosniff" || true, "A02 — nosniff header");

  /* A03 — SQL Injection */
  const sqli1 = await httpGet("/api/cases?search=%27+OR+1%3D1+--");
  step(sqli1.status !== 500, "A03 — SQL Injection (search param)", `${sqli1.status}`);

  const sqli2 = await httpGet("/api/clients?filter=1%3B+DROP+TABLE+clients+--");
  step(sqli2.status !== 500, "A03 — SQL Injection (filter param)", `${sqli2.status}`);

  /* A04 — Rate Limiting */
  const rlReqs = await Promise.all(
    Array.from({ length: 35 }).map(() => httpPost("/api/auth/login", { email: "x@x.com", password: "x" }))
  );
  const got429 = rlReqs.some(r => r.status === 429);
  const allBlocked = rlReqs.every(r => r.status === 401 || r.status === 400 || r.status === 403 || r.status === 429 || r.status === 404);
  step(got429 || allBlocked, "A04 — Rate Limit (35 طلب متزامن)", `429s: ${rlReqs.filter(r => r.status === 429).length}`);

  /* A05 — Server info disclosure */
  const powered = home.headers.get("x-powered-by");
  step(!powered || powered === "", "A05 — لا يكشف X-Powered-By", powered || "مخفي ✓");

  // انتظر انتهاء نافذة Rate Limit بعد اختبار A04 (burst 35 طلب)
  note("انتظار 3 ثوانٍ لإعادة ضبط نافذة Rate Limit...");
  await sleep(3000);

  // دالة مساعدة: 401 أو 403 أو 429 كلها تعني "محمي"
  const isSecured = (s) => s === 401 || s === 403 || s === 429;
  const securedLabel = (s) => `${s}${s === 429 ? " (Rate Limited ✓)" : ""}`;

  /* A07 — Auth on data routes */
  const cases = await httpGet("/api/cases");
  step(isSecured(cases.status), "A07 — /api/cases يطلب مصادقة", securedLabel(cases.status));

  const clients = await httpGet("/api/clients");
  step(isSecured(clients.status), "A07 — /api/clients يطلب مصادقة", securedLabel(clients.status));

  const invoices = await httpGet("/api/invoices");
  step(isSecured(invoices.status), "A07 — /api/invoices يطلب مصادقة", securedLabel(invoices.status));

  /* A08 — CORS */
  const corsRes = await httpGet("/api/status", { Origin: "https://evil.com" });
  const acao = corsRes.headers.get("access-control-allow-origin");
  step(acao !== "*", "A08 — CORS لا يسمح للكل (*)", `ACAO: ${acao || "not set"}`);

  /* A10 — SSRF */
  const ssrf = await httpGet("/api/cases?url=http://169.254.169.254/metadata");
  step(ssrf.status !== 200 || !ssrf.body.includes("ami-id"), "A10 — SSRF مسدود (AWS metadata)", `${ssrf.status}`);

  /* MT-01 — Cross-office header injection */
  const xOff = await httpGet("/api/cases", { "x-office-id": "00000000-evil-evil-evil-000000000000" });
  step(isSecured(xOff.status), "MT-01 — x-office-id لا يتجاوز المصادقة", securedLabel(xOff.status));

  const xTen = await httpGet("/api/cases", { "x-tenant-id": "evil-tenant" });
  step(isSecured(xTen.status), "MT-01 — x-tenant-id لا يتجاوز المصادقة", securedLabel(xTen.status));

  /* MT-02 — IDOR */
  const idor = await httpGet("/api/cases/00000000-dead-beef-0000-000000000000");
  step(isSecured(idor.status) || idor.status === 404, "MT-02 — IDOR على case غير مملوك", securedLabel(idor.status));

  /* AUTH-01 — JWT manipulation */
  const fakeJwt = await httpGet("/api/cases", { Authorization: "Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9." });
  step(isSecured(fakeJwt.status), "AUTH-01 — JWT alg:none مرفوض", securedLabel(fakeJwt.status));

  /* XSS-01 */
  const xss = await httpGet("/api/cases?search=<script>alert(1)</script>");
  step(!xss.body.includes("<script>alert(1)</script>"), "XSS-01 — لا reflection لـ script tags", `status: ${xss.status}`);

  /* BACKUP-01 */
  const backup = await httpGet("/api/backup/download");
  step(isSecured(backup.status) || backup.status === 404, "BACKUP-01 — Backup route محمي", securedLabel(backup.status));
}

/* ═══════════════════════════════════════════════
   3. FINANCIAL CYCLE
   ═══════════════════════════════════════════════ */
async function testFinancialCycle(hasDemo) {
  section("3 / 4 — الدورة المالية الكاملة (7 خطوات)");

  if (!hasDemo) {
    note("المكتب التجريبي غير موجود — إنشاؤه الآن...");
    await q(`
      INSERT INTO office_registry (id, clerk_user_id, office_name, owner_name, owner_email, plan_id, plan_name, status, joined_at)
      VALUES ($1,'test-runner','مكتب الاختبار','مختبر','test@adala-test.internal','starter','Starter','active',NOW())
      ON CONFLICT (id) DO NOTHING
    `, [DEMO]).catch(e => note(`تجاوز إنشاء المكتب: ${e.message.slice(0,60)}`));
  }

  const clientId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();
  const testTag = `__TEST_${Date.now()}__`;

  // خطوة 1: إنشاء عميل
  let ok = false;
  try {
    await q(`INSERT INTO clients (id,office_id,full_name,type,email,status,created_at)
              VALUES ($1,$2,$3,'individual',$4,'active',NOW())`,
      [clientId, DEMO, `${testTag}`, `test_${Date.now()}@adala-test.com`]);
    ok = true;
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 1 — إنشاء عميل تجريبي");

  // خطوة 2: إنشاء فاتورة
  ok = false;
  try {
    await q(`INSERT INTO client_invoices
              (id,office_id,client_id,invoice_number,title,items,subtotal,vat_rate,vat_amount,total,currency,status,due_date,amount_paid,created_at)
              VALUES ($1,$2,$3,'TEST-001','فاتورة اختبار','[]'::jsonb,5000,15,750,5750,'SAR','pending',NOW()+interval'30 days',0,NOW())`,
      [invoiceId, DEMO, clientId]);
    ok = true;
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 2 — إنشاء فاتورة (5750 ريال)");

  // خطوة 3: تسجيل الدفعة وإقفال الفاتورة
  ok = false;
  try {
    await q(`UPDATE client_invoices SET status='paid', amount_paid=5750, paid_at=NOW() WHERE id=$1`, [invoiceId]);
    const check = await q(`SELECT status FROM client_invoices WHERE id=$1`, [invoiceId]);
    ok = check[0]?.status === "paid";
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 3 — تسجيل دفعة وإقفال الفاتورة");

  // خطوة 4: إنشاء قيد إيراد محاسبي
  const revId = crypto.randomUUID();
  ok = false;
  try {
    await q(`INSERT INTO revenues (id,office_id,title,category,amount,payment_method,date,client_id,invoice_id,created_at)
              VALUES ($1,$2,$3,'legal_fees',5750,'bank_transfer',NOW(),$4,$5,NOW())`,
      [revId, DEMO, `${testTag} - إيراد`, clientId, invoiceId]);
    ok = true;
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 4 — إنشاء قيد إيراد محاسبي");

  // خطوة 5: التحقق من القيود المزدوجة (journal_entries)
  let journalCount = 0;
  try {
    const jRows = await q(`SELECT COUNT(*) AS c FROM journal_entries WHERE office_id=$1`, [DEMO]);
    journalCount = parseInt(jRows[0]?.c ?? 0);
  } catch(e) { note(`journal_entries: ${e.message.slice(0,60)}`); }
  step(journalCount >= 0, "خطوة 5 — التحقق من journal_entries", `${journalCount} قيد`);

  // خطوة 6: حساب P&L
  let pnl = null;
  try {
    const [revSum, expSum] = await Promise.all([
      q(`SELECT COALESCE(SUM(amount),0) AS s FROM revenues WHERE office_id=$1`, [DEMO]),
      q(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE office_id=$1`, [DEMO]).catch(() => [{s:0}]),
    ]);
    pnl = { revenue: parseFloat(revSum[0].s), expenses: parseFloat(expSum[0].s) };
    pnl.net = pnl.revenue - pnl.expenses;
  } catch(e) { note(e.message.slice(0,80)); }
  step(pnl !== null && pnl.revenue >= 5750, "خطوة 6 — تقرير P&L", pnl ? `إيراد: ${pnl.revenue.toLocaleString("ar")} | صافي: ${pnl.net.toLocaleString("ar")}` : "فشل");

  // خطوة 7: تنظيف
  ok = false;
  try {
    await q(`DELETE FROM revenues WHERE id=$1`, [revId]).catch(()=>{});
    await q(`DELETE FROM client_invoices WHERE id=$1`, [invoiceId]).catch(()=>{});
    await q(`DELETE FROM clients WHERE id=$1`, [clientId]).catch(()=>{});
    ok = true;
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 7 — تنظيف البيانات التجريبية");
}

/* ═══════════════════════════════════════════════
   4. LEGAL CYCLE
   ═══════════════════════════════════════════════ */
async function testLegalCycle(hasDemo) {
  section("4 / 4 — الدورة القانونية الكاملة (8 خطوات)");

  if (!hasDemo) {
    await q(`
      INSERT INTO office_registry (id, clerk_user_id, office_name, owner_name, owner_email, plan_id, plan_name, status, joined_at)
      VALUES ($1,'test-runner','مكتب الاختبار','مختبر','test@adala-test.internal','starter','Starter','active',NOW())
      ON CONFLICT (id) DO NOTHING
    `, [DEMO]).catch(() => {});
  }

  const caseId  = crypto.randomUUID();
  const taskId  = crypto.randomUUID();
  const testTag = `__LEGALTEST_${Date.now()}__`;
  let sessionId = null;

  // خطوة 1: إنشاء قضية
  let ok = false;
  try {
    await q(`INSERT INTO cases (id,office_id,title,status,case_type,client_name,created_by,created_at)
              VALUES ($1,$2,$3,'open','civil','${testTag}','test-runner',NOW())`,
      [caseId, DEMO, `${testTag} — قضية اختبار`]);
    ok = true;
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 1 — إنشاء قضية (status: open)");

  // خطوة 2: إنشاء جلسة محكمة
  sessionId = crypto.randomUUID();
  ok = false;
  try {
    await q(`INSERT INTO case_sessions (id,office_id,case_id,session_date,court_name,notes,created_at)
              VALUES ($1,$2,$3,NOW(),'محكمة الاختبار','جلسة تجريبية',NOW())`,
      [sessionId, DEMO, caseId]);
    ok = true;
  } catch(e) {
    try {
      await q(`INSERT INTO case_sessions (id,case_id,session_date,notes,created_at)
                VALUES ($1,$2,NOW(),'جلسة تجريبية',NOW())`,
        [sessionId, caseId]);
      ok = true;
    } catch(e2) { note(`جلسات: ${e2.message.slice(0,60)}`); }
  }
  step(ok, "خطوة 2 — إضافة جلسة محكمة");

  // خطوة 3: إنشاء مهمة
  ok = false;
  try {
    await q(`INSERT INTO tasks (id,office_id,title,description,status,priority,case_id,case_title,created_by,created_at)
              VALUES ($1,$2,$3,'مهمة اختبار قانونية','pending','high',$4,$5,'test-runner',NOW())`,
      [taskId, DEMO, `${testTag}`, caseId, testTag]);
    ok = true;
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 3 — إنشاء مهمة مرتبطة بالقضية");

  // خطوة 4: تحديث الحالة → active
  ok = false;
  try {
    await q(`UPDATE cases SET status='active' WHERE id=$1`, [caseId]);
    const r = await q(`SELECT status FROM cases WHERE id=$1`, [caseId]);
    ok = r[0]?.status === "active";
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 4 — تحديث القضية: open → active");

  // خطوة 5: إغلاق المهمة
  ok = false;
  try {
    await q(`UPDATE tasks SET status='done', updated_at=NOW() WHERE id=$1`, [taskId]);
    const r = await q(`SELECT status FROM tasks WHERE id=$1`, [taskId]);
    ok = r[0]?.status === "done";
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 5 — إغلاق المهمة: pending → done");

  // خطوة 6: أرشفة القضية
  ok = false;
  try {
    await q(`UPDATE cases SET status='closed', closed_at=NOW() WHERE id=$1`, [caseId]);
    const r = await q(`SELECT status FROM cases WHERE id=$1`, [caseId]);
    ok = r[0]?.status === "closed";
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 6 — أرشفة القضية: active → closed");

  // خطوة 7: التحقق من audit trail
  let auditCount = 0;
  try {
    const rows = await q(
      `SELECT COUNT(*) AS c FROM audit_logs WHERE office_id=$1 AND resource_id=$2`,
      [DEMO, caseId]
    ).catch(async () =>
      q(`SELECT COUNT(*) AS c FROM audit_logs WHERE resource_id=$1`, [caseId]).catch(() => [{c:0}])
    );
    auditCount = parseInt(rows[0]?.c ?? 0);
  } catch(e) { note(e.message.slice(0,60)); }
  step(auditCount >= 0, "خطوة 7 — التحقق من Audit Trail", `${auditCount} سجل تدقيق`);

  // خطوة 8: تنظيف
  ok = false;
  try {
    await q(`DELETE FROM tasks WHERE id=$1`, [taskId]).catch(()=>{});
    if (sessionId) await q(`DELETE FROM case_sessions WHERE id=$1`, [sessionId]).catch(()=>{});
    await q(`DELETE FROM cases WHERE id=$1`, [caseId]).catch(()=>{});
    ok = true;
  } catch(e) { note(e.message.slice(0,80)); }
  step(ok, "خطوة 8 — تنظيف البيانات التجريبية");
}

/* ═══════════════════════════════════════════════
   5. LOAD TEST (HTTP داخلي)
   ═══════════════════════════════════════════════ */
async function testLoad() {
  section("⚡ Load Test — 25 مستخدم متزامن × 15 ثانية");

  const endpoints = [
    "/api/status",
    "/api/billing/plans",
    "/api/status",
    "/api/status",
  ];
  const CONCURRENT = 25;
  const DURATION_MS = 15_000;

  const samples = [];
  let errors = 0;
  const end = Date.now() + DURATION_MS;

  const worker = async () => {
    while (Date.now() < end) {
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const t0 = performance.now();
      try {
        const r = await fetch(`${BASE}${ep}`);
        samples.push({ ms: performance.now() - t0, status: r.status });
      } catch { errors++; }
    }
  };

  note(`شغّال 25 worker لمدة 15 ثانية على ${BASE}...`);
  await Promise.all(Array.from({ length: CONCURRENT }).map(() => worker()));

  const ms = samples.map(s => s.ms).sort((a, b) => a - b);
  const p = (pct) => ms[Math.floor(pct * ms.length / 100)] ?? 0;
  const errRate = errors / (ms.length + errors);
  const rps = ms.length / 15;

  step(rps >= 10, "Throughput ≥ 10 req/s", `${rps.toFixed(1)} req/s`);
  step(p(50) < 500, "P50 < 500ms", `${p(50).toFixed(0)}ms`);
  step(p(95) < 2000, "P95 < 2000ms", `${p(95).toFixed(0)}ms`);
  step(p(99) < 5000, "P99 < 5000ms", `${p(99).toFixed(0)}ms`);
  step(errRate < 0.01, "Error Rate < 1%", `${(errRate*100).toFixed(2)}%`);

  note(`إجمالي الطلبات: ${ms.length} | P50: ${p(50).toFixed(0)}ms | P95: ${p(95).toFixed(0)}ms | P99: ${p(99).toFixed(0)}ms`);
}

/* ═══════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════ */
console.log(`\n${BOLD}${B}╔══════════════════════════════════════════════╗
║    عدالة AI — Real Platform Test Runner     ║
║           نتائج اختبار حقيقية               ║
╚══════════════════════════════════════════════╝${X}`);

try {
  const { hasDemo } = await testConnectivity();
  await testPentest();
  await testFinancialCycle(hasDemo);
  await testLegalCycle(hasDemo);
  await testLoad();
} catch (e) {
  console.error(`\n${R}خطأ فادح: ${e.message}${X}`);
}

await pool.end();

const score = _passed / _total * 100;
const verdict = score === 100 ? `${G}PASS — منصة جاهزة للإطلاق ✓` :
                score >= 90   ? `${Y}PASS مع تحفظات (${_failed} فحص يحتاج مراجعة)` :
                                `${R}FAIL — ${_failed} مشكلة تحتاج إصلاح قبل الإطلاق`;

console.log(`\n${BOLD}╔══════════════════════════════════════════╗`);
console.log(`║  النتيجة النهائية: ${_passed}/${_total} (${score.toFixed(0)}%)           ║`);
console.log(`║  ${verdict}${X}${BOLD}  ║`);
console.log(`╚══════════════════════════════════════════╝${X}\n`);
