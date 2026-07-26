/**
 * Pagination safety — clamp limit/offset on existing paginated endpoints.
 * Run: pnpm --filter @workspace/api-server run test:pagination-safety
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_PAGE_LIMIT, parseLimitOffset } from "../lib/paginationSafety";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(SRC, rel), "utf8");
}

console.log("\n═══ parseLimitOffset: limit policy ═══");

{
  assert.equal(MAX_PAGE_LIMIT, 200);
  assert.deepEqual(parseLimitOffset({}, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: undefined, offset: undefined }, 50), {
    limit: 50,
    offset: 0,
  });
  assert.deepEqual(parseLimitOffset({ limit: "25" }, 100), { limit: 25, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: 25 }, 100), { limit: 25, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "200" }, 100), { limit: 200, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "201" }, 100), { limit: 200, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "99999" }, 50), { limit: 200, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "0" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: 0 }, 50), { limit: 50, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "-5" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "12.5" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "1e2" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "abc" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "   " }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: NaN }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: null }, 100), { limit: 100, offset: 0 });
  console.log("  ✅ limit omitted/valid/clamped/invalid → policy OK");
}

console.log("\n═══ parseLimitOffset: offset policy ═══");

{
  assert.deepEqual(parseLimitOffset({ offset: "0" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ offset: "40" }, 100), { limit: 100, offset: 40 });
  assert.deepEqual(parseLimitOffset({ offset: 40 }, 100), { limit: 100, offset: 40 });
  assert.deepEqual(parseLimitOffset({ offset: "-1" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ offset: "3.14" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ offset: "nope" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ offset: "" }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ offset: NaN }, 100), { limit: 100, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "10", offset: "5" }, 100), {
    limit: 10,
    offset: 5,
  });
  assert.deepEqual(parseLimitOffset({ limit: "500", offset: "-9" }, 50), {
    limit: 200,
    offset: 0,
  });
  console.log("  ✅ offset omitted/valid/invalid → policy OK");
}

console.log("\n═══ route wiring + response shape preservation ═══");

{
  const storage = read("modules/operations/storage.ts");
  const fincore = read("modules/financial/financialCore.ts");
  const journal = read("modules/financial/journalAccounting.ts");

  assert.match(storage, /import\s*\{\s*parseLimitOffset\s*\}\s*from\s*["'][^"']*paginationSafety["']/);
  assert.match(fincore, /import\s*\{\s*parseLimitOffset\s*\}\s*from\s*["'][^"']*paginationSafety["']/);
  assert.match(journal, /import\s*\{\s*parseLimitOffset\s*\}\s*from\s*["'][^"']*paginationSafety["']/);

  const storageHandler = storage.slice(
    storage.indexOf('router.get("/storage/files"'),
    storage.indexOf("/* Allowed file types"),
  );
  assert.match(storageHandler, /parseLimitOffset\(req\.query,\s*100\)/);
  assert.match(storageHandler, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.doesNotMatch(storageHandler, /parseInt\(limit\)/);
  assert.match(storageHandler, /res\.json\(rows\)/);
  assert.match(storageHandler, /ORDER BY created_at DESC/);

  const fincoreHandler = fincore.slice(
    fincore.indexOf('router.get("/fincore/ledger"'),
    fincore.indexOf("/* POST /api/fincore/ledger"),
  );
  assert.match(fincoreHandler, /parseLimitOffset\(req\.query,\s*100\)/);
  assert.match(fincoreHandler, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.doesNotMatch(fincoreHandler, /Number\(limit\)/);
  assert.match(fincoreHandler, /res\.json\(\{ entries, total:/);
  assert.match(fincoreHandler, /ORDER BY created_at DESC/);

  const journalHandler = journal.slice(
    journal.indexOf('router.get("/accounting/journal/entries"'),
    journal.indexOf("/* قيد يدوي"),
  );
  assert.match(journalHandler, /parseLimitOffset\(req\.query,\s*50\)/);
  assert.match(journalHandler, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.doesNotMatch(journalHandler, /parseInt\(String\(req\.query\.limit/);
  assert.match(journalHandler, /res\.json\(entries\)/);
  assert.match(journalHandler, /ORDER BY e\.entry_date DESC, e\.created_at DESC/);

  console.log("  ✅ storage/fincore/journal use helper with preserved defaults + shapes");
}

console.log("\n✅ paginationSafety tests passed\n");
