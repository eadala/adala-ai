/**
 * Stage 15 — office-tasks DELETE/PATCH tenant visibility + 404 on zero rows.
 * Run: pnpm --filter @workspace/api-server run test:office-tasks-mutate
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isTaskVisibleToTenant,
  toUuid,
} from "../lib/taskTenantVisibility";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..");
const tasksTs = readFileSync(join(SRC, "modules/operations/tasks.ts"), "utf8");
const feTasks = readFileSync(
  resolve(__dirname, "../../../adala/src/pages/operations/tasks.tsx"),
  "utf8",
);

const TENANT_A = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

console.log("\n═══ visibility rule (aligned GET/PATCH/DELETE) ═══");

{
  assert.equal(toUuid(TENANT_A), TENANT_A);
  assert.equal(toUuid("platform"), null);
  assert.equal(toUuid("trial_office_x"), null);

  assert.equal(isTaskVisibleToTenant(TENANT_A, TENANT_A), true);
  assert.equal(isTaskVisibleToTenant(null, TENANT_A), true, "legacy NULL office visible");
  assert.equal(isTaskVisibleToTenant("", TENANT_A), true);
  assert.equal(isTaskVisibleToTenant(TENANT_B, TENANT_A), false, "cross-tenant blocked");
  assert.equal(isTaskVisibleToTenant(TENANT_A, TENANT_B), false);

  /* Non-UUID tenant matches GET WHERE TRUE */
  assert.equal(isTaskVisibleToTenant(TENANT_A, "platform"), true);
  assert.equal(isTaskVisibleToTenant(null, "platform"), true);
  console.log("  ✅ own / NULL visible; other office blocked; platform unrestricted");
}

console.log("\n═══ DELETE route: RETURNING + 404, shared visibility ═══");

{
  const start = tasksTs.indexOf('router.delete("/office-tasks/:id"');
  assert.ok(start >= 0);
  const end = tasksTs.indexOf("export default", start);
  const route = tasksTs.slice(start, end === -1 ? undefined : end);

  assert.match(route, /taskTenantVisibilityPred/);
  assert.match(route, /RETURNING id/);
  assert.match(route, /status\(404\)/);
  assert.match(route, /if \(!row\)/);
  assert.doesNotMatch(
    route,
    /office_id\s*=\s*\$\{tenantId\}(?!.*IS NULL)/s,
  );
  /* Must not return ok:true without checking RETURNING */
  assert.match(route, /if \(!row\) return res\.status\(404\)/);
  const okIdx = route.indexOf("res.json({ ok: true })");
  const checkIdx = route.indexOf("if (!row)");
  assert.ok(checkIdx >= 0 && okIdx > checkIdx, "404 check before ok:true");
  console.log("  ✅ DELETE uses visibility pred, RETURNING id, 404 on zero rows");
}

console.log("\n═══ PATCH route: same visibility + 404 ═══");

{
  const start = tasksTs.indexOf('router.patch("/office-tasks/:id"');
  assert.ok(start >= 0);
  const end = tasksTs.indexOf('router.delete("/office-tasks/:id"');
  const route = tasksTs.slice(start, end === -1 ? undefined : end);

  assert.match(route, /taskTenantVisibilityPred/);
  assert.match(route, /RETURNING \*/);
  assert.match(route, /status\(404\)/);
  assert.match(route, /if \(!row\) return res\.status\(404\)/);
  assert.doesNotMatch(route, /AND office_id = \$\{tenantId\}/);
  console.log("  ✅ PATCH uses visibility pred + 404 when no row updated");
}

console.log("\n═══ GET + mutate share office_id IS NULL predicate ═══");

{
  assert.match(
    tasksTs,
    /office_id = \$\{officeId\}::uuid OR office_id IS NULL/,
  );
  assert.match(tasksTs, /function taskTenantVisibilityPred/);
  assert.match(tasksTs, /function taskListOfficeCond/);
  /* GET list uses shared cond */
  const getStart = tasksTs.indexOf('router.get("/office-tasks"');
  const getEnd = tasksTs.indexOf('router.get("/office-tasks/stats"');
  const getRoute = tasksTs.slice(getStart, getEnd);
  assert.match(getRoute, /taskListOfficeCond/);
  console.log("  ✅ GET/PATCH/DELETE share UUID-or-NULL visibility helper");
}

console.log("\n═══ mutation outcome matrix (documented rule) ═══");

{
  type Outcome = "ok" | "404";
  function mutateOutcome(
    taskOfficeId: string | null,
    actorTenant: string,
  ): Outcome {
    return isTaskVisibleToTenant(taskOfficeId, actorTenant) ? "ok" : "404";
  }

  assert.equal(mutateOutcome(TENANT_A, TENANT_A), "ok", "successful delete/patch");
  assert.equal(mutateOutcome(null, TENANT_A), "ok", "legacy NULL deletable by visible tenant");
  assert.equal(mutateOutcome(TENANT_B, TENANT_A), "404", "cross-tenant blocked");
  assert.equal(mutateOutcome(TENANT_A, TENANT_B), "404");
  console.log("  ✅ success / NULL-legacy / cross-tenant outcomes match visibility rule");
}

console.log("\n═══ frontend: deleteMutation + status/assignee filters ═══");

{
  assert.match(feTasks, /const deleteMutation = useMutation/);
  assert.match(feTasks, /if \(!r\.ok\) throw new Error/);
  assert.match(feTasks, /onError:\s*\(e:\s*any\)\s*=>/);
  assert.match(feTasks, /فشل حذف المهمة/);

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
  console.log("  ✅ FE checks r.ok, onError; status+assignee in key and query params");
}

console.log("\n✅ office-tasks mutate visibility checks passed\n");
