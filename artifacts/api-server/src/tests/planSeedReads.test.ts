/**
 * Plan CMS seed: empty-table init only; non-empty GET /plans is read-only.
 * Run: pnpm --filter @workspace/api-server run test:plan-seed-reads
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL ??= "postgresql://mock:mock@127.0.0.1:5432/mock";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const planCmsSrc = readFileSync(join(SRC, "modules/platform/planCms.ts"), "utf8");

const { DEFAULT_PLANS, ensurePlanSeed, getDbPlans } = await import("../modules/platform/planCms");

type Captured = { text: string; kind: "count" | "insert" | "update" | "select" | "other" };

function queryText(q: unknown): string {
  try {
    return JSON.stringify(q);
  } catch {
    return String(q);
  }
}

function classify(text: string): Captured["kind"] {
  if (/SELECT COUNT\(\*\)/.test(text) && /plan_cms/.test(text)) return "count";
  if (/INSERT INTO plan_cms/.test(text)) return "insert";
  if (/UPDATE plan_cms/.test(text)) return "update";
  if (/SELECT \* FROM plan_cms/.test(text)) return "select";
  return "other";
}

function createMockDb(opts: {
  count: number;
  rows?: Record<string, unknown>[];
  storeInserts?: boolean;
}) {
  const captured: Captured[] = [];
  const rows = [...(opts.rows ?? [])];
  let count = opts.count;
  let insertIndex = 0;

  const db = {
    captured,
    rows,
    execute: async (q: unknown) => {
      const text = queryText(q);
      const kind = classify(text);
      captured.push({ text, kind });

      if (kind === "count") {
        return [{ cnt: count }];
      }
      if (kind === "insert") {
        if (opts.storeInserts) {
          const plan = DEFAULT_PLANS[insertIndex++];
          if (plan && !rows.some((r) => r.id === plan.id)) {
            rows.push({
              id: plan.id,
              name_ar: plan.nameAr,
              name_en: plan.nameEn,
              monthly_price: plan.monthlyPrice,
              yearly_price: plan.yearlyPrice,
              color: plan.color,
              description: plan.description,
              badge: plan.badge,
              features: plan.features,
              recommended: plan.recommended,
              is_contact_only: plan.isContactOnly,
              sort_order: plan.sortOrder,
              feature_flags: plan.featureFlags,
              limits: plan.limits,
            });
            count = rows.length;
          }
        }
        return [];
      }
      if (kind === "select") {
        return rows.slice().sort(
          (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
        );
      }
      if (kind === "update") {
        return [];
      }
      return [];
    },
  };
  return db;
}

function customPlanRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "free",
    name_ar: "باقة معدّلة",
    name_en: "Custom Explorer",
    monthly_price: 42,
    yearly_price: 420,
    color: "#111111",
    description: "admin-edited",
    badge: "custom",
    features: ["only-custom"],
    recommended: false,
    is_contact_only: false,
    sort_order: 0,
    feature_flags: { cases: false, customOnly: true },
    limits: { users: 99, storage: "custom", aiRequests: 1, branches: 7 },
    ...overrides,
  };
}

console.log("\n═══ source: empty-table guard, no non-empty writes ═══");

{
  assert.match(planCmsSrc, /SELECT COUNT\(\*\) as cnt FROM plan_cms/);
  assert.match(planCmsSrc, /if \(cnt !== 0\) return/);
  assert.doesNotMatch(
    planCmsSrc,
    /Backfill feature_flags\/limits for existing rows/,
    "non-empty UPDATE backfill must be removed",
  );
  assert.doesNotMatch(
    planCmsSrc,
    /Always insert new plans \(e\.g\. bk-\*\)/,
    "non-empty bk-* INSERT backfill must be removed",
  );
  /* UPDATE remains only on intentional admin routes */
  const ensureBody = planCmsSrc.slice(
    planCmsSrc.indexOf("export async function ensurePlanSeed"),
    planCmsSrc.indexOf("function rowToPlan"),
  );
  assert.doesNotMatch(ensureBody, /\bUPDATE\b/, "ensurePlanSeed must not UPDATE");
  console.log("  ✅ ensurePlanSeed is empty-table INSERT only");
}

console.log("\n═══ empty plans table: initialization ═══");

{
  const mock = createMockDb({ count: 0, storeInserts: true });
  await ensurePlanSeed({ db: mock });

  const inserts = mock.captured.filter((c) => c.kind === "insert");
  const updates = mock.captured.filter((c) => c.kind === "update");
  assert.equal(mock.captured.filter((c) => c.kind === "count").length, 1);
  assert.equal(inserts.length, DEFAULT_PLANS.length, "must INSERT every canonical default plan");
  assert.equal(updates.length, 0, "empty seed must not UPDATE");
  assert.equal(mock.rows.length, DEFAULT_PLANS.length);

  const plans = await getDbPlans({ db: mock });
  assert.equal(plans.length, DEFAULT_PLANS.length);
  assert.ok(plans.every((p: { id: string }) => DEFAULT_PLANS.some((d) => d.id === p.id)));
  assert.equal(plans[0].id, "free");
  assert.equal(typeof plans[0].monthlyPrice, "number");
  assert.ok("featureFlags" in plans[0]);
  assert.ok("limits" in plans[0]);
  assert.ok("nameAr" in plans[0]);
  assert.ok("isContactOnly" in plans[0]);
  console.log("  ✅ empty table seeds canonical plans; GET shape intact");
}

console.log("\n═══ non-empty plans table: no writes ═══");

{
  const existing = [
    customPlanRow(),
    customPlanRow({
      id: "pro",
      name_ar: "معدّل برو",
      monthly_price: 1234,
      sort_order: 2,
      feature_flags: { ai: true, adminEdited: true },
      limits: { users: 3 },
    }),
  ];
  const mock = createMockDb({ count: existing.length, rows: existing });

  await ensurePlanSeed({ db: mock });
  assert.equal(mock.captured.filter((c) => c.kind === "count").length, 1);
  assert.equal(mock.captured.filter((c) => c.kind === "insert").length, 0);
  assert.equal(mock.captured.filter((c) => c.kind === "update").length, 0);

  const plans = await getDbPlans({ db: mock });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].nameAr, "باقة معدّلة");
  assert.equal(plans[0].monthlyPrice, 42);
  assert.deepEqual(plans[0].featureFlags, { cases: false, customOnly: true });
  assert.deepEqual(plans[0].limits, { users: 99, storage: "custom", aiRequests: 1, branches: 7 });
  assert.equal(plans[1].monthlyPrice, 1234);
  assert.deepEqual(plans[1].featureFlags, { ai: true, adminEdited: true });

  const writesAfterRead = mock.captured.filter((c) => c.kind === "insert" || c.kind === "update");
  assert.equal(writesAfterRead.length, 0, "getDbPlans on non-empty must not write");
  console.log("  ✅ non-empty table: no INSERT/UPDATE; custom values preserved");
}

console.log("\n═══ repeated GET /plans after init: no extra writes ═══");

{
  const mock = createMockDb({ count: 0, storeInserts: true });
  const first = await getDbPlans({ db: mock });
  assert.ok(first.length >= DEFAULT_PLANS.length || first.length === mock.rows.length);

  const insertsAfterFirst = mock.captured.filter((c) => c.kind === "insert").length;
  const updatesAfterFirst = mock.captured.filter((c) => c.kind === "update").length;
  assert.ok(insertsAfterFirst > 0, "first call on empty must insert");
  assert.equal(updatesAfterFirst, 0);

  const snapshot = mock.captured.length;
  const second = await getDbPlans({ db: mock });
  const third = await getDbPlans({ db: mock });

  assert.equal(second.length, first.length);
  assert.equal(third.length, first.length);
  assert.deepEqual(second[0], first[0]);

  const insertsAfter = mock.captured.slice(snapshot).filter((c) => c.kind === "insert");
  const updatesAfter = mock.captured.slice(snapshot).filter((c) => c.kind === "update");
  assert.equal(insertsAfter.length, 0, "repeated reads must not INSERT");
  assert.equal(updatesAfter.length, 0, "repeated reads must not UPDATE");
  assert.ok(
    mock.captured.slice(snapshot).every((c) => c.kind === "count" || c.kind === "select"),
    "post-init calls may only COUNT and SELECT",
  );
  console.log("  ✅ repeated getDbPlans after seed is read-only");
}

console.log("\n═══ API compatibility shape ═══");

{
  const mock = createMockDb({
    count: 1,
    rows: [customPlanRow({ recommended: true, monthly_price: 0 })],
  });
  const [plan] = await getDbPlans({ db: mock });
  for (const key of [
    "id",
    "nameAr",
    "nameEn",
    "name",
    "monthlyPrice",
    "yearlyPrice",
    "price",
    "color",
    "description",
    "badge",
    "features",
    "featureFlags",
    "limits",
    "recommended",
    "popular",
    "isContactOnly",
    "sortOrder",
    "isFree",
  ]) {
    assert.ok(key in plan, `response must include ${key}`);
  }
  assert.equal(plan.popular, true);
  assert.equal(plan.isFree, true);
  assert.equal(plan.price, plan.monthlyPrice);
  console.log("  ✅ rowToPlan public shape unchanged");
}

console.log("\n✅ planSeedReads tests passed\n");
