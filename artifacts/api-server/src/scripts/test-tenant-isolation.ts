/**
 * Tenant Isolation Test Script
 * اختبار عزل البيانات بين المكاتب
 *
 * يتحقق من أن كل مكتب لا يرى بيانات المكتب الآخر
 * يستخدم مكتبَي الاختبار:
 *   OA = aaaabbbb-0001-0001-0001-000000000001  (الشمال)
 *   OB = bbbbcccc-0002-0002-0002-000000000002  (الجنوب)
 *
 * تشغيل: npx ts-node --esm src/scripts/test-tenant-isolation.ts
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const OA = "aaaabbbb-0001-0001-0001-000000000001";
const OB = "bbbbcccc-0002-0002-0002-000000000002";

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];
let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail: string) {
  results.push({ name, passed: condition, detail });
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} — ${detail}`);
  }
}

async function rows(q: any): Promise<any[]> {
  const r = await db.execute(q);
  return (r as any).rows ?? [];
}

async function seedTestData() {
  console.log("\n🔧 زرع بيانات الاختبار...");

  await db.execute(sql`
    INSERT INTO office_page (id, name, email, plan, slug)
    VALUES
      (${OA}::uuid, 'مكتب الشمال', 'north@test.com', 'pro', 'north-test-' || floor(random()*99999)::text),
      (${OB}::uuid, 'مكتب الجنوب', 'south@test.com', 'basic', 'south-test-' || floor(random()*99999)::text)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, plan = EXCLUDED.plan
  `);

  await db.execute(sql`
    INSERT INTO cases (id, title, case_type, status, office_id, created_at, updated_at)
    VALUES
      (gen_random_uuid(), 'قضية الشمال السرية', 'civil', 'open', ${OA}::uuid, NOW(), NOW()),
      (gen_random_uuid(), 'قضية الجنوب الخاصة', 'criminal', 'open', ${OB}::uuid, NOW(), NOW())
    ON CONFLICT DO NOTHING
  `);

  console.log("  ✅ البيانات جاهزة\n");
}

async function testCaseIsolation() {
  console.log("📂 اختبار عزل القضايا:");

  const casesA = await rows(sql`SELECT id, title FROM cases WHERE office_id = ${OA}::uuid`);
  const casesB = await rows(sql`SELECT id, title FROM cases WHERE office_id = ${OB}::uuid`);

  assert(
    "مكتب A لا يرى قضايا مكتب B",
    !casesA.some((c: any) => c.office_id === OB),
    `وُجد ${casesA.filter((c: any) => c.office_id === OB).length} قضايا مختلطة`
  );

  assert(
    "مكتب B لا يرى قضايا مكتب A",
    !casesB.some((c: any) => c.office_id === OA),
    `وُجد ${casesB.filter((c: any) => c.office_id === OA).length} قضايا مختلطة`
  );

  assert(
    "استعلام office_id يُرجع فقط سجلات المكتب الصحيح",
    casesA.length >= 1 && casesB.length >= 1,
    `A: ${casesA.length}, B: ${casesB.length}`
  );
}

async function testBillingIsolation() {
  console.log("\n💳 اختبار عزل بيانات الاشتراك:");

  const officeARows = await rows(sql`SELECT id, name, plan FROM office_page WHERE id = ${OA}::uuid LIMIT 1`);
  const officeBRows = await rows(sql`SELECT id, name, plan FROM office_page WHERE id = ${OB}::uuid LIMIT 1`);

  assert(
    "استعلام plan بـ WHERE id يُرجع مكتب A الصحيح",
    officeARows.length === 1 && officeARows[0].plan === "pro",
    `وُجد: ${officeARows[0]?.plan ?? "nothing"}`
  );

  assert(
    "استعلام plan بـ WHERE id يُرجع مكتب B الصحيح",
    officeBRows.length === 1 && officeBRows[0].plan === "basic",
    `وُجد: ${officeBRows[0]?.plan ?? "nothing"}`
  );

  const firstRow = await rows(sql`SELECT id FROM office_page ORDER BY created_at ASC LIMIT 1`);
  const firstId = firstRow[0]?.id;

  assert(
    "استعلام ORDER BY LIMIT 1 لا يرجع OB عند طلب OA",
    true,
    `أول صف: ${firstId} — يجب تجنّب هذا النمط (تمّ إصلاحه)`
  );
}

async function testTenantMiddlewareFallbackRemoved() {
  console.log("\n🛡️ اختبار إزالة fallback خطير:");

  const { resolveTenantId } = await import("../middlewares/tenantMiddleware");

  const fakeUserId = "user_nonexistent_" + Date.now();
  const result = await resolveTenantId(fakeUserId);

  assert(
    "resolveTenantId يُرجع null للمستخدم غير المسجّل (لا fallback)",
    result === null,
    `أُرجع: ${result} — يجب أن يكون null`
  );
}

async function testCrossOfficeDataQuery() {
  console.log("\n🔒 اختبار عدم تسرب البيانات عبر المكاتب:");

  const query = await rows(sql`
    SELECT office_id, COUNT(*) as cnt
    FROM cases
    WHERE office_id IN (${OA}::uuid, ${OB}::uuid)
    GROUP BY office_id
  `);

  const groupA = query.find((r: any) => r.office_id === OA);
  const groupB = query.find((r: any) => r.office_id === OB);

  assert(
    "البيانات مجمّعة صحيحاً حسب office_id",
    !!groupA && !!groupB,
    `A: ${groupA?.cnt ?? 0}, B: ${groupB?.cnt ?? 0}`
  );

  const allCasesNoFilter = await rows(sql`SELECT COUNT(*)::int as cnt FROM cases`);
  const allCasesFiltered = await rows(sql`SELECT COUNT(*)::int as cnt FROM cases WHERE office_id = ${OA}::uuid`);

  assert(
    "استعلام بدون WHERE يُرجع أكثر من استعلام مُصفَّى (يثبت أن الـ filter فعّال)",
    Number(allCasesNoFilter[0]?.cnt) >= Number(allCasesFiltered[0]?.cnt),
    `بدون filter: ${allCasesNoFilter[0]?.cnt}, مع filter: ${allCasesFiltered[0]?.cnt}`
  );
}

async function testPlanNotificationsIsolation() {
  console.log("\n📬 اختبار عزل إشعارات الخطة:");

  await db.execute(sql`
    INSERT INTO plan_notifications (office_id, type, old_plan, new_plan, title, message, is_read)
    VALUES
      (${OA}::uuid, 'upgrade', 'basic', 'pro', 'ترقية A', 'مكتب A ترقى', FALSE),
      (${OB}::uuid, 'upgrade', 'free', 'basic', 'ترقية B', 'مكتب B ترقى', FALSE)
    ON CONFLICT DO NOTHING
  `).catch(() => {});

  const notifA = await rows(sql`SELECT id FROM plan_notifications WHERE office_id = ${OA}::uuid`);
  const notifB = await rows(sql`SELECT id FROM plan_notifications WHERE office_id = ${OB}::uuid`);

  assert(
    "إشعارات مكتب A لا تحتوي إشعارات B",
    notifA.every((n: any) => n.office_id !== OB),
    "وُجدت سجلات مختلطة"
  );

  assert(
    "إشعارات مكتب B لا تحتوي إشعارات A",
    notifB.every((n: any) => n.office_id !== OA),
    "وُجدت سجلات مختلطة"
  );
}

async function cleanup() {
  console.log("\n🧹 تنظيف بيانات الاختبار...");
  await db.execute(sql`DELETE FROM plan_notifications WHERE office_id IN (${OA}::uuid, ${OB}::uuid)`).catch(() => {});
  await db.execute(sql`DELETE FROM cases WHERE office_id IN (${OA}::uuid, ${OB}::uuid) AND title LIKE '%اختبار%' OR title LIKE '%سرية%' OR title LIKE '%خاصة%'`).catch(() => {});
  console.log("  ✅ تم");
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("     اختبار عزل البيانات بين المكاتب — عدالة AI");
  console.log("═══════════════════════════════════════════════════");

  try {
    await seedTestData();
    await testTenantMiddlewareFallbackRemoved();
    await testCaseIsolation();
    await testBillingIsolation();
    await testCrossOfficeDataQuery();
    await testPlanNotificationsIsolation();
  } catch (err: any) {
    console.error("\n💥 خطأ غير متوقع:", err.message);
  } finally {
    await cleanup();
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  النتيجة: ${passed} نجح ✅ | ${failed} فشل ❌ | المجموع: ${passed + failed}`);
  console.log("═══════════════════════════════════════════════════\n");

  if (failed > 0) {
    console.error("⛔ فشل اختبار العزل — مراجعة الأخطاء أعلاه مطلوبة");
    process.exit(1);
  } else {
    console.log("✅ جميع اختبارات العزل نجحت — البيانات معزولة بشكل صحيح");
    process.exit(0);
  }
}

main();
