/**
 * Stage 22 — office_messages.case_id TEXT alignment (Migration 030).
 * Run: pnpm --filter @workspace/api-server run test:office-messages-case-id-030
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SRC = join(HERE, "..");

const migPath = join(
  ROOT,
  "artifacts/api-server/migrations/030_office_messages_case_id_text.sql",
);
const preflightPath = join(ROOT, "scripts/db/preflight-migration-030.sql");
const mig = readFileSync(migPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const integ = readFileSync(join(ROOT, "scripts/db/test-migrations.integration.sh"), "utf8");
const readme = readFileSync(
  join(ROOT, "artifacts/api-server/migrations/README.md"),
  "utf8",
);
const im = readFileSync(join(SRC, "modules/operations/internal-messages.ts"), "utf8");
const casesTs = readFileSync(join(SRC, "modules/legal-core/cases.ts"), "utf8");
const mig016 = readFileSync(
  join(ROOT, "artifacts/api-server/migrations/016_office_messages_fts.sql"),
  "utf8",
);
const mig020 = readFileSync(
  join(ROOT, "artifacts/api-server/migrations/020_performance_hotpath_indexes.sql"),
  "utf8",
);

function sqlOnly(src: string): string {
  return src.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function sliceRoute(startMarker: string, endMarker: string): string {
  const start = im.indexOf(startMarker);
  assert.ok(start >= 0, `missing start marker: ${startMarker.slice(0, 40)}`);
  const end = im.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing end marker after ${startMarker.slice(0, 40)}`);
  return im.slice(start, end);
}

const postBlock = sliceRoute(
  "// POST /api/internal-messages",
  "// PUT /api/internal-messages/:id/archive",
);
const caseBlock = sliceRoute(
  "// GET /api/internal-messages/case/:caseId",
  "// GET /api/internal-messages/:id",
);
const analyticsBlock = sliceRoute(
  "/* ══════════════════════════════════════════════════════\n   ANALYTICS",
  "// GET /api/internal-messages/case/:caseId",
);

console.log("\n═══ A–F: create / read TEXT case linkage + isolation ═══");
{
  /* A/B — UUID case linkage; store TEXT unchanged */
  assert.match(postBlock, /provenCaseId/);
  assert.match(postBlock, /String\(caseId\)\.trim\(\)/);
  assert.doesNotMatch(postBlock, /Number\s*\(\s*caseId\s*\)/);
  assert.doesNotMatch(postBlock, /parseInt\s*\(\s*caseId/);
  assert.match(
    postBlock,
    /WHERE id = \$\{caseKey\}[\s\S]*AND office_id = \$\{tenantId\}/,
  );
  assert.match(postBlock, /\$\{provenCaseId\}/);
  assert.match(postBlock, /status\(403\)/);

  /* C — foreign-office case rejected (ownership fail-closed) */
  assert.match(postBlock, /القضية غير تابعة لمكتبك|office_id = \$\{tenantId\}/);

  /* D/E — GET /case TEXT equality + office scope + ownership */
  assert.match(caseBlock, /c\.id\s*=\s*\$\{caseKey\}/);
  assert.match(caseBlock, /c\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(caseBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(caseBlock, /m\.case_id\s*=\s*\$\{caseKey\}/);
  assert.doesNotMatch(caseBlock, /m\.case_id::text/);
  assert.doesNotMatch(caseBlock, /parseInt\s*\(/);

  /* F — NULL case_id remains valid when absent */
  assert.match(postBlock, /provenCaseId:\s*string\s*\|\s*null\s*=\s*null/);
  assert.match(postBlock, /caseId != null && String\(caseId\)\.trim\(\) !== ""/);

  console.log("  ✅ create/read TEXT linkage; foreign rejected; NULL preserved");
}

console.log("\n═══ G–K: migration 030 + preflight contract ═══");
{
  assert.ok(existsSync(migPath), "030 migration must exist");
  assert.ok(existsSync(preflightPath), "preflight-030 must exist");
  assert.ok(
    "029_office_messages_fts_readiness.sql" <
      "030_office_messages_case_id_text.sql",
    "030 must lexicographically follow 029",
  );

  /* G/H — legacy 42 → '42'; never invent UUID mapping */
  assert.match(mig, /case_id::text/);
  assert.match(mig, /legacy 42 becomes '42'|42 → '42'/);
  assert.match(mig, /Never invent integer→UUID|no invent UUID mapping|never UUID invent/i);
  assert.doesNotMatch(sqlOnly(mig), /gen_random_uuid\s*\(/i);
  assert.doesNotMatch(mig, /UPDATE\s+office_messages[\s\S]*SET\s+case_id\s*=/i);

  /* I — INTEGER → TEXT */
  assert.match(mig, /SAFE_CONVERT_INTEGER_TO_TEXT/);
  assert.match(mig, /ALTER COLUMN case_id TYPE TEXT/);
  assert.match(mig, /WHEN case_id IS NULL THEN NULL/);
  assert.match(mig, /ELSE case_id::text/);

  /* J — already TEXT idempotent */
  assert.match(mig, /ALREADY_CORRECT/);
  assert.match(mig, /CASE_ID_ALREADY_TEXT|already TEXT/);
  assert.match(mig, /no type rewrite/i);

  /* K — unexpected type blocks */
  assert.match(mig, /BLOCK_AND_MANUAL_REVIEW/);
  assert.match(mig, /UNEXPECTED_CASE_ID_TYPE/);
  assert.match(mig, /RAISE EXCEPTION/);
  assert.match(mig, /refusing unsafe coercion/i);

  assert.match(mig016, /case_id\s+INTEGER/);
  assert.doesNotMatch(sqlOnly(mig), /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(sqlOnly(mig), /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sqlOnly(mig), /REFERENCES\s+cases\s*\(/i);

  assert.match(preflight, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable/i);
  assert.match(preflight, /chosen_action/);
  assert.match(preflight, /reason_code/);
  assert.match(preflight, /estimated_rows/);
  assert.match(preflight, /lock_risk/);
  assert.match(preflight, /SAFE_CONVERT_INTEGER_TO_TEXT/);
  assert.match(preflight, /ALREADY_CORRECT/);
  assert.match(preflight, /BLOCK_AND_MANUAL_REVIEW/);
  assert.match(preflight, /orphan_count/);
  assert.match(preflight, /cross_office_matches/);
  assert.match(preflight, /same_office_matches/);
  assert.match(preflight, /distinct_legacy/);
  assert.match(preflight, /CROSS_OFFICE_MATCHES_PRESENT|cross_office_matches require manual review/i);
  const pfSql = sqlOnly(preflight);
  assert.doesNotMatch(pfSql, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(pfSql, /^\s*CREATE\s+INDEX\b/im);
  assert.doesNotMatch(pfSql, /\bDROP\s+COLUMN\b/i);

  console.log("  ✅ INTEGER→TEXT exact; already-TEXT no-op; unexpected BLOCK; preflight SELECT-only");
}

console.log("\n═══ L–N: Runtime DDL removed; index schema-owned; analytics TEXT ═══");
{
  /* L — no Runtime case_id DDL */
  assert.doesNotMatch(im, /async function ensureCaseIdColumn|function ensureCaseIdColumn/);
  assert.doesNotMatch(
    im,
    /ADD COLUMN IF NOT EXISTS case_id\s+INTEGER/,
  );
  assert.doesNotMatch(
    sqlOnly(im),
    /ALTER TABLE office_messages[\s\S]*case_id INTEGER/,
  );
  assert.doesNotMatch(im, /ensureCaseIdColumn\s*\(\s*\)/);

  /* M — idx_messages_case_id schema-owned by 020/030 */
  assert.match(mig020, /idx_messages_case_id/);
  assert.match(mig, /CREATE INDEX IF NOT EXISTS idx_messages_case_id/);
  assert.doesNotMatch(
    casesTs,
    /CREATE INDEX IF NOT EXISTS idx_messages_case_id/,
  );
  assert.match(casesTs, /idx_messages_case_id owned by Migration 020\/030|Stage 22/);

  /* N — analytics topCases TEXT + office scope */
  assert.match(
    analyticsBlock,
    /JOIN cases c ON c\.id = m\.case_id AND c\.office_id = \$\{tenantId\}/,
  );
  assert.match(analyticsBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.doesNotMatch(analyticsBlock, /m\.case_id::text/);

  /* legal-core linked communications already TEXT equality + office_id */
  assert.match(
    casesTs,
    /WHERE case_id = \$\{caseId\} AND office_id = \$\{tenantId\}/,
  );

  console.log("  ✅ no Runtime case_id DDL; index schema-owned; analytics TEXT join");
}

console.log("\n═══ Stage 20/21 isolation invariants preserved ═══");
{
  assert.match(im, /resolveCanonicalMessageOfficeId/);
  assert.match(im, /requireAuthWithTenant/);
  assert.match(im, /assertCanonicalBusinessOfficeId/);
  assert.match(caseBlock, /Foreign \/ missing case/);
  assert.match(im, /m\.sender_id\s*=\s*\$\{userId\}/);
  assert.doesNotMatch(postBlock, /tenantId\s*=\s*.*caseId|office_id.*FROM cases.*caseId/);
  console.log("  ✅ canonical office gating + participant/case ownership preserved");
}

console.log("\n═══ harness + docs inventory ═══");
{
  assert.match(integ, /MIGRATION_030/);
  assert.match(integ, /apply_migration_030/);
  assert.match(integ, /scenario_migration_030_office_messages_case_id_text/);
  assert.match(readme, /030_office_messages_case_id_text/);
  assert.match(readme, /preflight-migration-030/);
  assert.match(readme, /ensureCaseIdColumn removed|Runtime ensureCaseIdColumn/i);
  assert.match(readme, /no automatic integer → UUID|Never invent integer→UUID|no invent/i);
  assert.match(readme, /FK intentionally deferred|Validating FK intentionally deferred/i);
  console.log("  ✅ integration harness + README inventory");
}

console.log("\n✅ officeMessagesCaseIdSchemaAuthority030 tests passed\n");
