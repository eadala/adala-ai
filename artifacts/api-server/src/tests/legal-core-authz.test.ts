/**
 * PR-AUTH-002 — Legal Core Authorization Enforcement (static contract)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoutePolicy, ROUTE_POLICIES } from "../core/authorization/routePolicyRegistry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function assertMutationsGuarded(rel: string) {
  const src = readModule(rel);
  const lines = src.split("\n").filter((l) => /router\.(post|put|patch|delete)\(/.test(l));
  const unguarded = lines.filter((l) => !l.includes("requirePermission("));
  assert.equal(
    unguarded.length,
    0,
    `${rel} has unguarded mutations:\n${unguarded.join("\n")}`,
  );
}

function testLegalCoreModules() {
  const modules = [
    "modules/legal-core/cases.ts",
    "modules/legal-core/clients.ts",
    "modules/legal-core/contracts.ts",
    "modules/legal-core/documents.ts",
    "modules/legal-core/document-templates.ts",
  ];
  for (const m of modules) assertMutationsGuarded(m);
  console.log("  ✅ legal-core mutations all require requirePermission");
}

function testRouteRegistryCoverage() {
  const required = [
    ["POST", "/api/cases", "cases:create"],
    ["PATCH", "/api/cases/:id", "cases:edit"],
    ["DELETE", "/api/cases/:id/hard", "cases:delete"],
    ["POST", "/api/clients", "clients:create"],
    ["POST", "/api/contracts", "contracts:create"],
    ["POST", "/api/documents", "documents:upload"],
    ["POST", "/api/document-templates", "documents:edit"],
    ["POST", "/api/document-templates/:id/generate", "documents:upload"],
    ["POST", "/api/ai/query", "ai:access"],
  ] as const;

  for (const [method, path, perm] of required) {
    const policy = findRoutePolicy(method, path);
    assert.ok(policy, `missing policy ${method} ${path}`);
    assert.equal(policy?.permission, perm);
  }
  assert.ok(ROUTE_POLICIES.length >= 100, "expected expanded policy registry with financial + AI + templates");
  console.log("  ✅ route policy registry covers legal-core P0");
}

function testTraineeCannotCreateCase() {
  const cases = readModule("modules/legal-core/cases.ts");
  assert.match(cases, /router\.post\("\/cases", requireAuthWithTenant, requirePermission\("cases:create"\)/);
  console.log("  ✅ POST /cases requires cases:create");
}

function testDocumentTemplatesTenantScoped() {
  const templates = readModule("modules/legal-core/document-templates.ts");
  assert.doesNotMatch(templates, /office_id = 'default'/);
  assert.match(templates, /getRequiredTenantId/);
  assert.match(templates, /requirePermission\("documents:view"\)/);
  assert.match(templates, /requirePermission\("documents:edit"\)/);
  console.log("  ✅ document-templates tenant-scoped + RBAC");
}

function main() {
  console.log("Legal Core Authorization Tests — PR-AUTH-002\n");
  testLegalCoreModules();
  testRouteRegistryCoverage();
  testTraineeCannotCreateCase();
  testDocumentTemplatesTenantScoped();
  console.log("\n✅ All PR-AUTH-002 legal-core authz tests passed\n");
}

main();
