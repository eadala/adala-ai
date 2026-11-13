/**
 * Tenant fallback removal — auth.userId must never stand in for an office id.
 * Run: node src/tests/tenantFallbackRemoval.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const USERID_FALLBACK_PATTERNS = [
  /\?\?\s*auth\.userId/,
  /\|\|\s*auth\.userId/,
  /\?\?\s*req\.auth\?\.userId/,
  /\|\|\s*req\.auth\?\.userId/,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tests") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) out.push(full);
  }
  return out;
}

const targets = [
  "modules/operations/messages.ts",
  "modules/marketplace/client-portal.ts",
  "modules/marketplace/client-auth.ts",
  "modules/operations/storage.ts",
];

for (const rel of targets) {
  const src = readFileSync(join(SRC, rel), "utf8");
  for (const pattern of USERID_FALLBACK_PATTERNS) {
    assert.doesNotMatch(src, pattern, `${rel} must not use ${pattern}`);
  }
  assert.match(src, /resolveTenantId/, `${rel} must wire resolveTenantId`);
}

const allSrc = walk(SRC);
const offenders = [];
for (const file of allSrc) {
  const content = readFileSync(file, "utf8");
  for (const pattern of USERID_FALLBACK_PATTERNS) {
    if (pattern.test(content)) offenders.push(`${relative(SRC, file)} matches ${pattern}`);
  }
}
assert.deepEqual(offenders, [], `no auth.userId tenant fallbacks remain:\n${offenders.join("\n")}`);

console.log(`✅ tenantFallbackRemoval: scanned helpers + ${allSrc.length} src files — clean`);
