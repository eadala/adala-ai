/**
 * Stage 15.2d — Autopilot failure signaling (structured task-creation result).
 * Run: pnpm --filter @workspace/api-server run test:autopilot
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyAutopilotInsertOutcome,
  createAutopilotTasks,
  httpStatusForAutopilotTaskCreation,
  planAutopilotTasks,
  resolveAutopilotOfficeId,
  type AutopilotTaskDb,
  type AutopilotTaskCreateResult,
} from "../agents/autopilotTaskCreation";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const creationTs = readFileSync(join(SRC, "agents/autopilotTaskCreation.ts"), "utf8");
const autopilotTs = readFileSync(join(SRC, "agents/caseAutopilot.ts"), "utf8");
const casesTs = readFileSync(join(SRC, "modules/legal-core/cases.ts"), "utf8");
const listenerTs = readFileSync(join(SRC, "core/listeners/autopilotListener.ts"), "utf8");

const OFFICE_UUID = "550e8400-e29b-41d4-a716-446655440099";

function incompleteCtx(overrides: Record<string, unknown> = {}) {
  return {
    case: {
      id: "case-1",
      title: "قضية اختبار",
      status: "open",
      client_name: null as string | null,
      description: "",
      assigned_to: null as string | null,
      ...overrides,
    },
    documents: [] as unknown[],
    events: [] as Array<{ start_at?: string | null }>,
    contracts: [] as unknown[],
    invoices: [] as unknown[],
    tasks: [] as unknown[],
  };
}

function completeCtx() {
  return {
    case: {
      id: "case-2",
      title: "قضية مكتملة",
      status: "open",
      client_name: "عميل",
      description: "وصف تفصيلي طويل بما يكفي لاجتياز الحد الأدنى للوصف",
      assigned_to: "lawyer-1",
    },
    documents: [{ id: "d1" }],
    events: [{ start_at: new Date(Date.now() + 86400000).toISOString() }],
    contracts: [{ id: "c1" }],
    invoices: [],
    tasks: [],
  };
}

function mockDb(opts: {
  failOnInsert?: boolean;
  captureOfficeIds?: string[];
}): AutopilotTaskDb & { insertCount: () => number } {
  let inserts = 0;
  const capture = opts.captureOfficeIds ?? [];
  const execute = async (q: unknown) => {
    const text = (() => {
      try { return JSON.stringify(q); } catch { return String(q); }
    })();
    if (text.includes("INSERT INTO tasks")) {
      if (opts.failOnInsert) {
        throw Object.assign(new Error("forced insert failure"), { code: "23502" });
      }
      inserts += 1;
      const m = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (m) capture.push(m[0]);
    }
    return { rows: [] };
  };
  return {
    insertCount: () => inserts,
    execute,
    transaction: async (fn) => fn({ execute }),
  };
}

console.log("\n═══ resolveAutopilotOfficeId — UUID only ═══");
{
  assert.equal(resolveAutopilotOfficeId(OFFICE_UUID), OFFICE_UUID);
  for (const bad of [null, undefined, "", "default", "platform", "trial_abc", "not-a-uuid"]) {
    assert.equal(resolveAutopilotOfficeId(bad), null, `must reject ${String(bad)}`);
  }
  assert.doesNotMatch(creationTs, /officeId\s*\?\?\s*["']default["']/);
  assert.doesNotMatch(creationTs, /tenantId\s*\|\|\s*["']default["']/);
  console.log("  ✅ no default/platform/trial_/NULL office id used");
}

console.log("\n═══ classifyAutopilotInsertOutcome ═══");
{
  const zero = classifyAutopilotInsertOutcome({ planned: 0, created: 0 });
  assert.equal(zero.status, "success");
  assert.equal(zero.created, 0);

  const ok = classifyAutopilotInsertOutcome({ planned: 3, created: 3, officeId: OFFICE_UUID });
  assert.equal(ok.status, "success");
  assert.equal(ok.created, 3);

  const miss = classifyAutopilotInsertOutcome({
    planned: 4,
    created: 0,
    skipped: 4,
    reason: "MISSING_CANONICAL_OFFICE_UUID",
  });
  assert.equal(miss.status, "skipped");
  assert.notEqual(miss.status, "success");

  const fail = classifyAutopilotInsertOutcome({
    planned: 4,
    created: 0,
    failed: 4,
    reason: "DB_INSERT_FAILED",
  });
  assert.equal(fail.status, "failed");

  const partial = classifyAutopilotInsertOutcome({
    planned: 4,
    created: 2,
    failed: 2,
    reason: "partial_insert",
  });
  assert.equal(partial.status, "partial");

  /* planned > 0 && created = 0 must never be success */
  assert.notEqual(
    classifyAutopilotInsertOutcome({ planned: 1, created: 0, failed: 1 }).status,
    "success",
  );
  console.log("  ✅ status contract: success / partial / failed / skipped");
}

console.log("\n═══ createAutopilotTasks — success (all inserted) ═══");
{
  const db = mockDb({});
  const planned = planAutopilotTasks(incompleteCtx());
  assert.ok(planned.length > 0);
  const result = await createAutopilotTasks(incompleteCtx(), [], OFFICE_UUID, db);
  assert.equal(result.status, "success");
  assert.equal(result.planned, planned.length);
  assert.equal(result.created, planned.length);
  assert.equal(result.created, db.insertCount());
  assert.equal(result.officeId, OFFICE_UUID);
  assert.equal(result.failed, 0);
  assert.equal(result.skipped, 0);
  console.log("  ✅ valid office UUID + all tasks inserted → success; created matches inserts");
}

console.log("\n═══ createAutopilotTasks — zero planned → success ═══");
{
  const db = mockDb({});
  const result = await createAutopilotTasks(completeCtx(), [], OFFICE_UUID, db);
  assert.equal(result.status, "success");
  assert.equal(result.planned, 0);
  assert.equal(result.created, 0);
  assert.equal(db.insertCount(), 0);
  console.log("  ✅ zero planned tasks → valid success with created 0");
}

console.log("\n═══ createAutopilotTasks — missing/invalid office ═══");
{
  for (const bad of ["default", "platform", "trial_xyz", null, ""]) {
    const db = mockDb({});
    const result = await createAutopilotTasks(incompleteCtx(), [], bad, db);
    assert.ok(result.planned > 0, "planned work expected");
    assert.equal(result.created, 0);
    assert.equal(result.skipped, result.planned);
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "MISSING_CANONICAL_OFFICE_UUID");
    assert.equal(db.insertCount(), 0);
    assert.notEqual(result.status, "success");
  }
  console.log("  ✅ missing/invalid office → skipped with explicit reason; no inserts");
}

console.log("\n═══ createAutopilotTasks — DB insert failure ═══");
{
  const db = mockDb({ failOnInsert: true });
  const result = await createAutopilotTasks(incompleteCtx(), [], OFFICE_UUID, db);
  assert.equal(result.status, "failed");
  assert.ok(result.planned > 0);
  assert.equal(result.created, 0);
  assert.equal(result.failed, result.planned);
  assert.equal(result.reason, "DB_INSERT_FAILED");
  assert.ok(result.errors && result.errors.length > 0);
  assert.notEqual(result.status, "success");
  console.log("  ✅ database insert failure → no silent success");
}

console.log("\n═══ partial result classification (intentional support) ═══");
{
  const partial: AutopilotTaskCreateResult = classifyAutopilotInsertOutcome({
    planned: 5,
    created: 3,
    failed: 2,
  });
  assert.equal(partial.status, "partial");
  assert.equal(httpStatusForAutopilotTaskCreation(partial), 207);
  console.log("  ✅ partial status supported with exact counts");
}

console.log("\n═══ HTTP route — no misleading 200 ═══");
{
  assert.match(casesTs, /httpStatusForAutopilotTaskCreation/);
  assert.match(casesTs, /taskCreation/);
  assert.match(casesTs, /res\.status\(httpStatus\)/);
  assert.match(casesTs, /Never HTTP 200 with tasksCreated:0 when planned > 0/);

  assert.equal(
    httpStatusForAutopilotTaskCreation({
      status: "success", planned: 3, created: 3, failed: 0, skipped: 0,
    }),
    200,
  );
  assert.equal(
    httpStatusForAutopilotTaskCreation({
      status: "success", planned: 0, created: 0, failed: 0, skipped: 0,
    }),
    200,
  );
  assert.equal(
    httpStatusForAutopilotTaskCreation({
      status: "skipped",
      planned: 4,
      created: 0,
      failed: 0,
      skipped: 4,
      reason: "MISSING_CANONICAL_OFFICE_UUID",
    }),
    422,
  );
  assert.equal(
    httpStatusForAutopilotTaskCreation({
      status: "failed",
      planned: 4,
      created: 0,
      failed: 4,
      skipped: 0,
      reason: "DB_INSERT_FAILED",
    }),
    422,
  );
  assert.equal(
    httpStatusForAutopilotTaskCreation({
      status: "partial", planned: 4, created: 2, failed: 2, skipped: 0,
    }),
    207,
  );
  console.log("  ✅ HTTP route does not return misleading 200 when planned > 0 && created = 0");
}

console.log("\n═══ listener — no success log on failure; no default fallback ═══");
{
  assert.doesNotMatch(listenerTs, /officeId\s*\?\?\s*["']default["']/);
  assert.match(listenerTs, /resolveAutopilotOfficeId/);
  assert.match(listenerTs, /task_creation_not_success/);
  assert.match(listenerTs, /planned/);
  assert.match(listenerTs, /created/);
  assert.match(listenerTs, /failed/);
  assert.match(listenerTs, /skipped/);
  assert.match(listenerTs, /status/);
  assert.match(listenerTs, /reason/);
  assert.match(listenerTs, /tenantId/);
  assert.match(listenerTs, /officeId/);
  assert.match(listenerTs, /caseId/);
  assert.match(listenerTs, /must not corrupt originating event flow|Listener failure must not corrupt/);
  assert.match(listenerTs, /if \(tc\.status === "success"\)/);
  console.log("  ✅ listener does not log success on failure; structured fields present");
}

console.log("\n═══ no swallowed insert failures; created = actual inserts ═══");
{
  assert.doesNotMatch(creationTs, /\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/);
  assert.match(creationTs, /deps\.transaction|transaction\(/);
  assert.match(creationTs, /DB_INSERT_FAILED|MISSING_CANONICAL_OFFICE_UUID/);
  assert.match(autopilotTs, /tasksCreated = taskCreation\.created/);
  assert.match(autopilotTs, /taskCreation/);
  console.log("  ✅ inserts are transactional; created count is actual inserts only");
}

console.log("\n✅ autopilotFailureSignaling tests passed\n");
