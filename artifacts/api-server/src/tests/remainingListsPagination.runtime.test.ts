/**
 * Runtime contract tests for remaining-lists pagination (Task 10.4.4 fixes).
 * These exercise helpers in-memory — not static source scans.
 * Run: pnpm --filter @workspace/api-server run test:remaining-lists-pagination-runtime
 */
import assert from "node:assert/strict";
import {
  MAX_PAGE_LIMIT,
  dualModeEffectiveBounds,
  filterBySearchFields,
  filterByStatus,
  filterLedgerRows,
  listPageEnvelope,
  paginateFilteredDataset,
  parseOptionalEq,
  parseOptionalSearch,
  resolveDualModePaging,
  sortCreatedAtDescIdDesc,
} from "../lib/paginationSafety";

console.log("\n═══ runtime: page boundaries ═══");
{
  assert.deepEqual(resolveDualModePaging({ page: "1", limit: "50" }, 50), {
    paginated: true,
    page: 1,
    limit: 50,
    offset: 0,
  });
  assert.deepEqual(resolveDualModePaging({ page: "3", limit: "25" }, 50), {
    paginated: true,
    page: 3,
    limit: 25,
    offset: 50,
  });
  /* clamp oversize limit */
  assert.deepEqual(resolveDualModePaging({ page: "1", limit: "999" }, 50), {
    paginated: true,
    page: 1,
    limit: MAX_PAGE_LIMIT,
    offset: 0,
  });
  /* invalid page → 1 */
  assert.deepEqual(resolveDualModePaging({ page: "0", limit: "50" }, 50).page, 1);
  assert.deepEqual(resolveDualModePaging({ page: "-2", limit: "50" }, 50).page, 1);
  /* last-page offset past end still computes; slice returns [] */
  const past = resolveDualModePaging({ page: "99", limit: "50" }, 50);
  assert.equal(past.offset, 4900);
  console.log("  ✅ page boundaries OK");
}

console.log("\n═══ runtime: pagination envelopes ═══");
{
  const env = listPageEnvelope(["a", "b"], 101, 2, 50);
  assert.deepEqual(env, {
    data: ["a", "b"],
    total: 101,
    page: 2,
    limit: 50,
    pages: 3,
  });
  assert.equal(listPageEnvelope([], 0, 1, 50).pages, 1);
  console.log("  ✅ envelopes OK");
}

console.log("\n═══ runtime: attendance array soft-cap 500 ═══");
{
  const paging = resolveDualModePaging({}, 50);
  assert.equal(paging.paginated, false);
  assert.deepEqual(dualModeEffectiveBounds(paging, 500), { limit: 500, offset: 0 });
  const paged = resolveDualModePaging({ page: "2", limit: "50" }, 50);
  assert.deepEqual(dualModeEffectiveBounds(paged, 500), { limit: 50, offset: 50 });
  console.log("  ✅ attendance soft-cap contract OK");
}

console.log("\n═══ runtime: filter parsers ═══");
{
  assert.equal(parseOptionalEq("all"), null);
  assert.equal(parseOptionalEq(""), null);
  assert.equal(parseOptionalEq("  pending "), "pending");
  assert.equal(parseOptionalSearch("  "), null);
  assert.equal(parseOptionalSearch("foo"), "foo");
  console.log("  ✅ parsers OK");
}

console.log("\n═══ runtime: backend filtering + COUNT parity ═══");
{
  const ledger = [
    { id: "1", title: "أتعاب قضية", category: "أتعاب محاماة", createdAt: "2026-01-02T00:00:00Z" },
    { id: "2", title: "استشارة", category: "استشارات قانونية", createdAt: "2026-01-03T00:00:00Z" },
    { id: "3", title: "أتعاب عقد", category: "أتعاب محاماة", createdAt: "2026-01-01T00:00:00Z" },
    { id: "4", title: "أخرى", category: "إيرادات متنوعة", createdAt: "2026-01-04T00:00:00Z" },
  ];

  const search = parseOptionalSearch("أتعاب");
  const category = parseOptionalEq("أتعاب محاماة");
  const filtered = filterLedgerRows(ledger, { search, category });
  /* COUNT must equal filtered length (parity) */
  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((r) => r.id).sort(),
    ["1", "3"],
  );

  const sorted = sortCreatedAtDescIdDesc(filtered);
  const page1 = paginateFilteredDataset(sorted, { page: "1", limit: "1" }, 50);
  assert.equal(page1.mode, "envelope");
  if (page1.mode === "envelope") {
    assert.equal(page1.total, 2); /* COUNT = full filtered set, not page size */
    assert.equal(page1.data.length, 1);
    assert.equal(page1.pages, 2);
    assert.equal(page1.data[0]?.id, "1"); /* newer of the two */
  }

  const page2 = paginateFilteredDataset(sorted, { page: "2", limit: "1" }, 50);
  if (page2.mode === "envelope") {
    assert.equal(page2.total, 2);
    assert.equal(page2.data[0]?.id, "3");
  }

  /* status filter parity (advances / leaves / warnings) */
  const rows = [
    { id: "a", status: "pending", createdAt: "2026-02-01T00:00:00Z" },
    { id: "b", status: "approved", createdAt: "2026-02-02T00:00:00Z" },
    { id: "c", status: "pending", createdAt: "2026-02-03T00:00:00Z" },
  ];
  const status = parseOptionalEq("pending");
  const pending = filterByStatus(rows, status);
  assert.equal(pending.length, 2);
  const envPending = paginateFilteredDataset(
    sortCreatedAtDescIdDesc(pending),
    { page: "1", limit: "50" },
    50,
  );
  if (envPending.mode === "envelope") {
    assert.equal(envPending.total, pending.length);
    assert.equal(envPending.data.length, pending.length);
  }

  /* warnings-style multi-field search */
  const warnings = [
    { id: "w1", status: "active", createdAt: "2026-03-01T00:00:00Z", employeeName: "أحمد", reason: "تأخير" },
    { id: "w2", status: "active", createdAt: "2026-03-02T00:00:00Z", employeeName: "سارة", reason: "غياب" },
    { id: "w3", status: "closed", createdAt: "2026-03-03T00:00:00Z", employeeName: "أحمد", reason: "مخالفة" },
  ];
  const wSearch = parseOptionalSearch("أحمد");
  const wStatus = parseOptionalEq("active");
  const wFiltered = filterBySearchFields(
    filterByStatus(warnings, wStatus),
    wSearch,
    (w) => [w.employeeName, w.reason],
  );
  assert.equal(wFiltered.length, 1);
  assert.equal(wFiltered[0]?.id, "w1");
  const wEnv = paginateFilteredDataset(wFiltered, { page: "1", limit: "50" }, 50);
  if (wEnv.mode === "envelope") {
    assert.equal(wEnv.total, 1);
  }

  console.log("  ✅ filter + COUNT parity OK");
}

console.log("\n═══ runtime: deterministic ordering (id tie-breaker) ═══");
{
  const sameTs = "2026-05-01T12:00:00.000Z";
  const rows = [
    { id: "b", createdAt: sameTs },
    { id: "a", createdAt: sameTs },
    { id: "c", createdAt: "2026-05-02T12:00:00.000Z" },
  ];
  const sorted = sortCreatedAtDescIdDesc(rows);
  assert.deepEqual(
    sorted.map((r) => r.id),
    ["c", "b", "a"],
    "newer first; equal timestamps fall back to id DESC",
  );

  /* page boundaries stable across equal timestamps */
  const p1 = paginateFilteredDataset(sorted, { page: "1", limit: "2" }, 50);
  const p2 = paginateFilteredDataset(sorted, { page: "2", limit: "2" }, 50);
  if (p1.mode === "envelope" && p2.mode === "envelope") {
    assert.deepEqual(p1.data.map((r) => r.id), ["c", "b"]);
    assert.deepEqual(p2.data.map((r) => r.id), ["a"]);
    assert.equal(p1.total, 3);
    assert.equal(p2.total, 3);
  }
  console.log("  ✅ deterministic ordering OK");
}

console.log("\n═══ runtime: array mode soft-cap vs envelope ═══");
{
  const many = Array.from({ length: 250 }, (_, i) => ({
    id: String(250 - i).padStart(3, "0"),
    createdAt: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
    title: `row-${i}`,
    category: "x",
  }));
  const sorted = sortCreatedAtDescIdDesc(many);
  const arr = paginateFilteredDataset(sorted, {}, 50);
  assert.equal(arr.mode, "array");
  if (arr.mode === "array") {
    assert.equal(arr.data.length, MAX_PAGE_LIMIT);
    assert.equal(arr.total, 250);
  }
  const env = paginateFilteredDataset(sorted, { page: "1", limit: "50" }, 50);
  assert.equal(env.mode, "envelope");
  if (env.mode === "envelope") {
    assert.equal(env.data.length, 50);
    assert.equal(env.total, 250);
    assert.equal(env.pages, 5);
  }
  console.log("  ✅ array soft-cap vs envelope OK");
}

console.log("\n✅ remainingListsPagination runtime tests passed\n");
