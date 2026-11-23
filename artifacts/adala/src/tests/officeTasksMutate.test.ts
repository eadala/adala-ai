/**
 * Tasks page — delete error handling + status/assignee filter wiring.
 * Run: pnpm --filter @workspace/adala run test:office-tasks-mutate
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(
  resolve(__dirname, "../pages/operations/tasks.tsx"),
  "utf8",
);

function sliceDeleteMutation(): string {
  const start = src.indexOf("const deleteMutation = useMutation");
  assert.ok(start >= 0, "deleteMutation must exist");
  const end = src.indexOf("const quickStatusChange", start);
  assert.ok(end > start);
  return src.slice(start, end);
}

console.log("\n═══ deleteMutation: fail closed on !ok ═══");

{
  const block = sliceDeleteMutation();
  assert.match(block, /method:\s*"DELETE"/);
  assert.match(block, /await authFetch/);
  assert.match(block, /if \(!r\.ok\) throw new Error/);
  assert.match(block, /onSuccess:/);
  assert.match(block, /onError:/);
  assert.match(block, /invalidateQueries\(\{\s*queryKey:\s*\["tasks"\]/);
  assert.match(block, /toast\(\{\s*title:\s*"تم حذف المهمة"/);
  assert.match(block, /variant:\s*"destructive"/);
  /* Success toast only in onSuccess, not in mutationFn */
  const fnStart = block.indexOf("mutationFn:");
  const onSuccessStart = block.indexOf("onSuccess:");
  const fnBody = block.slice(fnStart, onSuccessStart);
  assert.doesNotMatch(fnBody, /تم حذف المهمة/);
  console.log("  ✅ failed delete throws; success toast/invalidate only onSuccess");
}

console.log("\n═══ status + assignee filters ═══");

{
  assert.match(src, /const \[statusFilter, setStatusFilter\]/);
  assert.match(src, /const \[assigneeFilter, setAssigneeFilter\]/);
  assert.match(
    src,
    /queryKey:\s*\["tasks",\s*view,\s*page,\s*search,\s*priorityFilter,\s*statusFilter,\s*assigneeFilter\]/,
  );
  assert.match(src, /if \(statusFilter !== "all"\) p\.set\("status"/);
  assert.match(src, /if \(assigneeFilter\.trim\(\)\) p\.set\("assignee"/);
  assert.match(src, /كل الحالات/);
  assert.match(src, /تصفية بالمسؤول|كل المسؤولين/);
  /* Search + priority unchanged */
  assert.match(src, /if \(search\.trim\(\)\) p\.set\("search"/);
  assert.match(src, /if \(priorityFilter !== "all"\) p\.set\("priority"/);
  console.log("  ✅ status/assignee sent; search/priority preserved");
}

console.log("\n✅ frontend office-tasks mutate checks passed\n");
