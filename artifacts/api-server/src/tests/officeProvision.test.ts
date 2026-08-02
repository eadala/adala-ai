/**
 * Canonical office provision helper — atomicity, idempotency, fail-closed.
 * Run: pnpm --filter @workspace/api-server exec node --import tsx src/tests/officeProvision.test.ts
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
import { isUuid } from "../lib/officePageResolverLogic";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

const USER_A = "user_office_provision_a";
const OFFICE_UUID = "550e8400-e29b-41d4-a716-446655440099";

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
  if (text.includes("INSERT INTO onboarding_state")) return "upsert_onboarding";
  if (text.includes("UPDATE users SET office_id")) return "update_users";
  if (text.includes("FROM office_registry")) return "select_registry";
  if (text.includes("FROM trial_offices")) return "select_trial";
  if (text.includes("office_id <>") || text.includes("AND office_id <>")) return "select_extra_members";
  if (text.includes("FROM office_members")) return "select_member";
  if (text.includes("FROM office_page")) return "select_page";
  return "other";
}

function createMockDb(opts: {
  existingRegistryId?: string | null;
  existingTrialId?: string | null;
  existingMemberId?: string | null;
  pageExistsFor?: Set<string>;
  failOn?: QueryKind;
  extraActiveOffices?: string[];
  capture?: QueryKind[];
}): OfficeProvisionDb & { rolledBack: () => boolean; lastInsertedId: () => string | null } {
  const capture = opts.capture ?? [];
  let rolledBack = false;
  let lastInsertedId: string | null = null;
  const pageExists = opts.pageExistsFor ?? new Set<string>();

  return {
    rolledBack: () => rolledBack,
    lastInsertedId: () => lastInsertedId,
    transaction: async <T>(fn: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<T>) => {
      const tx = {
        execute: async (q: unknown) => {
          const kind = classify(q);
          capture.push(kind);
          if (opts.failOn && kind === opts.failOn) {
            throw Object.assign(new Error(`forced failure on ${kind}`), { code: "TEST_FAIL" });
          }
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
              const text = JSON.stringify(q);
              for (const id of pageExists) {
                if (text.includes(id)) return [{ id, slug: `slug-${id.slice(0, 8)}` }];
              }
              if (lastInsertedId && text.includes(lastInsertedId)) {
                return [{ id: lastInsertedId, slug: `slug-${lastInsertedId.slice(0, 8)}` }];
              }
              return [];
            }
            case "insert_page": {
              lastInsertedId = OFFICE_UUID;
              pageExists.add(OFFICE_UUID);
              return [{ id: OFFICE_UUID, slug: "test-office-550e8400" }];
            }
            case "select_extra_members":
              return (opts.extraActiveOffices ?? []).map((office_id) => ({ office_id }));
            case "insert_member":
            case "insert_registry":
            case "update_users":
            case "upsert_trial":
            case "upsert_onboarding":
            case "other":
              return [];
            default:
              return [];
          }
        },
      };
      try {
        return await fn(tx);
      } catch (e) {
        rolledBack = true;
        throw e;
      }
    },
  };
}

console.log("\n═══ assertCanonicalOfficeId ═══");

{
  assert.equal(assertCanonicalOfficeId(OFFICE_UUID), OFFICE_UUID);
  for (const bad of ["trial_abc", "default", "platform", null, undefined, "not-a-uuid"]) {
    assert.throws(
      () => assertCanonicalOfficeId(bad as string),
      (err: unknown) => err instanceof OfficeProvisionError && err.code === "INVALID_OFFICE_ID",
    );
  }
  assert.ok(FORBIDDEN_OFFICE_IDS.has("platform"));
  console.log("  ✅ rejects trial_*/default/platform/NULL/non-UUID");
}

console.log("\n═══ successful atomic provision ═══");

{
  const capture: QueryKind[] = [];
  const mock = createMockDb({ capture });
  const result = await provisionOfficeForUser(
    {
      ownerUserId: USER_A,
      officeName: "مكتب الاختبار",
      lifecycle: "trial",
      context: "onboarding_setup",
      specialty: "تجاري",
      writeTrialOffices: true,
      onboarding: { completed: true, step: 10, data: { officeName: "مكتب الاختبار" } },
    },
    { db: mock },
  );
  assert.equal(result.created, true);
  assert.equal(result.officeId, OFFICE_UUID);
  assert.ok(isUuid(result.officeId));
  assert.ok(capture.includes("insert_page"));
  assert.ok(capture.includes("insert_member"));
  assert.ok(capture.includes("insert_registry"));
  assert.ok(capture.includes("upsert_trial"));
  assert.ok(capture.includes("upsert_onboarding"));
  assert.equal(mock.rolledBack(), false);
  console.log("  ✅ creates office_page + members + registry + trial + onboarding");
}

console.log("\n═══ rollback on intermediate failure ═══");

{
  const mock = createMockDb({ failOn: "insert_registry" });
  await assert.rejects(
    () =>
      provisionOfficeForUser(
        {
          ownerUserId: USER_A,
          officeName: "مكتب",
          lifecycle: "marketplace",
          context: "marketplace",
          writeTrialOffices: false,
        },
        { db: mock },
      ),
    (err: unknown) => (err as { code?: string }).code === "TEST_FAIL",
  );
  assert.equal(mock.rolledBack(), true);
  console.log("  ✅ registry failure rolls back transaction");
}

{
  const mock = createMockDb({ failOn: "insert_member" });
  await assert.rejects(
    () =>
      provisionOfficeForUser(
        {
          ownerUserId: USER_A,
          officeName: "مكتب",
          lifecycle: "trial",
          context: "onboarding_state",
        },
        { db: mock },
      ),
  );
  assert.equal(mock.rolledBack(), true);
  console.log("  ✅ membership failure rolls back (no partial office commit)");
}

console.log("\n═══ idempotent retry ═══");

{
  const capture: QueryKind[] = [];
  const mock = createMockDb({
    existingTrialId: OFFICE_UUID,
    pageExistsFor: new Set([OFFICE_UUID]),
    capture,
  });
  const first = await provisionOfficeForUser(
    {
      ownerUserId: USER_A,
      officeName: "مكتب",
      lifecycle: "trial",
      context: "onboarding_setup",
    },
    { db: mock },
  );
  const second = await provisionOfficeForUser(
    {
      ownerUserId: USER_A,
      officeName: "مكتب محدّث",
      lifecycle: "trial",
      context: "onboarding_setup",
    },
    { db: mock },
  );
  assert.equal(first.officeId, OFFICE_UUID);
  assert.equal(second.officeId, OFFICE_UUID);
  assert.equal(first.created, false);
  assert.equal(second.created, false);
  assert.equal(capture.filter((k) => k === "insert_page").length, 0);
  console.log("  ✅ retry returns same UUID; no second office_page insert");
}

console.log("\n═══ no duplicate membership ═══");

{
  const mock = createMockDb({
    existingRegistryId: OFFICE_UUID,
    pageExistsFor: new Set([OFFICE_UUID]),
    extraActiveOffices: ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"],
  });
  await assert.rejects(
    () =>
      provisionOfficeForUser(
        {
          ownerUserId: USER_A,
          officeName: "مكتب",
          lifecycle: "marketplace",
          context: "marketplace",
          writeTrialOffices: false,
        },
        { db: mock },
      ),
    (err: unknown) =>
      err instanceof OfficeProvisionError && err.code === "DUPLICATE_ACTIVE_MEMBERSHIP",
  );
  assert.equal(mock.rolledBack(), true);
  console.log("  ✅ second active membership fails closed");
}

console.log("\n═══ legacy non-UUID blocked (no remap) ═══");

{
  const mock = createMockDb({ existingTrialId: "trial_legacyuser" });
  await assert.rejects(
    () =>
      provisionOfficeForUser(
        {
          ownerUserId: USER_A,
          officeName: "مكتب",
          lifecycle: "trial",
          context: "onboarding_setup",
        },
        { db: mock },
      ),
    (err: unknown) => err instanceof OfficeProvisionError && err.code === "LEGACY_NON_UUID",
  );
  console.log("  ✅ existing trial_* is not remapped; helper fails closed");
}

console.log("\n═══ errors not swallowed ═══");

{
  const mock = createMockDb({ failOn: "insert_page" });
  let threw = false;
  try {
    await provisionOfficeForUser(
      {
        ownerUserId: USER_A,
        officeName: "مكتب",
        lifecycle: "trial",
        context: "onboarding_setup",
      },
      { db: mock },
    );
  } catch (e: unknown) {
    threw = true;
    assert.equal((e as { code?: string }).code, "TEST_FAIL");
  }
  assert.equal(threw, true);
  assert.equal(mock.rolledBack(), true);
  console.log("  ✅ DB errors propagate (no empty catch)");
}

console.log("\n═══ route adoption (source) ═══");

{
  const marketplace = readSrc("modules/marketplace/office.ts");
  assert.match(marketplace, /provisionOfficeForUser/);
  assert.doesNotMatch(
    marketplace,
    /db\.insert\(officePageTable\)\.values\(req\.body\)\.returning\(\)/,
  );
  const postMy = marketplace.slice(
    marketplace.indexOf("/* POST create office"),
    marketplace.indexOf("/* PATCH update office"),
  );
  assert.match(postMy, /provisionOfficeForUser/);
  assert.doesNotMatch(postMy, /\.catch\(\(\)\s*=>\s*\{\}\)/);
  console.log("  ✅ marketplace POST /office/my uses helper; no swallowed side writes");
}

{
  const trial = readSrc("modules/platform/trialOnboarding.ts");
  assert.match(trial, /provisionOfficeForUser/);
  assert.doesNotMatch(trial, /trial_\$\{crypto\.randomUUID/);
  console.log("  ✅ onboarding setup uses helper; no new trial_* mint");
}

{
  const onboard = readSrc("modules/platform/onboarding.ts");
  assert.match(onboard, /provisionOfficeForUser/);
  assert.doesNotMatch(onboard, /trial_\$\{safeId\}/);
  console.log("  ✅ onboarding state uses helper for new offices");
}

{
  const helper = readSrc("lib/officeProvision.ts");
  assert.match(helper, /\.transaction\(/);
  assert.match(helper, /INSERT INTO office_page/);
  assert.match(helper, /INSERT INTO office_members/);
  assert.match(helper, /INSERT INTO office_registry/);
  assert.doesNotMatch(helper, /\.catch\(\(\)\s*=>\s*\{\}\)/);
  assert.doesNotMatch(helper, /trial_\$\{/);
  console.log("  ✅ helper is transactional, fail-closed, UUID-only");
}

{
  const heal = readSrc("middlewares/tenantMiddleware.ts");
  assert.match(heal, /TENANT-HEAL-7/);
  assert.doesNotMatch(heal, /provisionOfficeForUser/);
  console.log("  ✅ TENANT-HEAL-7 left unchanged (resolution path)");
}

console.log("\n✅ officeProvision tests passed\n");
