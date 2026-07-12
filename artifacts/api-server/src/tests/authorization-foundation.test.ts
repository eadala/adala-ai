/**
 * Authorization Foundation Tests — PR-AUTH-001
 * Run: pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/tests/authorization-foundation.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_PERMISSIONS,
  PERMISSION_KEY_SET,
  isValidPermissionKey,
  FRONTEND_PERMISSION_ALIASES,
} from "../core/authorization/permissionCatalog";
import {
  authorize,
  hasPermission,
  hasAnyPermission,
} from "../core/authorization/authorize";
import {
  AUTH_ERROR_CODES,
  authorizationDeniedResponse,
  membershipRequiredResponse,
} from "../core/authorization/errors";
import {
  findRoutePolicy,
  normalizeApiPath,
  ROUTE_POLICIES,
} from "../core/authorization/routePolicyRegistry";
import { getEnforcementMode } from "../core/authorization/enforceRoutePolicy";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function testPermissionCatalog() {
  assert.ok(ALL_PERMISSIONS.length >= 40);
  assert.equal(isValidPermissionKey("cases:delete"), true);
  assert.equal(isValidPermissionKey("not:a:permission"), false);
  assert.equal(PERMISSION_KEY_SET.has("hr:manage"), true);
  console.log("  ✅ permission catalog SSOT");
}

function testAuthorizePure() {
  const ctx = {
    userId: "u1",
    officeId: "office_a",
    roleName: "lawyer",
    roleDisplayName: "محامي",
    permissions: ["cases:view", "cases:edit"],
    principalType: "user" as const,
    isSuperAdmin: false,
    isImpersonating: false,
  };

  assert.equal(authorize(ctx, "cases:edit").allowed, true);
  assert.equal(authorize(ctx, "cases:delete").allowed, false);
  assert.equal(hasPermission({ permissions: ["*"] }, "cases:delete"), true);
  assert.equal(hasAnyPermission(ctx, ["cases:delete", "cases:edit"]), true);
  console.log("  ✅ authorize() pure evaluation");
}

function testMissingMembershipDenyContract() {
  const body = membershipRequiredResponse("office_x");
  assert.equal(body.code, AUTH_ERROR_CODES.AUTHZ_MEMBERSHIP_REQUIRED);
  const denied = authorizationDeniedResponse("cases:delete", { role: "trainee_lawyer", officeId: "o1" });
  assert.equal(denied.code, AUTH_ERROR_CODES.AUTH_403);
  assert.equal(denied.required, "cases:delete");

  const reqAuth = readModule("middlewares/requireAuth.ts");
  assert.match(reqAuth, /membershipRequiredResponse/);
  assert.doesNotMatch(reqAuth, /trainee_lawyer/);
  console.log("  ✅ missing membership → deny contract (no trainee fallback)");
}

function testRoutePolicyRegistry() {
  const path = normalizeApiPath("/api/cases/abc-123?foo=1");
  assert.equal(path, "/api/cases/abc-123");

  const policy = findRoutePolicy("DELETE", "/api/cases/:id");
  assert.ok(policy);
  assert.equal(policy?.permission, "cases:delete");
  assert.equal(policy?.routeClass, "TENANT_RBAC");

  assert.ok(ROUTE_POLICIES.length >= 15);
  console.log("  ✅ route policy registry + normalization");
}

function testKernelStructure() {
  const files = [
    "core/authorization/permissionCatalog.ts",
    "core/authorization/authorizationContext.ts",
    "core/authorization/authorize.ts",
    "core/authorization/routePolicyRegistry.ts",
    "core/authorization/enforceRoutePolicy.ts",
    "core/authorization/errors.ts",
    "core/authorization/index.ts",
  ];
  for (const f of files) {
    assert.ok(readModule(f).length > 0, `missing ${f}`);
  }

  const authCtx = readModule("core/authorization/authorizationContext.ts");
  assert.match(authCtx, /office_members om/);
  assert.match(authCtx, /LEFT JOIN roles r/);

  const rbac = readModule("modules/platform/rbac.ts");
  assert.match(rbac, /core\/authorization/);
  assert.match(rbac, /office_members SET role/);
  assert.doesNotMatch(rbac, /usersTable\)[\s\S]*\.set\(\{\s*role/);

  console.log("  ✅ kernel file structure + rbac role source fix");
}

function testGovernanceCoverage() {
  const governance = readFileSync(
    resolve(SRC, "../../../scripts/governance/platform-check.mjs"),
    "utf8",
  );
  assert.match(governance, /Authorization Foundation/);
  assert.match(governance, /permissionCatalog/);
  console.log("  ✅ governance Layer 10 present");
}

function testEnforcementModeDefault() {
  const prev = process.env.AUTHORIZATION_ENFORCEMENT;
  delete process.env.AUTHORIZATION_ENFORCEMENT;
  assert.equal(getEnforcementMode(), "warn");
  process.env.AUTHORIZATION_ENFORCEMENT = "strict";
  assert.equal(getEnforcementMode(), "strict");
  if (prev !== undefined) process.env.AUTHORIZATION_ENFORCEMENT = prev;
  else delete process.env.AUTHORIZATION_ENFORCEMENT;
  console.log("  ✅ enforcement mode defaults to warn");
}

function testFrontendAliasMap() {
  assert.equal(FRONTEND_PERMISSION_ALIASES["cases:manage"], "cases:edit");
  console.log("  ✅ frontend permission aliases documented");
}

function main() {
  console.log("Authorization Foundation Tests — PR-AUTH-001\n");
  testPermissionCatalog();
  testAuthorizePure();
  testMissingMembershipDenyContract();
  testRoutePolicyRegistry();
  testKernelStructure();
  testGovernanceCoverage();
  testEnforcementModeDefault();
  testFrontendAliasMap();
  console.log("\n✅ All authorization foundation tests passed\n");
}

main();
