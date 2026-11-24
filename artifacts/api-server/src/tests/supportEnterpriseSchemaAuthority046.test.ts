/**
 * Stage 7 — Migration 046 Support Enterprise schema authority.
 * Run: pnpm --filter @workspace/api-server run test:support-enterprise-046
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

console.log("\n═══ Migration 046 presence + Support Enterprise contract ═══");
const migPath = "artifacts/api-server/migrations/046_support_enterprise_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-046.sql";
assert.ok(existsSync(join(ROOT, migPath)), "046 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "046 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS support_ticket_attachments/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS support_ticket_audit/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS support_visitor_profiles/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS office_id\s+TEXT/i);
assert.match(mig, /ADD COLUMN IF NOT EXISTS source\s+TEXT/i);
assert.match(mig, /ALTER COLUMN source SET DEFAULT 'user'/i);
assert.match(mig, /ADD COLUMN IF NOT EXISTS tags\s+TEXT\[\]/i);
assert.match(mig, /ALTER COLUMN tags SET DEFAULT '\{\}'/i);
assert.match(mig, /ADD COLUMN IF NOT EXISTS ai_score\s+NUMERIC\s*\(\s*4\s*,\s*2\s*\)/i);
assert.match(mig, /ADD COLUMN IF NOT EXISTS satisfaction_score\s+INTEGER/i);
assert.match(mig, /ON DELETE CASCADE/);
assert.match(mig, /UNIQUE\s*\(\s*email\s*\)/i);
assert.match(mig, /support_visitor_profiles_email_key/);
assert.match(mig, /idx_st_user/);
assert.match(mig, /idx_st_status/);
assert.match(mig, /idx_st_office/);
assert.match(mig, /idx_st_sla_res/);
assert.match(mig, /idx_sta_ticket/);
assert.match(mig, /idx_stau_ticket/);
assert.match(mig, /idx_sm_ticket/);
assert.match(mig, /created_at DESC/);
assert.match(mig, /WHERE status NOT IN \('closed','resolved'\)/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|SUPPORT_ENTERPRISE_SCHEMA_READY/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /INCOMPATIBLE_FK/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /INCOMPATIBLE_NULLABLE/);
assert.match(mig, /ORPHAN_FK/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /gen_random_uuid/);
assert.match(mig, /confrelid = 'public\.support_tickets'::regclass/);
assert.match(mig, /numeric_precision\s*=\s*4|expected_precision/);
assert.match(mig, /indnullsnotdistinct/);
assert.match(pre, /INCOMPATIBLE_NULLABLE/);
assert.match(pre, /confrelid = 'public\.support_tickets'::regclass/);
assert.match(pre, /support_messages/);
assert.match(pre, /MISSING_COLUMN_WITH_EXISTING_ROWS|null_required_count/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig046_nullable_nn|mig046_typmod|mig046_fk_oid|mig046_miss_messages|mig046_nulls_not_distinct/);

{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DELETE\s+FROM\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_tickets\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_messages\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_ai_analysis\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_knowledge_base\b/);
  assert.doesNotMatch(sqlOnly, /UPDATE\s+support_tickets\s+SET\s+office_id/i);
  // Audit satellite must not invent an FK (attachments may REFERENCES support_tickets).
  const auditCreate = sqlOnly.match(
    /CREATE TABLE IF NOT EXISTS support_ticket_audit\s*\(([\s\S]*?)\);/,
  );
  assert.ok(auditCreate, "audit CREATE present");
  assert.doesNotMatch(auditCreate[1], /REFERENCES/i);
}
console.log("  ✅ 046 owns extensions+3 satellites+FK CASCADE+UNIQUE(email)+7 indexes; no DROP/DELETE/office backfill");

console.log("\n═══ Preflight 046 SELECT-only + blockers-first ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /SUPPORT_ENTERPRISE_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /ORPHAN_FK/);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /DUPLICATE_UNIQUE_KEY/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DELETE\s+FROM\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; ALREADY=SUPPORT_ENTERPRISE_SCHEMA_READY");

console.log("\n═══ P0 / boot gates ═══");
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^support_ticket_attachments$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^support_ticket_audit$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^support_visitor_profiles$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^support_tickets\.office_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^support_tickets\.ai_score$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^support_ticket_attachments\.ticket_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^support_visitor_profiles\.email$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^support_ticket_attachments$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^support_ticket_audit$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^support_visitor_profiles$/m);
assert.match(readRepo("scripts/db/boot-created-tables.md"), /046/);
console.log("  ✅ P0 gates Enterprise satellites + critical columns; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + DML preserved ═══");
const ent = readSrc("modules/platform/support-enterprise.ts");
assert.doesNotMatch(ent, /CREATE TABLE IF NOT EXISTS support_ticket_attachments/);
assert.doesNotMatch(ent, /CREATE TABLE IF NOT EXISTS support_ticket_audit/);
assert.doesNotMatch(ent, /CREATE TABLE IF NOT EXISTS support_visitor_profiles/);
assert.doesNotMatch(ent, /ALTER TABLE support_tickets ADD COLUMN/i);
assert.doesNotMatch(ent, /CREATE INDEX IF NOT EXISTS idx_st_/);
assert.match(ent, /to_regclass\('public\.support_tickets'\)/);
assert.match(ent, /to_regclass\('public\.support_ticket_attachments'\)/);
assert.match(ent, /to_regclass\('public\.support_ticket_audit'\)/);
assert.match(ent, /to_regclass\('public\.support_visitor_profiles'\)/);
assert.match(ent, /ensureEnterpriseSchema/);
assert.match(ent, /INSERT INTO support_ticket_audit/);
assert.match(ent, /INSERT INTO support_visitor_profiles|ON CONFLICT\s*\(\s*email\s*\)/i);
assert.match(ent, /Migration 046/);
assert.match(ent, /WHERE user_id = \$\{userId\}/);
console.log("  ✅ Runtime CREATE/ALTER/INDEX gone; readiness + audit/visitor DML; user_id scoping kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:support-enterprise-046/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:support-enterprise-046/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_046|scenario_migration_046/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig046_orphan|mig046_stolen|mig046_dup_email/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /046_support_enterprise_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ supportEnterpriseSchemaAuthority046 tests passed\n");
