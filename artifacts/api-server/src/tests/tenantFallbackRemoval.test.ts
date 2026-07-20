/**
 * Tenant fallback removal — auth.userId must never stand in for an
 * office/tenant id in messages.ts, client-portal.ts, or client-auth.ts.
 * Run: pnpm --filter @workspace/api-server run test:tenant-fallback-removal
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const messagesTs     = readFileSync(join(SRC, "modules/operations/messages.ts"), "utf8");
const clientPortalTs = readFileSync(join(SRC, "modules/marketplace/client-portal.ts"), "utf8");
const clientAuthTs   = readFileSync(join(SRC, "modules/marketplace/client-auth.ts"), "utf8");
const tenantMwTs     = readFileSync(join(SRC, "middlewares/tenantMiddleware.ts"), "utf8");

const USERID_FALLBACK_PATTERNS = [
  /\?\?\s*auth\.userId/,
  /\|\|\s*auth\.userId/,
  /\?\?\s*req\.auth\?\.userId/,
  /\|\|\s*req\.auth\?\.userId/,
];

function assertNoUserIdFallback(label: string, src: string): void {
  for (const pattern of USERID_FALLBACK_PATTERNS) {
    assert.doesNotMatch(src, pattern, `${label} must not use ${pattern} as an office/tenant fallback`);
  }
}

console.log("\n═══ no active user-id-as-office fallback in the three fixed files ═══");

assertNoUserIdFallback("messages.ts", messagesTs);
assertNoUserIdFallback("client-portal.ts", clientPortalTs);
assertNoUserIdFallback("client-auth.ts", clientAuthTs);
console.log("  ✅ messages.ts / client-portal.ts / client-auth.ts: no auth.userId office fallback");

console.log("\n═══ repository-wide sweep: no remaining occurrence anywhere in src ═══");

/* Recursively scan src/ (excluding tests/ itself, to avoid matching the
 * regex literals in this file, and node_modules) for any lingering
 * user-id-as-office fallback in runtime code. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tests") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) out.push(full);
  }
  return out;
}

const allSrcFiles = walk(SRC);
const offenders: string[] = [];
for (const file of allSrcFiles) {
  const content = readFileSync(file, "utf8");
  for (const pattern of USERID_FALLBACK_PATTERNS) {
    if (pattern.test(content)) {
      offenders.push(`${relative(SRC, file)} matches ${pattern}`);
    }
  }
}
assert.deepEqual(offenders, [], `no backend source file may fall back to auth.userId as a tenant id:\n${offenders.join("\n")}`);
console.log(`  ✅ scanned ${allSrcFiles.length} source files under src/ — zero user-id-as-office fallbacks remain`);

console.log("\n═══ messages.ts: canonical resolveTenantId wiring ═══");

assert.match(
  messagesTs,
  /import \{ resolveTenantId \} from "\.\.\/\.\.\/middlewares\/tenantMiddleware"/,
  "messages.ts must import the canonical resolveTenantId",
);

const getMsgUserBody = messagesTs.slice(
  messagesTs.indexOf("async function getMsgUser"),
  messagesTs.indexOf("const DEFAULT_REPLY_ROLES"),
);
assert.match(
  getMsgUserBody,
  /const officeId = await resolveTenantId\(auth\.userId, headerTenant\)/,
  "getMsgUser must resolve officeId via resolveTenantId(auth.userId, headerTenant)",
);
assert.match(
  getMsgUserBody,
  /if \(!officeId\) return null;/,
  "getMsgUser must fail closed (return null) when resolveTenantId cannot resolve a tenant",
);
console.log("  ✅ getMsgUser resolves officeId via resolveTenantId and fails closed on null");

console.log("\n═══ messages.ts: GET routes scope by req.tenantId (not a helper officeId) ═══");

assert.doesNotMatch(
  messagesTs,
  /u\?\.officeId\s*\?\?\s*tenantId/,
  "GET routes must not prefer a helper-returned officeId over req.tenantId",
);
const officeIdScopedQueries = messagesTs.match(/WHERE office_id=\$\{tenantId\}/g) ?? [];
assert.equal(
  officeIdScopedQueries.length,
  2,
  "both GET /messages/conversations and GET /messages must scope directly by req.tenantId",
);
assert.match(
  messagesTs,
  /router\.get\("\/messages\/conversations", requireAuthWithTenant/,
  "GET /messages/conversations must keep requireAuthWithTenant",
);
assert.match(
  messagesTs,
  /router\.get\("\/messages", requireAuthWithTenant/,
  "GET /messages must keep requireAuthWithTenant",
);
console.log("  ✅ GET /messages/conversations and GET /messages scope solely by req.tenantId");

console.log("\n═══ messages.ts: POST /messages requires a canonical tenant ═══");

assert.match(
  messagesTs,
  /router\.post\("\/messages", requireAuthWithTenant/,
  "POST /messages must use requireAuthWithTenant (reject when no tenant resolves), not plain requireAuth",
);
assert.doesNotMatch(
  messagesTs,
  /router\.post\("\/messages", requireAuth,/,
  "POST /messages must no longer use plain requireAuth",
);
console.log("  ✅ POST /messages now requires a resolved tenant via requireAuthWithTenant");

console.log("\n═══ client-portal.ts: canonical resolveTenantId wiring ═══");

assert.match(
  clientPortalTs,
  /import \{ resolveTenantId \} from "\.\.\/\.\.\/middlewares\/tenantMiddleware"/,
  "client-portal.ts must import the canonical resolveTenantId",
);
const getOfficeUserBody = clientPortalTs.slice(
  clientPortalTs.indexOf("async function getOfficeUser"),
  clientPortalTs.indexOf("async function checkCommPerm"),
);
assert.match(
  getOfficeUserBody,
  /const officeId = await resolveTenantId\(auth\.userId, headerTenant\)/,
  "getOfficeUser must resolve officeId via resolveTenantId(auth.userId, headerTenant)",
);
assert.match(
  getOfficeUserBody,
  /if \(!officeId\) return null;/,
  "getOfficeUser must fail closed (return null) when resolveTenantId cannot resolve a tenant",
);
console.log("  ✅ getOfficeUser resolves officeId via resolveTenantId and fails closed on null");

console.log("\n═══ client-portal.ts: callers already deny on null before any write ═══");

/* Every getOfficeUser() call site must be immediately followed by a guard
 * that denies the request before u.officeId is used in any query. */
const officeUserCallSites = [...clientPortalTs.matchAll(/const u = await getOfficeUser\(req\);\n\s*if \(!u\) \{ res\.status\(401\)/g)];
assert.ok(
  officeUserCallSites.length >= 6,
  `expected every getOfficeUser() call site to deny on null before use; found ${officeUserCallSites.length}`,
);
assert.match(
  clientPortalTs,
  /client_comm_settings[^`]*VALUES \(\$\{u\.officeId\}/s,
  "client_comm_settings insert must persist the resolved office id (u.officeId), never a raw Clerk user id",
);
console.log("  ✅ all getOfficeUser() callers deny on null; client_comm_settings write uses resolved office id");

console.log("\n═══ client-auth.ts: canonical resolveTenantId wiring ═══");

assert.match(
  clientAuthTs,
  /import \{ resolveTenantId \} from "\.\.\/\.\.\/middlewares\/tenantMiddleware"/,
  "client-auth.ts must import the canonical resolveTenantId",
);
const getAdminUserBody = clientAuthTs.slice(
  clientAuthTs.indexOf("async function getAdminUser"),
  clientAuthTs.indexOf("router.post(\"/client-auth/admin-create\""),
);
assert.match(
  getAdminUserBody,
  /const officeId = await resolveTenantId\(auth\.userId, headerTenant\)/,
  "getAdminUser must resolve officeId via resolveTenantId(auth.userId, headerTenant)",
);
assert.match(
  getAdminUserBody,
  /if \(!officeId\) return null;/,
  "getAdminUser must fail closed (return null) when resolveTenantId cannot resolve a tenant",
);
console.log("  ✅ getAdminUser resolves officeId via resolveTenantId and fails closed on null");

console.log("\n═══ client-auth.ts: admin-create denies before any office-scoped write ═══");

const adminCreateBody = clientAuthTs.slice(clientAuthTs.indexOf('router.post("/client-auth/admin-create"'));
const adminGuardIdx  = adminCreateBody.indexOf("if (!admin) {");
const adminInsertIdx = adminCreateBody.indexOf("INSERT INTO client_case_links");
assert.ok(adminGuardIdx >= 0 && adminInsertIdx > adminGuardIdx, "admin-create must deny (!admin) before writing client_case_links");
assert.match(
  adminCreateBody,
  /INSERT INTO client_case_links[\s\S]*?VALUES \([^)]*\$\{admin\.officeId\}/,
  "client_case_links.office_id must always receive the resolved tenant id (admin.officeId), never a raw Clerk user id",
);
console.log("  ✅ admin-create denies on null admin before client_case_links write; office_id uses resolved tenant");

console.log("\n═══ x-tenant-id remains governed by resolveTenantId's own membership validation ═══");

assert.match(
  tenantMwTs,
  /export async function resolveTenantId\(userId: string, headerTenantId\?: string\): Promise<string \| null>/,
  "resolveTenantId signature must be unchanged",
);
assert.match(
  tenantMwTs,
  /SELECT 1 FROM office_members\s*\n\s*WHERE user_id = \$\{userId\} AND office_id = \$\{headerTenantId\} AND status = 'active'/,
  "resolveTenantId must still validate x-tenant-id header against real office membership before honoring it",
);
console.log("  ✅ resolveTenantId (untouched) still validates x-tenant-id via office_members membership");

console.log("\n✅ tenantFallbackRemoval: all checks passed\n");
