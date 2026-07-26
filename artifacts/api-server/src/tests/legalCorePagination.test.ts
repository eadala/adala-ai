/**
 * Legal-core list pagination (Task 10.4.2).
 * Run: pnpm --filter @workspace/api-server run test:legal-core-pagination
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_PAGE_LIMIT,
  parsePageLimit,
  queryHasPageAndLimit,
} from "../lib/paginationSafety";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADALA = join(ROOT, "../../adala/src");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function readAdala(rel: string) {
  return readFileSync(join(ADALA, rel), "utf8");
}

console.log("\n═══ parsePageLimit / queryHasPageAndLimit ═══");

{
  assert.equal(MAX_PAGE_LIMIT, 200);
  assert.equal(queryHasPageAndLimit({}), false);
  assert.equal(queryHasPageAndLimit({ page: "1" }), false);
  assert.equal(queryHasPageAndLimit({ limit: "50" }), false);
  assert.equal(queryHasPageAndLimit({ page: "1", limit: "50" }), true);
  assert.equal(queryHasPageAndLimit({ page: "", limit: "50" }), false);

  assert.deepEqual(parsePageLimit({ page: "1", limit: "50" }, 50), {
    page: 1,
    limit: 50,
    offset: 0,
  });
  assert.deepEqual(parsePageLimit({ page: "3", limit: "25" }, 50), {
    page: 3,
    limit: 25,
    offset: 50,
  });
  assert.deepEqual(parsePageLimit({ page: "2", limit: "201" }, 50), {
    page: 2,
    limit: 200,
    offset: 200,
  });
  assert.deepEqual(parsePageLimit({ page: "0", limit: "50" }, 50), {
    page: 1,
    limit: 50,
    offset: 0,
  });
  assert.deepEqual(parsePageLimit({ page: "-1", limit: "50" }, 50), {
    page: 1,
    limit: 50,
    offset: 0,
  });
  assert.deepEqual(parsePageLimit({ page: "abc", limit: "xyz" }, 50), {
    page: 1,
    limit: 50,
    offset: 0,
  });
  assert.deepEqual(parsePageLimit({ page: "1", limit: "0" }, 50), {
    page: 1,
    limit: 50,
    offset: 0,
  });
  console.log("  ✅ page/limit dual-mode helpers OK");
}

console.log("\n═══ backend dual-mode wiring ═══");

{
  const tasks = read("modules/operations/tasks.ts");
  const contracts = read("modules/legal-core/contracts.ts");
  const cases = read("modules/legal-core/cases.ts");
  const clients = read("modules/legal-core/clients.ts");
  const documents = read("modules/legal-core/documents.ts");

  for (const [name, src] of [
    ["tasks", tasks],
    ["contracts", contracts],
    ["cases", cases],
    ["clients", clients],
    ["documents", documents],
  ] as const) {
    assert.match(src, /queryHasPageAndLimit/, `${name} dual-mode gate`);
    assert.match(src, /parsePageLimit/, `${name} safe page/limit`);
  }

  /* Tasks: SQL LIMIT/OFFSET + matching COUNT + preserved order */
  const tasksGet = tasks.slice(tasks.indexOf('router.get("/office-tasks"'), tasks.indexOf('router.get("/office-tasks/stats"'));
  assert.match(tasksGet, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.match(tasksGet, /COUNT\(\*\)/);
  assert.match(tasks, /CASE priority WHEN 'urgent'/);
  assert.match(tasksGet, /\$\{TASK_ORDER\}/);
  assert.match(tasksGet, /res\.json\(rows\)/);
  assert.match(tasksGet, /data: rows/);
  assert.doesNotMatch(tasksGet, /\.slice\(/);

  /* Contracts: parameterized LIMIT/OFFSET + COUNT + array fallback */
  const contractsGet = contracts.slice(
    contracts.indexOf('router.get("/contracts"'),
    contracts.indexOf('router.get("/contracts/:id"'),
  );
  assert.match(contractsGet, /LIMIT \$\$\{p\.length \+ 1\} OFFSET \$\$\{p\.length \+ 2\}/);
  assert.match(contractsGet, /ORDER BY c\.created_at DESC/);
  assert.match(contractsGet, /COUNT\(\*\)::int AS total/);
  assert.match(contractsGet, /res\.json\(rows\)/);
  assert.match(contractsGet, /data: rows/);

  /* Cases: no parseInt clamp; dual-mode envelope preserved */
  const casesGet = cases.slice(cases.indexOf('router.get("/cases"'), cases.indexOf('router.get("/cases/stats"'));
  assert.doesNotMatch(casesGet, /parseInt\(String\(req\.query\.page/);
  assert.match(casesGet, /countCases/);
  assert.match(casesGet, /data: cases\.map\(serializeCase\)/);
  assert.match(casesGet, /res\.json\(cases\.map\(serializeCase\)\)/);

  /* Clients: soft array default 100; paginated default 50; type/status filters */
  const clientsGet = clients.slice(clients.indexOf('router.get("/clients"'), clients.indexOf('router.post("/clients"'));
  assert.match(clientsGet, /parsePageLimit\(req\.query,\s*50\)/);
  assert.match(clientsGet, /limit:\s*100/);
  assert.match(clientsGet, /type = \$\{type\}/);
  assert.match(clientsGet, /status = \$\{status\}/);
  assert.match(clientsGet, /deleted_at IS NULL/);
  assert.match(clientsGet, /res\.json\(clients\)/);
  assert.match(clientsGet, /data: clients/);

  /* Documents: legal docs only; soft cap + envelope; case lookup scoped */
  const documentsGet = documents.slice(
    documents.indexOf('router.get("/documents"'),
    documents.indexOf('router.post("/documents"'),
  );
  assert.match(documentsGet, /parsePageLimit\(req\.query,\s*50\)/);
  assert.match(documentsGet, /MAX_PAGE_LIMIT/);
  assert.match(documentsGet, /\.limit\(limit\)/);
  assert.match(documentsGet, /\.offset\(offset\)/);
  assert.match(documentsGet, /inArray\(casesTable\.id, caseIds\)/);
  assert.match(documentsGet, /res\.json\(mapped\)/);
  assert.match(documentsGet, /data: mapped/);
  assert.doesNotMatch(documents, /storage\/files/);

  console.log("  ✅ tasks/contracts/cases/clients/documents dual-mode OK");
}

console.log("\n═══ frontend consumers send page+limit ═══");

{
  const tasks = readAdala("pages/operations/tasks.tsx");
  const cases = readAdala("pages/legal-core/cases.tsx");
  const clients = readAdala("pages/legal-core/clients.tsx");
  const contracts = readAdala("pages/legal-core/contracts.tsx");
  const documents = readAdala("pages/legal-core/documents.tsx");
  const pager = readAdala("components/list-pagination.tsx");

  assert.match(pager, /data-testid="list-pagination"/);
  assert.match(pager, /السابق/);
  assert.match(pager, /التالي/);
  assert.match(pager, /LEGAL_LIST_PAGE_SIZE = 50/);

  assert.match(tasks, /ListPagination/);
  assert.match(tasks, /p\.set\("page"/);
  assert.match(tasks, /LEGAL_LIST_PAGE_SIZE/);
  assert.match(tasks, /setPage\(1\)/);

  assert.match(cases, /ListPagination/);
  assert.match(cases, /p\.set\("page"/);
  assert.match(cases, /p\.set\("limit"/);
  assert.match(cases, /setPage\(1\)/);
  assert.match(cases, /cases-list/);

  assert.match(clients, /ListPagination/);
  assert.match(clients, /page: String\(page\)/);
  assert.match(clients, /clients-stats/);
  assert.match(clients, /setPage\(1\)/);

  assert.match(contracts, /ListPagination/);
  assert.match(contracts, /page: String\(page\)/);
  assert.match(contracts, /setPage\(1\)/);

  assert.match(documents, /ListPagination/);
  assert.match(documents, /page: String\(legacyPage\)/);
  assert.match(documents, /\/api\/documents\?/);
  assert.doesNotMatch(documents, /useListDocuments/);

  console.log("  ✅ primary list pages wire pagination controls");
}

console.log("\n✅ legalCorePagination tests passed\n");
