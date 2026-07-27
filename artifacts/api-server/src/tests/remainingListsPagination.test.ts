/**
 * Remaining lists pagination (Task 10.4.4).
 * Run: pnpm --filter @workspace/api-server run test:remaining-lists-pagination
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_PAGE_LIMIT,
  listPageEnvelope,
  queryHasPageAndLimit,
  resolveDualModePaging,
} from "../lib/paginationSafety";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADALA = join(ROOT, "../../adala/src");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function readAdala(rel: string) {
  return readFileSync(join(ADALA, rel), "utf8");
}

console.log("\n═══ resolveDualModePaging / listPageEnvelope ═══");
{
  assert.equal(MAX_PAGE_LIMIT, 200);
  assert.equal(queryHasPageAndLimit({ page: "1", limit: "50" }), true);
  assert.deepEqual(resolveDualModePaging({ page: "2", limit: "50" }, 50), {
    paginated: true,
    page: 2,
    limit: 50,
    offset: 50,
  });
  assert.deepEqual(resolveDualModePaging({}, 50), {
    paginated: false,
    page: 1,
    limit: 200,
    offset: 0,
  });
  assert.deepEqual(resolveDualModePaging({ limit: "50" }, 50), {
    paginated: false,
    page: 1,
    limit: 200,
    offset: 0,
  });
  assert.deepEqual(listPageEnvelope(["a"], 101, 1, 50), {
    data: ["a"],
    total: 101,
    page: 1,
    limit: 50,
    pages: 3,
  });
  console.log("  ✅ dual-mode helpers OK");
}

const dualFiles: Array<{ name: string; path: string; markers: RegExp[] }> = [
  {
    name: "hr",
    path: "modules/operations/hr.ts",
    markers: [
      /resolveDualModePaging/,
      /listPageEnvelope/,
      /\/hr\/employees/,
      /\/hr\/leaves/,
      /\/hr\/payroll/,
      /\/hr\/warnings/,
      /\/hr\/investigations/,
      /\/hr\/attendance/,
      /LIMIT \$\{limit\} OFFSET \$\{offset\}/,
      /COUNT\(\*\)::int AS total/,
    ],
  },
  {
    name: "accounting",
    path: "modules/financial/accounting.ts",
    markers: [
      /resolveDualModePaging/,
      /\/accounting\/revenues/,
      /\/accounting\/expenses/,
      /\/accounting\/advances/,
      /LIMIT \$\{limit\} OFFSET \$\{offset\}/,
    ],
  },
  {
    name: "credit-notes",
    path: "modules/financial/financial-completions.ts",
    markers: [/resolveDualModePaging/, /\/accounting\/credit-notes/, /listPageEnvelope/],
  },
  {
    name: "arbitration",
    path: "modules/legal-core/arbitration.ts",
    markers: [/resolveDualModePaging/, /listPageEnvelope/, /\.limit\(limit\)/, /\.offset\(offset\)/],
  },
  {
    name: "mediators",
    path: "modules/legal-core/mediators.ts",
    markers: [/resolveDualModePaging/, /\/mediators\/tasks/, /\/mediators\/my-tasks/],
  },
  {
    name: "smart-documents",
    path: "modules/legal-core/smart-documents.ts",
    markers: [/resolveDualModePaging/, /listPageEnvelope/, /LIMIT \$\{limit\} OFFSET \$\{offset\}/],
  },
  {
    name: "reminders",
    path: "modules/legal-core/reminders.ts",
    markers: [/resolveDualModePaging/, /listPageEnvelope/, /LIMIT \$\{limit\} OFFSET \$\{offset\}/],
  },
  {
    name: "bankruptcy",
    path: "modules/bankruptcy/bankruptcyV3.ts",
    markers: [/resolveDualModePaging/, /opening-requests/, /LIMIT \$\{limit\} OFFSET \$\{offset\}/],
  },
  {
    name: "aiTasks",
    path: "modules/ai/aiTasks.ts",
    markers: [/resolveDualModePaging/, /listPageEnvelope/, /\.limit\(limit\)/, /\.offset\(offset\)/],
  },
  {
    name: "admin",
    path: "modules/platform/admin.ts",
    markers: [
      /resolveDualModePaging/,
      /\/admin\/offices/,
      /\/admin\/users/,
      /\/admin\/support/,
      /LIMIT 200/,
    ],
  },
];

console.log("\n═══ dual-mode backend wiring ═══");
{
  for (const f of dualFiles) {
    const src = read(f.path);
    for (const m of f.markers) {
      assert.match(src, m, `${f.name} missing ${m}`);
    }
  }
  console.log("  ✅ must-paginate endpoints use dual-mode helper");
}

console.log("\n═══ soft-cap endpoints ═══");
{
  const cases = read("modules/legal-core/cases.ts");
  const timeline = read("case/modules/timeline.ts");
  const comms = read("case/modules/communications.ts");
  const tasks = read("case/modules/tasks.ts");
  const docs = read("case/modules/documents.ts");
  const calendar = read("modules/operations/calendar.ts");
  const support = read("modules/platform/support-enterprise.ts");
  const hrInternal = read("modules/operations/hrInternal.ts");
  const hrPerf = read("modules/operations/hrPerformance.ts");
  const admin = read("modules/platform/admin.ts");

  /* Nested / ancillary lists must remain unbounded (no MAX_PAGE_LIMIT soft-cap). */
  assert.doesNotMatch(cases, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(timeline, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(comms, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(tasks, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(docs, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(calendar, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(hrInternal, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(hrPerf, /MAX_PAGE_LIMIT/);
  assert.doesNotMatch(admin, /\.limit\(MAX_PAGE_LIMIT\)/);
  assert.doesNotMatch(admin, /LIMIT \$\{MAX_PAGE_LIMIT\}/);
  assert.match(support, /parseLimitOffset\(req\.query,\s*50\)/);
  assert.match(support, /ORDER BY t\.created_at DESC, t\.id DESC/);
  console.log("  ✅ unbounded nested lists restored; support clamp retained");
}

console.log("\n═══ COUNT predicates share list filters (HR employees) ═══");
{
  const hr = read("modules/operations/hr.ts");
  /* searchCond/deptCond/statusCond appear in both list and COUNT */
  const empBlock = hr.slice(
    hr.indexOf('router.get("/hr/employees"'),
    hr.indexOf('router.get("/hr/employees/stats"'),
  );
  assert.match(empBlock, /searchCond.*deptCond.*statusCond/s);
  assert.equal(
    (empBlock.match(/\$\{searchCond\} \$\{deptCond\} \$\{statusCond\}/g) ?? []).length,
    2,
    "employees list + COUNT must both apply filter conds",
  );
  console.log("  ✅ employees list/COUNT share filters");
}

console.log("\n═══ filter + COUNT parity (accounting / HR / arbitration / AI) ═══");
{
  const accounting = read("modules/financial/accounting.ts");
  const hr = read("modules/operations/hr.ts");
  const arbitration = read("modules/legal-core/arbitration.ts");
  const aiTasks = read("modules/ai/aiTasks.ts");

  const revBlock = accounting.slice(
    accounting.indexOf('router.get("/accounting/revenues"'),
    accounting.indexOf('router.post("/accounting/revenues"'),
  );
  assert.equal(
    (revBlock.match(/\$\{searchCond\} \$\{categoryCond\}/g) ?? []).length,
    2,
    "revenues list + COUNT must share search/category",
  );
  assert.match(revBlock, /ORDER BY date DESC, created_at DESC, id DESC/);

  const leavesBlock = hr.slice(
    hr.indexOf('router.get("/hr/leaves"'),
    hr.indexOf('router.get("/hr/leaves/stats"'),
  );
  assert.equal(
    (leavesBlock.match(/\$\{statusCond\}/g) ?? []).length,
    2,
    "leaves list + COUNT must share statusCond",
  );
  assert.match(leavesBlock, /ORDER BY l\.created_at DESC, l\.id DESC/);

  const attBlock = hr.slice(
    hr.indexOf('router.get("/hr/attendance"'),
    hr.indexOf('router.get("/hr/attendance/stats"'),
  );
  assert.match(attBlock, /effectiveLimit = paginated \? limit : 500/);
  assert.match(attBlock, /LIMIT \$\{effectiveLimit\} OFFSET \$\{effectiveOffset\}/);

  assert.match(arbitration, /req\.query\.type/);
  assert.match(arbitration, /desc\(arbitrationCasesTable\.id\)/);
  assert.match(aiTasks, /req\.query\.search/);
  assert.match(aiTasks, /ilike\(aiTasksTable\.type/);
  assert.match(aiTasks, /asc\(aiTasksTable\.id\)/);
  console.log("  ✅ filter/COUNT parity + id tie-breakers + attendance 500");
}

console.log("\n═══ frontend primary consumers ═══");
{
  const pages = [
    "pages/hr/employees.tsx",
    "pages/hr/leaves.tsx",
    "pages/hr/payroll.tsx",
    "pages/financial/revenues.tsx",
    "pages/financial/expenses.tsx",
    "pages/financial/advances.tsx",
    "pages/legal-core/arbitration.tsx",
    "pages/legal-core/warnings.tsx",
    "pages/legal-core/reminders.tsx",
    "pages/ai/ai-tasks.tsx",
  ];
  for (const p of pages) {
    const src = readAdala(p);
    assert.match(src, /ListPagination/, `${p} ListPagination`);
    assert.match(src, /LEGAL_LIST_PAGE_SIZE/, `${p} page size`);
    assert.match(src, /page:\s*String\(/, `${p} page param`);
  }
  /* Pickers must still omit page+limit (soft-cap array). */
  const attendance = readAdala("pages/hr/attendance.tsx");
  assert.match(attendance, /authFetch\("\/api\/hr\/employees"\)/);
  assert.doesNotMatch(
    attendance,
    /hr\/employees\?.*page=/,
    "attendance employee picker must not force page+limit",
  );
  console.log("  ✅ primary FE pages send page+limit; pickers stay array-mode");
}

console.log("\n✅ remainingListsPagination tests passed\n");
