/**
 * Event/listener paths must not invent office_id = "default".
 * Run: node src/tests/noDefaultOfficeFallback.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const BAD = [
  /officeId\s*\?\?\s*["']default["']/,
  /office_id\s*\?\?\s*["']default["']/,
  /officeId\s*\|\|\s*["']default["']/,
  /office_id\s*\|\|\s*["']default["']/,
  /officeId\s*=\s*["']default["']/,
];

const roots = [
  join(SRC, "core"),
  join(SRC, "modules/integrations"),
  join(SRC, "modules/ai"),
  join(SRC, "modules/platform"),
];
const extraFiles = [
  join(SRC, "webhookHandlers.ts"),
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tests") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const offenders = [];
const files = [...roots.flatMap((root) => walk(root)), ...extraFiles];
for (const file of files) {
  if (file.endsWith("resolveEventOfficeId.ts")) continue;
  const content = readFileSync(file, "utf8");
  for (const pattern of BAD) {
    if (pattern.test(content)) {
      offenders.push(`${relative(SRC, file)} matches ${pattern}`);
    }
  }
}

assert.deepEqual(offenders, [], `no default-office fallbacks:\n${offenders.join("\n")}`);

const helper = readFileSync(join(SRC, "core/resolveEventOfficeId.ts"), "utf8");
assert.match(helper, /export function resolveEventOfficeId/);
assert.match(helper, /!== "default"/);

console.log("✅ noDefaultOfficeFallback: listeners/integrations clean");
