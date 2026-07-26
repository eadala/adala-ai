/**
 * Frontend legal-core pagination wiring (Task 10.4.2).
 * Run: pnpm --filter @workspace/adala run test:legal-core-pagination
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(SRC, rel), "utf8");
}

console.log("\n═══ shared ListPagination ═══");
{
  const pager = read("components/list-pagination.tsx");
  assert.match(pager, /export function ListPagination/);
  assert.match(pager, /disabled=\{safePage <= 1\}/);
  assert.match(pager, /disabled=\{safePage >= pages \|\| total <= 0\}/);
  assert.match(pager, /dir = "rtl"/);
  assert.match(pager, /LEGAL_LIST_PAGE_SIZE = 50/);
  console.log("  ✅ shared control disables prev/next correctly");
}

console.log("\n═══ filter reset + page params ═══");
{
  const pages = [
    "pages/operations/tasks.tsx",
    "pages/legal-core/cases.tsx",
    "pages/legal-core/clients.tsx",
    "pages/legal-core/contracts.tsx",
    "pages/legal-core/documents.tsx",
  ];
  for (const rel of pages) {
    const src = read(rel);
    assert.match(src, /ListPagination/, rel);
    assert.match(src, /setPage\(1\)|setLegacyPage\(1\)/, `${rel} resets page on filter change`);
    assert.match(src, /LEGAL_LIST_PAGE_SIZE/, rel);
  }
  console.log("  ✅ five scoped pages preserve filters via query keys + reset page");
}

console.log("\n✅ legalCorePaginationUi tests passed\n");
