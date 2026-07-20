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
const commWriteTs    = readFileSync(join(SRC, "lib/clientCommSettingsWrite.ts"), "utf8");
const caseLinkTs     = readFileSync(join(SRC, "lib/clientCaseLinkWrite.ts"), "utf8");
const msgGateTs      = readFileSync(join(SRC, "lib/messagesTenantGate.ts"), "utf8");

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

console.log("\n═══ no broad file-level ESLint suppressions in the fixed files ═══");

/* Review requirement: pre-existing lint debt in these production files must
 * not be masked with a blanket file-level eslint-disable. Pre-existing
 * warnings on untouched lines are tolerated (see PR description / final
 * report for the exact, unchanged counts); they must simply not be hidden. */
for (const [label, src] of [
  ["messages.ts", messagesTs],
  ["client-portal.ts", clientPortalTs],
  ["client-auth.ts", clientAuthTs],
] as const) {
  assert.doesNotMatch(src, /^\/\* eslint-disable/m, `${label} must not carry a file-level eslint-disable directive`);
}
console.log("  ✅ no file-level eslint-disable in messages.ts / client-portal.ts / client-auth.ts");

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

console.log("\n═══ messages.ts: POST /messages gated by canonical tenant resolution ═══");

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
assert.match(
  messagesTs,
  /import \{ insertForResolvedOffice \} from "\.\.\/\.\.\/lib\/messagesTenantGate"/,
  "POST /messages must gate its insert through the shared insertForResolvedOffice helper",
);
const postMessagesBody = messagesTs.slice(messagesTs.indexOf('router.post("/messages"'));
assert.match(
  postMessagesBody,
  /const created = await insertForResolvedOffice\(/,
  "POST /messages must call insertForResolvedOffice before inserting",
);
assert.match(
  postMessagesBody,
  /if \(!created\) \{[\s\S]*?res\.status\(403\)/,
  "POST /messages must reject (403) when insertForResolvedOffice returns null (unresolved tenant)",
);
console.log("  ✅ POST /messages: insert is gated by insertForResolvedOffice; rejects (403) when unresolved");

console.log("\n═══ messages.ts: honest, non-misleading messages-schema limitation ═══");

/* Review requirement: do not claim messages tenant persistence/filtering is
 * fully fixed. The `messages` table has no office_id column anywhere; this
 * must remain clearly documented, not silently papered over or removed. */
assert.match(
  messagesTs,
  /messagesTable[\s\S]{0,120}has no officeId\/office_id column/,
  "messages.ts must keep the honest note that messagesTable has no office_id column",
);
assert.match(
  messagesTs,
  /requires a schema migration/,
  "messages.ts must state that persisting/filtering by office_id on messages requires a migration",
);
console.log("  ✅ messages.ts still documents the messages/office_id schema gap honestly");

console.log("\n═══ lib/messagesTenantGate.ts: fail-closed insert gate ═══");

assert.match(
  msgGateTs,
  /if \(!officeId\) return null; \/\/ fail closed — insert is never invoked/,
  "insertForResolvedOffice must return null (never invoke insert) when resolveTenantId fails",
);
assert.doesNotMatch(msgGateTs, /\?\?\s*auth\.userId|\|\|\s*auth\.userId/, "messagesTenantGate.ts must never substitute auth.userId");
console.log("  ✅ insertForResolvedOffice fails closed without invoking the insert callback");

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

console.log("\n═══ client-portal.ts: PATCH /comm-settings gated by writeClientCommSettings ═══");

assert.match(
  clientPortalTs,
  /import \{ writeClientCommSettings \} from "\.\.\/\.\.\/lib\/clientCommSettingsWrite"/,
  "client-portal.ts must import the extracted writeClientCommSettings helper",
);

/* Every getOfficeUser() call site must be immediately followed by a guard
 * that denies the request before u.officeId is used in any query. */
const officeUserCallSites = [...clientPortalTs.matchAll(/const u = await getOfficeUser\(req\);\n\s*if \(!u\) \{ res\.status\(401\)/g)];
assert.ok(
  officeUserCallSites.length >= 6,
  `expected every getOfficeUser() call site to deny on null before use; found ${officeUserCallSites.length}`,
);

const patchCommSettingsBody = clientPortalTs.slice(clientPortalTs.indexOf('router.patch("/comm-settings"'));
assert.match(
  patchCommSettingsBody,
  /const outcome = await writeClientCommSettings\(/,
  "PATCH /comm-settings must delegate the write to writeClientCommSettings",
);
assert.match(
  patchCommSettingsBody,
  /if \(!outcome\) \{ res\.status\(401\)/,
  "PATCH /comm-settings must deny (401) when writeClientCommSettings returns null (unresolved tenant)",
);
console.log("  ✅ PATCH /comm-settings denies on null before/without writing; delegates to writeClientCommSettings");

console.log("\n═══ lib/clientCommSettingsWrite.ts: fail-closed write gate ═══");

assert.match(
  commWriteTs,
  /if \(!officeId\) return null; \/\/ fail closed — never substitute the Clerk user id/,
  "writeClientCommSettings must return null (never write) when resolveTenantId fails",
);
assert.match(
  commWriteTs,
  /INSERT INTO client_comm_settings/,
  "writeClientCommSettings must be the sole owner of the client_comm_settings insert",
);
assert.match(
  commWriteTs,
  /UPDATE client_comm_settings/,
  "writeClientCommSettings must be the sole owner of the client_comm_settings update",
);
assert.doesNotMatch(commWriteTs, /\?\?\s*auth\.userId|\|\|\s*auth\.userId/, "clientCommSettingsWrite.ts must never substitute auth.userId");
console.log("  ✅ writeClientCommSettings fails closed; owns the client_comm_settings read/write");

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

console.log("\n═══ client-auth.ts: admin-create gated by linkClientCase ═══");

assert.match(
  clientAuthTs,
  /import \{ linkClientCase \} from "\.\.\/\.\.\/lib\/clientCaseLinkWrite"/,
  "client-auth.ts must import the extracted linkClientCase helper",
);

const adminCreateBody = clientAuthTs.slice(clientAuthTs.indexOf('router.post("/client-auth/admin-create"'));
const adminGuardIdx = adminCreateBody.indexOf("if (!admin) {");
const linkCallIdx   = adminCreateBody.indexOf("await linkClientCase(");
assert.ok(adminGuardIdx >= 0 && linkCallIdx > adminGuardIdx, "admin-create must deny (!admin) before ever calling linkClientCase");
assert.match(
  adminCreateBody,
  /const linked = await linkClientCase\(/,
  "admin-create must delegate the client_case_links write to linkClientCase",
);
assert.match(
  adminCreateBody,
  /if \(!linked\) \{ res\.status\(401\)/,
  "admin-create must deny (401) when linkClientCase returns null (unresolved tenant) — no insert performed",
);
console.log("  ✅ admin-create denies on null before/without linking; delegates to linkClientCase");

console.log("\n═══ lib/clientCaseLinkWrite.ts: fail-closed write gate ═══");

assert.match(
  caseLinkTs,
  /if \(!officeId\) return null; \/\/ fail closed — never substitute the Clerk user id/,
  "linkClientCase must return null (never insert) when resolveTenantId fails",
);
assert.match(
  caseLinkTs,
  /INSERT INTO client_case_links[\s\S]*?\$\{officeId\}/,
  "linkClientCase must persist the resolved officeId (never a raw Clerk user id) on client_case_links",
);
assert.doesNotMatch(caseLinkTs, /\?\?\s*auth\.userId|\|\|\s*auth\.userId/, "clientCaseLinkWrite.ts must never substitute auth.userId");
console.log("  ✅ linkClientCase fails closed; persists only the resolved office id");

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
