/**
 * Stage 15.2e — Final integration: trial → UUID provision → tenant → tasks → Autopilot.
 * Run: pnpm --filter @workspace/api-server run test:stage152e
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCanonicalOfficeId,
  FORBIDDEN_OFFICE_IDS,
  OfficeProvisionError,
  provisionOfficeForUser,
  type OfficeProvisionDb,
} from "../lib/officeProvision";
import {
  createAutopilotTasks,
  resolveAutopilotOfficeId,
  type AutopilotTaskDb,
} from "../agents/autopilotTaskCreation";
import { resolveTaskOfficeId } from "../lib/taskTenantVisibility";
import {
  acceptNormalUserTenantId,
  assertCanonicalBusinessOfficeId,
  TenantResolutionError,
} from "../lib/tenantResolution";
import { isUuid } from "../lib/officePageResolverLogic";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

const USER = "user_stage152e_trial";
const OFFICE_UUID = "550e8400-e29b-41d4-a716-4466554400e1";

type QueryKind =
  | "select_registry"
  | "select_trial"
  | "select_member"
  | "select_page"
  | "insert_page"
  | "insert_member"
  | "select_extra_members"
  | "insert_registry"
  | "update_users"
  | "upsert_trial"
  | "upsert_onboarding"
  | "other";

function classify(q: unknown): QueryKind {
  const text = (() => {
    try { return JSON.stringify(q); } catch { return String(q); }
  })();
  if (text.includes("INSERT INTO office_page")) return "insert_page";
  if (text.includes("INSERT INTO office_members")) return "insert_member";
  if (text.includes("INSERT INTO office_registry")) return "insert_registry";
  if (text.includes("INSERT INTO trial_offices")) return "upsert_trial";
  if (text.includes("INSERT INTO onboarding_state") || text.includes("UPDATE onboarding_state")) {
    return "upsert_onboarding";
  }
  if (text.includes("UPDATE users SET office_id")) return "update_users";
  if (text.includes("FROM office_registry")) return "select_registry";
  if (text.includes("FROM trial_offices")) return "select_trial";
  if (text.includes("office_id <>") || text.includes("AND office_id <>")) return "select_extra_members";
  if (text.includes("FROM office_members")) return "select_member";
  if (text.includes("FROM office_page")) return "select_page";
  return "other";
}

function createProvisionDb(opts: {
  existingTrialId?: string | null;
  existingMemberId?: string | null;
  existingRegistryId?: string | null;
  pageExistsFor?: Set<string>;
  fixedId?: string;
}): OfficeProvisionDb & {
  officeIds: string[];
  onboardingOfficeIds: string[];
} {
  const officeIds: string[] = [];
  const onboardingOfficeIds: string[] = [];
  const pageExists = opts.pageExistsFor ?? new Set<string>();
  let minted: string | null = opts.fixedId ?? null;

  return {
    officeIds,
    onboardingOfficeIds,
    transaction: async <T>(fn: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<T>) => {
      const tx = {
        execute: async (q: unknown) => {
          const kind = classify(q);
          const text = JSON.stringify(q);
          switch (kind) {
            case "select_registry":
              return opts.existingRegistryId
                ? [{ id: opts.existingRegistryId }]
                : [];
            case "select_trial":
              return opts.existingTrialId
                ? [{ office_id: opts.existingTrialId }]
                : [];
            case "select_member":
              return opts.existingMemberId
                ? [{ office_id: opts.existingMemberId }]
                : [];
            case "select_page": {
              for (const id of pageExists) {
                if (text.includes(id)) return [{ id }];
              }
              return [];
            }
            case "insert_page": {
              const id = minted ?? OFFICE_UUID;
              minted = id;
              pageExists.add(id);
              officeIds.push(id);
              return [{ id }];
            }
            case "insert_member":
            case "insert_registry":
            case "update_users":
            case "upsert_trial":
              return [];
            case "upsert_onboarding": {
              const m = text.match(
                /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
              );
              if (m) onboardingOfficeIds.push(m[0]);
              return [];
            }
            case "select_extra_members":
              return [];
            default:
              return [];
          }
        },
      };
      return fn(tx);
    },
  };
}

function mockTaskDb(capture: string[]): AutopilotTaskDb {
  const execute = async (q: unknown) => {
    const text = JSON.stringify(q);
    if (text.includes("INSERT INTO tasks")) {
      const m = text.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
      if (m) capture.push(m[0].toLowerCase());
      if (/null|default|platform|trial_/i.test(text) && !m) {
        throw new Error("forbidden office_id in task insert");
      }
    }
    return { rows: [] };
  };
  return {
    execute,
    transaction: async (fn) => fn({ execute }),
  };
}

function incompleteCaseCtx() {
  return {
    case: {
      id: "case-152e",
      title: "قضية تكامل",
      status: "open",
      client_name: null as string | null,
      description: "",
      assigned_to: null as string | null,
    },
    documents: [] as unknown[],
    events: [] as Array<{ start_at?: string | null }>,
    contracts: [] as unknown[],
    invoices: [] as unknown[],
    tasks: [] as unknown[],
  };
}

console.log("\n═══ Stage 15.2e source: no unsafe business fallbacks ═══");
{
  const onboard = readSrc("modules/platform/onboarding.ts");
  const trial = readSrc("modules/platform/trialOnboarding.ts");
  const caseEvents = readSrc("case/case.events.ts");
  const eventBus = readSrc("core/eventBus.ts");
  const listener = readSrc("core/listeners/autopilotListener.ts");
  const tasks = readSrc("modules/operations/tasks.ts");
  const caseTasks = readSrc("case/modules/tasks.ts");
  const autopilot = readSrc("agents/caseAutopilot.ts");

  assert.doesNotMatch(onboard, /resolvedOfficeId\s*=\s*[^;]*["']default["']/);
  assert.doesNotMatch(onboard, /officeForState\s*=\s*[^;]*["']default["']/);
  assert.doesNotMatch(onboard, /\?\?\s*["']default["']/);
  assert.match(onboard, /LEGACY_NON_UUID/);
  assert.match(onboard, /needsMigration/);

  assert.match(trial, /LEGACY_NON_UUID/);
  assert.match(trial, /needsMigration/);
  assert.doesNotMatch(
    trial.slice(trial.indexOf("else if (existing?.office_id)"), trial.indexOf("} else {")),
    /officeId\s*=\s*String\(existing\.office_id\)[\s\S]*INSERT INTO cases/,
  );

  assert.match(caseEvents, /officeId/);
  assert.match(caseEvents, /canonicalOfficeId|isUuid/);
  assert.doesNotMatch(caseEvents, /officeId:\s*["']default["']/);

  assert.doesNotMatch(eventBus, /officeId\s*\?\?\s*["']default["']/);
  assert.match(eventBus, /persistOfficeId|isUuid/);

  assert.doesNotMatch(listener, /\?\?\s*["']default["']/);
  assert.match(listener, /resolveAutopilotOfficeId/);

  const notifListener = readSrc("core/listeners/notificationListener.ts");
  const notifOwn = readSrc("lib/notificationOwnership.ts");
  assert.doesNotMatch(notifListener, /officeId\s*\?\?\s*["']default["']/);
  assert.doesNotMatch(notifOwn, /\?\?\s*["']default["']/);
  assert.match(notifOwn, /resolveAutopilotOfficeId/);
  assert.match(notifListener, /deliverOwnedNotification|notificationOwnership/);

  assert.match(tasks, /resolveTaskOfficeId/);
  assert.match(tasks, /\$\{officeId\}::uuid/);
  assert.doesNotMatch(tasks, /office_id IS NULL/);

  assert.match(caseTasks, /resolveTaskOfficeId/);
  assert.match(caseTasks, /صلاحية تحديث المهمة مرفوضة/);

  assert.match(autopilot, /office_id = \$\{tenantId\}/);
  console.log("  ✅ scoped sources: no default invent; legacy fail-closed; CASE_CREATED carries officeId");
}

console.log("\n═══ new trial onboarding → task creation (same UUID) ═══");
{
  const db = createProvisionDb({ fixedId: OFFICE_UUID });
  const first = await provisionOfficeForUser(
    {
      ownerUserId: USER,
      officeName: "مكتب تكامل",
      plan: "trial",
      lifecycle: "trial",
      context: "onboarding_setup",
      writeTrialOffices: true,
      onboarding: { completed: true, step: 10, data: {} },
    },
    { db },
  );
  assert.equal(first.officeId, OFFICE_UUID);
  assert.equal(assertCanonicalOfficeId(first.officeId), OFFICE_UUID);

  const tenant = acceptNormalUserTenantId(first.officeId, {
    userId: USER,
    source: "stage152e",
  });
  assert.equal(tenant, OFFICE_UUID);

  const taskOffice = resolveTaskOfficeId(tenant);
  assert.equal(taskOffice, OFFICE_UUID);

  const captured: string[] = [];
  assert.ok(taskOffice);
  const taskResult = await createAutopilotTasks(
    incompleteCaseCtx(),
    [],
    taskOffice,
    mockTaskDb(captured),
  );
  assert.equal(taskResult.status, "success");
  assert.ok(taskResult.planned > 0);
  assert.equal(taskResult.created, taskResult.planned);
  assert.equal(taskResult.officeId, OFFICE_UUID);
  assert.ok(captured.every((id) => id === OFFICE_UUID.toLowerCase()));
  console.log("  ✅ new trial provision → tenant → Autopilot tasks share one UUID");
}

console.log("\n═══ onboarding retry returns the same UUID ═══");
{
  const pages = new Set<string>([OFFICE_UUID]);
  const db = createProvisionDb({
    fixedId: OFFICE_UUID,
    existingTrialId: OFFICE_UUID,
    pageExistsFor: pages,
  });
  const a = await provisionOfficeForUser(
    {
      ownerUserId: USER,
      officeName: "مكتب تكامل",
      lifecycle: "trial",
      context: "onboarding_setup",
      writeTrialOffices: true,
    },
    { db },
  );
  const b = await provisionOfficeForUser(
    {
      ownerUserId: USER,
      officeName: "مكتب تكامل",
      lifecycle: "trial",
      context: "onboarding_setup",
      writeTrialOffices: true,
    },
    { db },
  );
  assert.equal(a.officeId, b.officeId);
  assert.equal(a.officeId, OFFICE_UUID);
  assert.equal(db.officeIds.length, 0, "retry must not insert a second office_page");
  console.log("  ✅ retry is idempotent — same UUID, no duplicate office");
}

console.log("\n═══ HEAL recovery through task creation ═══");
{
  const db = createProvisionDb({ fixedId: OFFICE_UUID });
  const healed = await provisionOfficeForUser(
    {
      ownerUserId: "user_heal_152e",
      officeName: "مكتب الشفاء",
      lifecycle: "trial",
      context: "onboarding_state",
      writeTrialOffices: true,
      onboarding: { completed: true, step: 10, data: {} },
    },
    { db },
  );
  const resolved = assertCanonicalBusinessOfficeId(healed.officeId, {
    userId: "user_heal_152e",
    source: "heal",
  });
  const captured: string[] = [];
  const result = await createAutopilotTasks(
    incompleteCaseCtx(),
    [],
    resolved,
    mockTaskDb(captured),
  );
  assert.equal(result.officeId, OFFICE_UUID);
  assert.equal(result.status, "success");
  assert.ok(captured.every((id) => id === OFFICE_UUID.toLowerCase()));
  console.log("  ✅ HEAL provision UUID flows into task inserts");
}

console.log("\n═══ CASE_CREATED → Autopilot uses same UUID ═══");
{
  const caseEntity = {
    id: "case-created-1",
    title: "قضية",
    officeId: OFFICE_UUID,
    createdBy: USER,
  };
  const eventOfficeId = resolveAutopilotOfficeId(caseEntity.officeId);
  assert.equal(eventOfficeId, OFFICE_UUID);

  /* Simulate listener refusal without UUID */
  assert.equal(resolveAutopilotOfficeId(undefined), null);
  assert.equal(resolveAutopilotOfficeId("default"), null);

  assert.ok(eventOfficeId);
  const captured: string[] = [];
  const result = await createAutopilotTasks(
    incompleteCaseCtx(),
    [],
    eventOfficeId,
    mockTaskDb(captured),
  );
  assert.equal(result.officeId, OFFICE_UUID);
  assert.ok(captured.length === result.created);
  console.log("  ✅ CASE_CREATED office UUID is the Autopilot insert office");
}

console.log("\n═══ legacy trial user fails closed (no duplicate office) ═══");
{
  const legacy = "trial_legacy_152e";
  const db = createProvisionDb({ existingTrialId: legacy });
  await assert.rejects(
    () =>
      provisionOfficeForUser(
        {
          ownerUserId: "user_legacy_152e",
          officeName: "قديم",
          lifecycle: "trial",
          context: "onboarding_setup",
          writeTrialOffices: true,
        },
        { db },
      ),
    (e: unknown) =>
      e instanceof OfficeProvisionError && e.code === "LEGACY_NON_UUID",
  );
  assert.equal(db.officeIds.length, 0);

  assert.throws(
    () =>
      acceptNormalUserTenantId(legacy, {
        userId: "user_legacy_152e",
        source: "tenant",
      }),
    (e: unknown) => e instanceof TenantResolutionError,
  );
  assert.equal(resolveTaskOfficeId(legacy), null);
  assert.equal(resolveAutopilotOfficeId(legacy), null);

  const captured: string[] = [];
  const result = await createAutopilotTasks(
    incompleteCaseCtx(),
    [],
    legacy,
    mockTaskDb(captured),
  );
  assert.equal(result.status, "skipped");
  assert.equal(result.created, 0);
  assert.equal(captured.length, 0);
  console.log("  ✅ legacy trial_* → migration-required path; no second office; no task writes");
}

console.log("\n═══ default/platform/arbitrary text cannot enter task rows ═══");
{
  for (const bad of ["default", "platform", "not-a-uuid", "", null] as const) {
    assert.equal(resolveTaskOfficeId(bad), null);
    assert.equal(resolveAutopilotOfficeId(bad), null);
    assert.ok(FORBIDDEN_OFFICE_IDS.has("default"));
    assert.ok(FORBIDDEN_OFFICE_IDS.has("platform"));
    const captured: string[] = [];
    const result = await createAutopilotTasks(
      incompleteCaseCtx(),
      [],
      bad,
      mockTaskDb(captured),
    );
    assert.equal(result.created, 0);
    assert.equal(captured.length, 0);
    assert.notEqual(result.status, "success");
  }
  console.log("  ✅ default/platform/text rejected before any task insert");
}

console.log("\n═══ no office_id NULL is created ═══");
{
  const tasksSrc = readSrc("modules/operations/tasks.ts");
  const creationSrc = readSrc("agents/autopilotTaskCreation.ts");
  const caseTasksSrc = readSrc("case/modules/tasks.ts");
  assert.match(tasksSrc, /\$\{officeId\}::uuid/);
  assert.doesNotMatch(tasksSrc, /officeId \? sql`\$\{officeId\}::uuid` : sql`NULL`/);
  assert.match(creationSrc, /\$\{officeId\}::uuid/);
  assert.match(creationSrc, /MISSING_CANONICAL_OFFICE_UUID/);
  assert.match(caseTasksSrc, /\$\{officeId\}::uuid/);
  assert.ok(isUuid(OFFICE_UUID));
  console.log("  ✅ INSERT paths require UUID; NULL office_id never written");
}

console.log("\n✅ stage152eIntegration tests passed\n");
