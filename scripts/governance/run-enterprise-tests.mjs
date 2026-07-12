#!/usr/bin/env node
/**
 * Enterprise Governance — unified test runner
 * Runs all static contract tests + platform-check in sequence.
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TSX = "pnpm --filter @workspace/scripts exec tsx";

const SUITES = [
  ["tenant-kernel", "../artifacts/api-server/src/tests/tenant-kernel.test.ts"],
  ["tenant-data-access", "../artifacts/api-server/src/tests/tenant-data-access.test.ts"],
  ["legal-core-authz", "../artifacts/api-server/src/tests/legal-core-authz.test.ts"],
  ["financial-ops-authz", "../artifacts/api-server/src/tests/financial-ops-authz.test.ts"],
  ["hr-extended-rbac", "../artifacts/api-server/src/tests/hr-extended-rbac.test.ts"],
  ["payments-authz", "../artifacts/api-server/src/tests/payments-authz.test.ts"],
  ["ai-gateway-rbac", "../artifacts/api-server/src/tests/ai-gateway-rbac.test.ts"],
  ["enterprise-abuse", "../artifacts/api-server/src/tests/enterprise-abuse.test.ts"],
];

let failed = 0;

console.log("═".repeat(55));
console.log("  Enterprise Governance Test Suite");
console.log("═".repeat(55));

for (const [name, rel] of SUITES) {
  process.stdout.write(`\n▶ ${name}... `);
  const r = spawnSync(`${TSX} ${rel}`, {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status === 0) {
    console.log("PASS");
  } else {
    console.log("FAIL");
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.stdout) process.stdout.write(r.stdout);
    failed++;
  }
}

process.stdout.write("\n▶ platform-check... ");
const pc = spawnSync("node scripts/governance/platform-check.mjs", {
  cwd: ROOT,
  shell: true,
  encoding: "utf8",
});
if (pc.status === 0) {
  console.log("PASS");
} else {
  console.log("FAIL");
  failed++;
}

console.log("\n" + "═".repeat(55));
if (failed === 0) {
  console.log("✅ All enterprise governance checks passed");
  process.exit(0);
}
console.log(`❌ ${failed} suite(s) failed`);
process.exit(1);
