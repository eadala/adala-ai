/**
 * Stage 15 — strict office-tasks PATCH/DELETE ownership.
 * Run: pnpm --filter @workspace/api-server run test:office-tasks-mutate
 *
 * Legacy NULL office_id tasks are listable (GET) but not mutable — orphans
 * pending a separate data migration/cleanup stage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canMutateTaskOffice,
  isTaskListedForTenant,
  resolveMutationOfficeId,
  toUuid,
} from "../lib/taskTenantVisibility";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..");
const tasksTs = readFileSync(join(SRC, "modules/operations/tasks.ts"), "utf8");
const visTs = readFileSync(join(SRC, "lib/taskTenantVisibility.ts"), "utf8");
const feTasks = readFileSync(
  resolve(__dirname, "../../../adala/src/pages/operations/tasks.tsx"),
  "utf8",
);

const TENANT_A = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

console.log("\n═══ resolveMutationOfficeId / canMutateTaskOffice ═══");

{
  assert.equal(toUuid(TENANT_A), TENANT_A);
  assert.equal(resolveMutationOfficeId(TENANT_A), TENANT_A);
  assert.equal(resolveMutationOfficeId("platform"), null);
  assert.equal(resolveMutationOfficeId("trial_office_x"), null);

  assert.equal(canMutateTaskOffice(TENANT_A, TENANT_A), true, "own office ok");
  assert.equal(canMutateTaskOffice(TENANT_B, TENANT_A), false, "cross-tenant blocked");
  assert.equal(canMutateTaskOffice(null, TENANT_A), false, "NULL office not mutable");
  assert.equal(canMutateTaskOffice("", TENANT_A), false);
  assert.equal(canMutateTaskOffice(TENANT_A, "platform"), false, "non-UUID cannot mutate");
  assert.equal(canMutateTaskOffice(null, "platform"), false);
  console.log("  ✅ own ok; cross-tenant / NULL / non-UUID denied");
}

console.log("\n═══ GET list still allows legacy NULL (read-only) ═══");

{
  assert.equal(isTaskListedForTenant(null, TENANT_A), true);
  assert.equal(isTaskListedForTenant(TENANT_B, TENANT_A), false);
  assert.match(visTs, /legacy orphans|Legacy NULL|orphan/i);
  assert.match(visTs, /separate.*migration|cleanup/i);

  const getStart = tasksTs.indexOf('router.get("/office-tasks"');
  const getEnd = tasksTs.indexOf('router.get("/office-tasks/stats"');
  const getRoute = tasksTs.slice(getStart, getEnd);
  assert.match(getRoute, /taskListOfficeCond/);
  assert.match(
    tasksTs,
    /function taskListOfficeCond[\s\S]*?office_id IS NULL/,
  );
  /* Mutations must not reuse list predicate */
  const mutStart = tasksTs.indexOf("router.patch");
  assert.doesNotMatch(tasksTs.slice(mutStart), /taskListOfficeCond/);
  console.log("  ✅ GET keeps temporary NULL readability; documented as orphan");
}

console.log("\n═══ DELETE: strict ownership + 403 + 404 ═══");

{
  const start = tasksTs.indexOf('router.delete("/office-tasks/:id"');
  assert.ok(start >= 0);
  const end = tasksTs.indexOf("export default", start);
  const route = tasksTs.slice(start, end === -1 ? undefined : end);

  assert.match(route, /resolveMutationOfficeId/);
  assert.match(route, /status\(403\)/);
  assert.match(route, /TNT_403/);
  assert.match(route, /taskMutationOfficePred/);
  assert.match(route, /RETURNING id/);
  assert.match(route, /if \(!row\) return res\.status\(404\)/);
  assert.doesNotMatch(route, /office_id IS NULL/);
  assert.doesNotMatch(route, /WHERE TRUE|sql`TRUE`/);
  assert.doesNotMatch(route, /taskTenantVisibilityPred|taskListOfficeCond/);
  const okIdx = route.indexOf("res.json({ ok: true })");
  const checkIdx = route.indexOf("if (!row)");
  assert.ok(checkIdx >= 0 && okIdx > checkIdx);
  console.log("  ✅ DELETE: office_id = office only; 403 without UUID; 404 on miss");
}

console.log("\n═══ PATCH: same strict rules ═══");

{
  const start = tasksTs.indexOf('router.patch("/office-tasks/:id"');
  assert.ok(start >= 0);
  const end = tasksTs.indexOf('router.delete("/office-tasks/:id"');
  const route = tasksTs.slice(start, end === -1 ? undefined : end);

  assert.match(route, /resolveMutationOfficeId/);
  assert.match(route, /status\(403\)/);
  assert.match(route, /taskMutationOfficePred/);
  assert.match(route, /RETURNING \*/);
  assert.match(route, /if \(!row\) return res\.status\(404\)/);
  assert.doesNotMatch(route, /office_id IS NULL/);
  assert.doesNotMatch(route, /sql`TRUE`/);
  console.log("  ✅ PATCH: strict office_id; 403 / 404");
}

console.log("\n═══ mutation SQL predicate source ═══");

{
  assert.match(
    tasksTs,
    /function taskMutationOfficePred\(officeId: string\) \{\s*return sql`office_id = \$\{officeId\}::uuid`;/s,
  );
  assert.doesNotMatch(
    tasksTs.slice(tasksTs.indexOf("router.patch")),
    /OR office_id IS NULL/,
  );
  console.log("  ✅ final mutate predicate: office_id = ${officeId}::uuid");
}

console.log("\n═══ mutation outcome matrix ═══");

{
  type Outcome = "ok" | "404" | "403";
  function mutateOutcome(
    taskOfficeId: string | null,
    actorTenant: string,
  ): Outcome {
    if (!resolveMutationOfficeId(actorTenant)) return "403";
    return canMutateTaskOffice(taskOfficeId, actorTenant) ? "ok" : "404";
  }

  assert.equal(mutateOutcome(TENANT_A, TENANT_A), "ok");
  assert.equal(mutateOutcome(TENANT_B, TENANT_A), "404");
  assert.equal(mutateOutcome(null, TENANT_A), "404");
  assert.equal(mutateOutcome(TENANT_A, "platform"), "403");
  assert.equal(mutateOutcome(null, "platform"), "403");
  console.log("  ✅ own ok; other/NULL → 404; non-UUID → 403");
}

console.log("\n═══ no platform-wide mutate shortcut ═══");

{
  const mutStart = tasksTs.indexOf("router.patch");
  const mutSlice = tasksTs.slice(mutStart);
  assert.doesNotMatch(mutSlice, /isSuperAdmin|checkIsSuperAdmin|platform.*mutate/i);
  assert.doesNotMatch(mutSlice, /WHERE TRUE/);
  console.log("  ✅ no inferred platform mutation path in this stage");
}

console.log("\n═══ frontend: delete handling + filters preserved ═══");

{
  assert.match(feTasks, /if \(!r\.ok\) throw new Error/);
  assert.match(feTasks, /onError:\s*\(e:\s*any\)\s*=>/);
  assert.match(feTasks, /statusFilter/);
  assert.match(feTasks, /assigneeFilter/);
  assert.match(
    feTasks,
    /queryKey:\s*\["tasks",\s*view,\s*page,\s*search,\s*priorityFilter,\s*statusFilter,\s*assigneeFilter\]/,
  );
  assert.match(feTasks, /p\.set\("status",\s*statusFilter\)/);
  assert.match(feTasks, /p\.set\("assignee",\s*assigneeFilter\.trim\(\)\)/);
  assert.match(feTasks, /p\.set\("priority",\s*priorityFilter\)/);
  assert.match(feTasks, /p\.set\("search",\s*search\.trim\(\)\)/);
  console.log("  ✅ FE delete validation + status/assignee/search/priority intact");
}

console.log("\n✅ office-tasks strict mutate isolation checks passed\n");
