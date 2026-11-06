/**
 * Migration 058 — invitations.office_id schema authority (SEC-005).
 * Run: pnpm --filter @workspace/api-server run test:invitations-058
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");

const readRepo = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const readSrc = (rel: string) => readFileSync(join(API, rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

console.log("\n═══ Migration 058 presence ═══");
const migPath = "artifacts/api-server/migrations/058_invitations_office_id_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-058.sql";
assert.ok(existsSync(join(ROOT, migPath)));
assert.ok(existsSync(join(ROOT, prePath)));
const mig = readRepo(migPath);
const pre = readRepo(prePath);
assert.match(mig, /ADD COLUMN office_id text/i);
assert.match(mig, /idx_invitations_office_id/);
assert.match(mig, /INVITATIONS_OFFICE_ID_SCHEMA_READY/);
assert.doesNotMatch(stripComments(mig), /(?:^|;)\s*DROP\s+TABLE\b/im);
assert.doesNotMatch(stripComments(mig), /UPDATE\s+invitations\s+SET\s+office_id/i);
console.log("  ✅ additive office_id; no invented backfill");

console.log("\n═══ Preflight SELECT-only ═══");
assert.match(pre, /SELECT-only|Does not CREATE/i);
assert.match(pre, /INVITATIONS_OFFICE_ID_SCHEMA_READY/);
assert.doesNotMatch(stripComments(pre), /(?:^|;)\s*ALTER\s+TABLE\b/im);
console.log("  ✅ preflight read-only");

console.log("\n═══ Drizzle + API bind officeId ═══");
const schema = readRepo("lib/db/src/schema/rbac.ts");
assert.match(schema, /officeId:\s*text\(["']office_id["']\)/);
const rbac = stripComments(readSrc("modules/platform/rbac.ts"));
assert.match(rbac, /officeId:\s*tenantId/);
assert.match(rbac, /eq\(\s*invitationsTable\.officeId\s*,\s*tenantId\s*\)/);
assert.match(rbac, /canManageInvitation/);
assert.match(rbac, /tenantId === ["']platform["']/);
console.log("  ✅ schema + POST/LIST office scoping");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:invitations-058/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:invitations-058/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /058_invitations_office_id/);
console.log("  ✅ package/CI/README");

console.log("\n✅ invitationsOfficeIdSchemaAuthority058: all checks passed\n");
