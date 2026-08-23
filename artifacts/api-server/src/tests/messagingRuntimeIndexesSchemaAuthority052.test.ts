/**
 * Stage 8 — Migration 052 Messaging Runtime indexes schema authority.
 * Run: pnpm --filter @workspace/api-server run test:messaging-indexes-052
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
const stripComments = (sql: string) => sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

console.log("\n═══ Migration 052 presence + Messaging Runtime index contract ═══");
const migPath = "artifacts/api-server/migrations/052_messaging_runtime_indexes_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-052.sql";
assert.ok(existsSync(join(ROOT, migPath)), "052 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "052 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const name of [
  "idx_msgs_sender_date",
  "idx_msgs_office_date",
  "idx_msgs_office_folder",
  "idx_rcpt_user_unread",
  "idx_rcpt_msg",
  "idx_attach_msg",
]) {
  assert.match(mig, new RegExp(`CREATE INDEX IF NOT EXISTS ${name}`));
}
assert.match(mig, /created_at DESC/);
assert.match(mig, /WHERE is_read = FALSE/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /MESSAGING_RUNTIME_INDEXES_READY/);
assert.match(mig, /skipping % — table % missing/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS\b/i);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
}
console.log("  ✅ 052 owns 6 Messaging Runtime indexes; no DROP/CREATE TABLE");

console.log("\n═══ Preflight 052 SELECT-only + index arbiters ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /MESSAGING_RUNTIME_INDEXES_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /idx_msgs_office_folder/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime CREATE INDEX removed; DML preserved ═══");
const src = readSrc("modules/operations/internal-messages.ts");
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_msgs_sender_date/);
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_msgs_office_date/);
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_msgs_office_folder/);
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_rcpt_user_unread/);
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_rcpt_msg/);
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_attach_msg/);
assert.match(src, /to_regclass\('public\.idx_msgs_office_folder'\)/);
assert.match(src, /ensureMessagingRuntimeIndexes/);
assert.match(src, /WHERE m\.office_id = \$\{tenantId\}/);
assert.match(src, /INSERT INTO office_messages/);
assert.match(src, /ORDER BY m\.created_at DESC/);
assert.match(src, /m\.folder =/);
console.log("  ✅ Runtime CREATE INDEX gone; readiness + tenant/folder DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:messaging-indexes-052/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:messaging-indexes-052/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_052|scenario_migration_052/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig052_wrong_desc|mig052_stolen|mig052_miss_idx/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /052_messaging_runtime_indexes_schema_authority/);
/* 020 still owns overlapping names; 052 adds folder + fail-closed — do not remove 020 */
assert.match(readRepo("artifacts/api-server/migrations/020_performance_hotpath_indexes.sql"), /idx_msgs_office_date/);
assert.doesNotMatch(readRepo("artifacts/api-server/migrations/020_performance_hotpath_indexes.sql"), /idx_msgs_office_folder/);
console.log("  ✅ package/CI/integration/README wired; 020 not rewritten");

console.log("\n✅ messagingRuntimeIndexesSchemaAuthority052 tests passed\n");
