/**
 * Stage 15 final — strict tasks tenant ownership (GET/INSERT/PATCH/DELETE).
 * Run: pnpm --filter @workspace/api-server run test:office-tasks-mutate
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canAccessTaskOffice,
  resolveTaskOfficeId,
  toUuid,
} from "../lib/taskTenantVisibility";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..");
const tasksTs = readFileSync(join(SRC, "modules/operations/tasks.ts"), "utf8");
const visTs = readFileSync(join(SRC, "lib/taskTenantVisibility.ts"), "utf8");
const autopilotTs = [
  readFileSync(join(SRC, "agents/caseAutopilot.ts"), "utf8"),
  readFileSync(join(SRC, "agents/autopilotTaskCreation.ts"), "utf8"),
].join("\n");
const caseTasksTs = readFileSync(join(SRC, "case/modules/tasks.ts"), "utf8");
const caseAiTs = readFileSync(join(SRC, "case/case.ai.ts"), "utf8");
const casesTs = readFileSync(join(SRC, "modules/legal-core/cases.ts"), "utf8");
const mig022 = readFileSync(
  join(SRC, "..", "migrations", "022_tasks_tenant_ownership.sql"),
  "utf8",
);
const feTasks = readFileSync(
  resolve(__dirname, "../../../adala/src/pages/operations/tasks.tsx"),
  "utf8",
);

const TENANT_A = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

console.log("\n═══ resolveTaskOfficeId / canAccessTaskOffice ═══");

{
  assert.equal(toUuid(TENANT_A), TENANT_A);
  assert.equal(resolveTaskOfficeId(TENANT_A), TENANT_A);
  assert.equal(resolveTaskOfficeId("platform"), null);
  assert.equal(resolveTaskOfficeId("trial_office_x"), null);

  assert.equal(canAccessTaskOffice(TENANT_A, TENANT_A), true);
  assert.equal(canAccessTaskOffice(TENANT_B, TENANT_A), false);
  assert.equal(canAccessTaskOffice(null, TENANT_A), false);
  assert.equal(canAccessTaskOffice(TENANT_A, "platform"), false);
  console.log("  ✅ own ok; cross-tenant / NULL / non-UUID denied");
}

console.log("\n═══ GET/PATCH/DELETE/INSERT share strict predicate ═══");

{
  assert.match(tasksTs, /function taskOfficePred\(officeId: string\) \{\s*return sql`office_id = \$\{officeId\}::uuid`;/s);
  for (const method of ["router.get(\"/office-tasks\"", "router.get(\"/office-tasks/stats\"", "router.post(\"/office-tasks\"", "router.patch(", "router.delete("]) {
    assert.ok(tasksTs.includes(method) || tasksTs.includes(method.replace("(", "(\"/office-tasks")), `missing ${method}`);
  }
  assert.match(tasksTs, /resolveTaskOfficeId/);
  assert.equal((tasksTs.match(/rejectMissingOffice/g) ?? []).length >= 5, true);
  assert.match(tasksTs, /code: "TNT_403"/);
  assert.doesNotMatch(tasksTs, /office_id IS NULL/);
  assert.doesNotMatch(tasksTs, /WHERE TRUE|sql`TRUE`/);
  assert.doesNotMatch(tasksTs, /officeId \? sql`\$\{officeId\}::uuid` : sql`NULL`/);
  assert.match(tasksTs, /VALUES \(\s*\$\{officeId\}::uuid,/s);
  console.log("  ✅ final ownership: office_id = :officeId::uuid; no NULL insert; 403 without UUID");
}

console.log("\n═══ INSERT paths never create NULL office_id ═══");

{
  assert.match(autopilotTs, /resolveAutopilotOfficeId|resolveTaskOfficeId/);
  assert.match(autopilotTs, /office_id, case_id/);
  assert.match(autopilotTs, /\$\{officeId\}::uuid/);
  assert.match(autopilotTs, /MISSING_CANONICAL_OFFICE_UUID|if \(!officeId\)/);
  assert.doesNotMatch(
    autopilotTs.slice(autopilotTs.indexOf("INSERT INTO tasks")),
    /INSERT INTO tasks \(title,/,
  );

  assert.match(caseTasksTs, /resolveTaskOfficeId/);
  assert.match(caseTasksTs, /\$\{officeId\}::uuid/);
  assert.doesNotMatch(caseTasksTs, /office_id IS NULL/);

  assert.match(caseAiTs, /resolveTaskOfficeId\(officeId\)/);
  assert.match(caseAiTs, /\$\{resolvedOffice\}::uuid/);

  assert.doesNotMatch(casesTs, /FROM tasks[^\n]*office_id IS NULL|office_id IS NULL\) ORDER BY/);
  assert.doesNotMatch(casesTs, /OR office_id IS NULL/);
  console.log("  ✅ autopilot / CaseTasks / approveAITask / cases queries hardened");
}

console.log("\n═══ mutation outcome matrix ═══");

{
  type Outcome = "ok" | "404" | "403";
  function accessOutcome(taskOfficeId: string | null, actor: string): Outcome {
    if (!resolveTaskOfficeId(actor)) return "403";
    return canAccessTaskOffice(taskOfficeId, actor) ? "ok" : "404";
  }
  assert.equal(accessOutcome(TENANT_A, TENANT_A), "ok");
  assert.equal(accessOutcome(TENANT_B, TENANT_A), "404");
  assert.equal(accessOutcome(null, TENANT_A), "404");
  assert.equal(accessOutcome(TENANT_A, "platform"), "403");
  console.log("  ✅ own ok; other/NULL → 404; non-UUID → 403");
}

console.log("\n═══ migration 022 backfill + quarantine fail-closed ═══");

{
  assert.match(mig022, /022_tasks_tenant_ownership/);
  assert.match(mig022, /tasks_orphan_quarantine/);
  assert.match(mig022, /case_id → cases|case_id→cases|FROM cases c/i);
  assert.match(mig022, /office_branches/);
  assert.match(mig022, /backfilled via case_id/);
  assert.match(mig022, /unresolved after trusted backfill/);
  assert.match(mig022, /quarantined unresolved rows/);
  assert.match(mig022, /ALTER TABLE tasks ALTER COLUMN office_id SET NOT NULL/);
  assert.match(mig022, /RAISE EXCEPTION/);
  assert.match(mig022, /idx_tasks_office_id/);
  assert.match(mig022, /FK to office_page intentionally omitted/);
  assert.doesNotMatch(mig022, /ORDER BY created_at LIMIT 1/); // no first-office guess
  const migBody = mig022.slice(mig022.indexOf("BEGIN;"));
  assert.doesNotMatch(migBody, /current_setting\('app\.current/i);
  assert.doesNotMatch(migBody, /logged.in tenant|current user/i);
  assert.match(visTs, /Legacy NULL office_id rows are orphans|POST \/office-tasks|autopilot/i);
  console.log("  ✅ migration backfills only trusted joins; quarantines ambiguous; NOT NULL gated");
}

console.log("\n═══ frontend preserved ═══");

{
  assert.match(feTasks, /if \(!r\.ok\) throw new Error/);
  assert.match(feTasks, /statusFilter/);
  assert.match(feTasks, /assigneeFilter/);
  assert.match(feTasks, /p\.set\("priority"/);
  assert.match(feTasks, /p\.set\("search"/);
  console.log("  ✅ delete validation + filters intact");
}

console.log("\n✅ office-tasks strict ownership checks passed\n");
