/**
 * Guard: caseAutopilot task context fetch must be tenant-scoped.
 * Regression for residual inventing/cross-office task listing.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "agents/caseAutopilot.ts"), "utf8");

test("fetchCaseContext tasks query includes office_id tenant scope", () => {
  assert.match(
    src,
    /FROM tasks WHERE[\s\S]*office_id\s*=\s*\$\{tenantId\}/,
    "tasks context query must filter by office_id = tenantId",
  );
});

test("fetchCaseContext tasks query must not allow OR case_title IS NOT NULL alone", () => {
  assert.doesNotMatch(
    src,
    /FROM tasks WHERE case_title ILIKE[\s\S]*OR case_title IS NOT NULL LIMIT/,
    "unscoped OR case_title IS NOT NULL must not remain",
  );
});
