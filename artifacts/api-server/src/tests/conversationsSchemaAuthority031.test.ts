/**
 * Stage 23.3B — Migration 031 conversation schema authority + tenant isolation.
 * Run: pnpm --filter @workspace/api-server run test:conversations-031
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");

function readRepo(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function readSrc(rel: string) {
  return readFileSync(join(API, rel), "utf8");
}
function stripComments(sql: string) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

console.log("\n═══ Migration 031 presence + contract ═══");
const migPath = "artifacts/api-server/migrations/031_message_conversations_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-031.sql";
assert.ok(existsSync(join(ROOT, migPath)), "031 migration file present");
assert.ok(existsSync(join(ROOT, prePath)), "031 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS message_conversations/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS conversation_members/);
assert.match(mig, /case_id\s+TEXT/);
assert.match(mig, /UNIQUE\s*\(\s*conversation_id\s*,\s*user_id\s*\)/);
assert.match(mig, /CHECK\s*\(\s*type IN\s*\(\s*'direct'\s*,\s*'group'\s*\)\s*\)/);
assert.match(mig, /CHECK\s*\(\s*role IN\s*\(\s*'admin'\s*,\s*'member'\s*\)\s*\)/);
assert.match(mig, /conversation_members_conversation_id_fkey/);
assert.match(mig, /ON DELETE CASCADE/);
assert.match(mig, /FK_DEFERRED_ORPHANS/);
assert.match(mig, /idx_conv_office/);
assert.match(mig, /idx_convs_case_id/);
assert.match(mig, /WHERE case_id IS NOT NULL/);
assert.match(mig, /idx_conv_members_conv/);
assert.match(mig, /idx_conv_members_user/);
assert.match(mig, /idx_conv_updated/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /DUPLICATE_MEMBERSHIP/);
assert.match(mig, /NULL_REQUIRED_IDENTIFIERS/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
assert.match(mig, /Migration 020/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /REFERENCES\s+cases\s*\(/i);
}
console.log("  ✅ 031 owns tables + case_id TEXT + indexes; no DROP; no cases FK");

console.log("\n═══ Preflight 031 SELECT-only + classifications ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /reason_code/);
assert.match(pre, /estimated_rows|estimated_mc/);
assert.match(pre, /lock_risk/);
assert.match(pre, /ALREADY_CORRECT/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /orphan_members|orphan_cnt/);
assert.match(pre, /duplicate_membership|DUPLICATE_MEMBERSHIP/);
assert.match(pre, /case_id_udt/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DROP\s+TABLE\b/im);
}
console.log("  ✅ preflight reports chosen_action / blocks / orphans; SELECT-only");
console.log("\n═══ Runtime DDL removed ═══");
const im = readSrc("modules/operations/internal-messages.ts");
const cases = readSrc("modules/legal-core/cases.ts");
const conv = readSrc("modules/operations/conversations.ts");
assert.doesNotMatch(im, /CREATE TABLE IF NOT EXISTS message_conversations/);
assert.doesNotMatch(im, /CREATE TABLE IF NOT EXISTS conversation_members/);
assert.doesNotMatch(im, /function ensureConversationTables|ensureConversationTables\s*\(/);
assert.doesNotMatch(im, /CREATE INDEX IF NOT EXISTS idx_conv_office/);
assert.doesNotMatch(im, /CREATE INDEX IF NOT EXISTS idx_conv_members_conv/);
assert.doesNotMatch(im, /CREATE INDEX IF NOT EXISTS idx_conv_members_user/);
assert.doesNotMatch(im, /CREATE INDEX IF NOT EXISTS idx_conv_updated/);
assert.doesNotMatch(cases, /CREATE INDEX IF NOT EXISTS idx_convs_case_id/);
assert.match(im, /031_message_conversations_schema_authority/);
assert.match(cases, /idx_convs_case_id owned by migration 020\/031/);
console.log("  ✅ no executable Runtime CREATE/INDEX for conversation tables");

console.log("\n═══ Tenant isolation — office-bound helpers + routes ═══");
assert.match(conv, /assertCanonicalBusinessOfficeId/);
assert.match(conv, /resolveCanonicalConversationOfficeId/);
assert.match(conv, /source:\s*["']conversations["']/);
assert.match(conv, /async function isMember\(convId: string, userId: string, officeId: string\)/);
assert.match(conv, /async function isAdmin\(convId: string, userId: string, officeId: string\)/);
assert.match(conv, /async function getMemberIds\(convId: string, officeId: string\)/);
assert.match(conv, /c\.office_id = \$\{officeId\}/);
assert.match(conv, /cm\.office_id = \$\{officeId\}/);
assert.match(conv, /AND office_id = \$\{tenantId\}/);
assert.match(conv, /WHERE id = \$\{convId\}::uuid AND office_id = \$\{tenantId\}/);
assert.match(conv, /conversationOwnedByOffice/);
/* Helpers must not use membership-only (conversation_id + user_id) without office. */
assert.doesNotMatch(
  conv,
  /SELECT 1 FROM conversation_members\s+WHERE conversation_id = \$\{convId\}::uuid AND user_id = \$\{userId\}\s+LIMIT 1/,
);
assert.match(conv, /isMember\(convId, userId, tenantId\)/);
assert.match(conv, /isAdmin\(convId, userId, tenantId\)/);
assert.match(conv, /getMemberIds\(convId, tenantId\)/);
console.log("  ✅ isMember/isAdmin/getMemberIds + message/member routes office-bound");

console.log("\n═══ Stage 20/21/22 surfaces preserved on internal-messages ═══");
assert.match(im, /assertCanonicalBusinessOfficeId/);
assert.match(im, /016_office_messages_fts|getMessageFtsConfig/);
assert.doesNotMatch(im, /ADD COLUMN IF NOT EXISTS case_id\s+INTEGER/);
assert.doesNotMatch(im, /ensureCaseIdColumn/);
console.log("  ✅ Stage 20/21/22 message isolation/FTS/case_id TEXT surface unchanged");

console.log("\n═══ CI / integration wiring ═══");
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:conversations-031/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:conversations-031/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_031|scenario_migration_031/);
assert.match(integ, /apply_migration_031/);
console.log("  ✅ package.json + CI + integration harness wired");

console.log("\n✅ conversationsSchemaAuthority031 tests passed\n");
