/**
 * Stage 15.2b — UUID tenant resolution + HEAL-7 + final non-UUID closure.
 * Run: pnpm --filter @workspace/api-server run test:tenant-heal7
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTenantId } from "../middlewares/tenantMiddleware";
import {
  LEGACY_NON_UUID_TENANT,
  PLATFORM_FORBIDDEN_FOR_USER,
  TenantResolutionError,
  acceptNormalUserTenantId,
  assertCanonicalBusinessOfficeId,
  classifyTenantId,
  isCacheableTenantId,
} from "../lib/tenantResolution";
import { isUuid } from "../lib/officePageResolverLogic";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const OFFICE_UUID = "550e8400-e29b-41d4-a716-446655440099";
const OFFICE_UUID_B = "660e8400-e29b-41d4-a716-446655440099";
const USER = "user_heal7_test";
const SA_USER = "user_super_admin";
const LEGACY = "trial_legacyheal7";
const ARBITRARY = "office_north_law_01";

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function isLegacyErr(e: unknown, officeId?: string): boolean {
  return (
    e instanceof TenantResolutionError &&
    e.code === LEGACY_NON_UUID_TENANT &&
    e.details.needsMigration === true &&
    e.details.migrationStage === "15.2c" &&
    (officeId == null || e.details.legacyOfficeId === officeId)
  );
}

type RowMap = Record<string, unknown[]>;

function createDb(rows: RowMap) {
  return {
    execute: async (q: unknown) => {
      const text = (() => {
        try { return JSON.stringify(q); } catch { return String(q); }
      })();
      if (text.includes("office_members")) {
        if (text.includes("SELECT 1 FROM office_members")) {
          return rows.headerMember ?? [];
        }
        if (text.includes("INSERT INTO office_members")) return [];
        return rows.members ?? [];
      }
      if (text.includes("FROM users")) return rows.users ?? [];
      if (text.includes("FROM office_registry")) return rows.registry ?? [];
      if (text.includes("FROM trial_offices")) return rows.trial ?? [];
      if (text.includes("FROM onboarding_state")) return rows.onboarding ?? [];
      if (text.includes("FROM developer_impersonation")) return rows.impersonation ?? [];
      if (text.includes("UPDATE users SET office_id")) return [];
      return [];
    },
  };
}

const baseDeps = {
  healInflight: () => new Map<string, Promise<string>>(),
  cache: () => new Map<string, { officeId: string; ts: number }>(),
  now: () => 1_000_000,
  isSuperAdmin: async () => false,
  provision: async () => {
    throw new Error("provision should not run");
  },
};

console.log("\n═══ classify / accept / business gate ═══");

{
  assert.equal(classifyTenantId(OFFICE_UUID), "uuid");
  assert.equal(classifyTenantId(LEGACY), "legacy_trial");
  assert.equal(classifyTenantId("default"), "default");
  assert.equal(classifyTenantId("platform"), "platform");
  assert.equal(classifyTenantId(ARBITRARY), "other");
  assert.equal(classifyTenantId(null), "empty");
  assert.equal(isCacheableTenantId(OFFICE_UUID), true);
  assert.equal(isCacheableTenantId(ARBITRARY), false);

  assert.equal(
    acceptNormalUserTenantId(OFFICE_UUID, { userId: USER, source: "t" }),
    OFFICE_UUID,
  );
  assert.throws(
    () => acceptNormalUserTenantId("default", { userId: USER, source: "t" }),
    (e: unknown) => isLegacyErr(e, "default"),
  );
  assert.throws(
    () => acceptNormalUserTenantId(LEGACY, { userId: USER, source: "office_members" }),
    (e: unknown) => isLegacyErr(e, LEGACY),
  );
  assert.throws(
    () => acceptNormalUserTenantId(ARBITRARY, { userId: USER, source: "t" }),
    (e: unknown) => isLegacyErr(e, ARBITRARY),
  );
  assert.throws(
    () => acceptNormalUserTenantId("platform", { userId: USER, source: "t" }),
    (e: unknown) =>
      e instanceof TenantResolutionError && e.code === PLATFORM_FORBIDDEN_FOR_USER,
  );

  assert.equal(
    assertCanonicalBusinessOfficeId(OFFICE_UUID, { userId: USER, source: "write" }),
    OFFICE_UUID,
  );
  for (const bad of ["default", LEGACY, ARBITRARY, "platform", null, ""]) {
    assert.throws(
      () => assertCanonicalBusinessOfficeId(bad, { userId: USER, source: "write" }),
      (e: unknown) => e instanceof TenantResolutionError,
    );
  }
  console.log("  ✅ only UUID accepted; default/trial_*/text/platform fail closed");
}

console.log("\n═══ final non-UUID closure (resolveTenantId) ═══");

{
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({ members: [{ office_id: ARBITRARY }] }),
        cache: baseDeps.cache(),
        healInflight: baseDeps.healInflight(),
        now: baseDeps.now,
        isSuperAdmin: baseDeps.isSuperAdmin,
        provision: baseDeps.provision,
      }),
    (e: unknown) => isLegacyErr(e, ARBITRARY),
  );
  console.log("  ✅ arbitrary non-UUID membership rejected");
}

{
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({ members: [], users: [{ office_id: ARBITRARY }] }),
        cache: baseDeps.cache(),
        healInflight: baseDeps.healInflight(),
        now: baseDeps.now,
        isSuperAdmin: baseDeps.isSuperAdmin,
        provision: baseDeps.provision,
      }),
    (e: unknown) => isLegacyErr(e, ARBITRARY),
  );
  console.log("  ✅ arbitrary non-UUID users.office_id rejected");
}

{
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({ members: [], users: [{ office_id: "default" }] }),
        cache: baseDeps.cache(),
        healInflight: baseDeps.healInflight(),
        now: baseDeps.now,
        isSuperAdmin: baseDeps.isSuperAdmin,
        provision: baseDeps.provision,
      }),
    (e: unknown) => isLegacyErr(e, "default"),
  );
  console.log("  ✅ default is rejected");
}

{
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({ members: [{ office_id: LEGACY }] }),
        cache: baseDeps.cache(),
        healInflight: baseDeps.healInflight(),
        now: baseDeps.now,
        isSuperAdmin: baseDeps.isSuperAdmin,
        provision: baseDeps.provision,
      }),
    (e: unknown) => isLegacyErr(e, LEGACY),
  );
  console.log("  ✅ trial_* is rejected");
}

{
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({ members: [{ office_id: "platform" }] }),
        cache: baseDeps.cache(),
        healInflight: baseDeps.healInflight(),
        now: baseDeps.now,
        isSuperAdmin: baseDeps.isSuperAdmin,
        provision: baseDeps.provision,
      }),
    (e: unknown) =>
      e instanceof TenantResolutionError && e.code === PLATFORM_FORBIDDEN_FOR_USER,
  );
  const id = await resolveTenantId(USER, undefined, {
    db: createDb({ members: [{ office_id: OFFICE_UUID }] }),
    cache: baseDeps.cache(),
    healInflight: baseDeps.healInflight(),
    now: baseDeps.now,
    isSuperAdmin: baseDeps.isSuperAdmin,
    provision: baseDeps.provision,
  });
  assert.equal(id, OFFICE_UUID);
  assert.notEqual(id, "platform");
  console.log("  ✅ normal user cannot resolve to platform; UUID still works");
}

console.log("\n═══ platform SA-only + legacy impersonation blocks writes ═══");

{
  const requireAuthSrc = readSrc("middlewares/requireAuth.ts");
  assert.match(requireAuthSrc, /tenantId = "platform"/);
  assert.match(requireAuthSrc, /checkIsSuperAdmin/);
  assert.match(requireAuthSrc, /assertCanonicalBusinessOfficeId/);
  assert.match(requireAuthSrc, /PLATFORM_FORBIDDEN_FOR_USER/);

  /* Normal user with no office → null (caller may elevate SA to platform; resolve itself never returns platform) */
  const normalNull = await resolveTenantId(USER, undefined, {
    db: createDb({ members: [], users: [], registry: [], trial: [], onboarding: [] }),
    cache: baseDeps.cache(),
    healInflight: baseDeps.healInflight(),
    now: baseDeps.now,
    isSuperAdmin: async () => false,
    provision: baseDeps.provision,
  });
  assert.equal(normalNull, null);

  const saNull = await resolveTenantId(SA_USER, undefined, {
    db: createDb({ members: [], users: [], registry: [], trial: [], onboarding: [] }),
    cache: baseDeps.cache(),
    healInflight: baseDeps.healInflight(),
    now: baseDeps.now,
    isSuperAdmin: async () => true,
    provision: baseDeps.provision,
  });
  assert.equal(saNull, null, "resolveTenantId returns null; requireAuth assigns platform only for verified SA");
  console.log("  ✅ only verified super-admin path may receive platform (via requireAuth)");
}

{
  let provisionCalls = 0;
  await assert.rejects(
    () =>
      resolveTenantId(SA_USER, undefined, {
        db: createDb({
          impersonation: [{ impersonated_office_id: LEGACY }],
          members: [],
          users: [],
          registry: [],
          trial: [],
          onboarding: [],
        }),
        cache: baseDeps.cache(),
        healInflight: baseDeps.healInflight(),
        now: baseDeps.now,
        isSuperAdmin: async () => true,
        provision: async () => {
          provisionCalls += 1;
          return { officeId: OFFICE_UUID, created: true, slug: "nope" };
        },
      }),
    (e: unknown) =>
      isLegacyErr(e, LEGACY) &&
      (e as TenantResolutionError).details.blocksBusinessWrites === true,
  );
  assert.equal(provisionCalls, 0);
  assert.throws(
    () => assertCanonicalBusinessOfficeId(LEGACY, { userId: SA_USER, source: "impersonation_write" }),
    (e: unknown) =>
      isLegacyErr(e, LEGACY) &&
      (e as TenantResolutionError).details.blocksBusinessWrites === true,
  );
  console.log("  ✅ legacy impersonation fails closed; cannot authorize business writes");
}

{
  const id = await resolveTenantId(SA_USER, undefined, {
    db: createDb({
      impersonation: [{ impersonated_office_id: OFFICE_UUID }],
      members: [],
    }),
    cache: baseDeps.cache(),
    healInflight: baseDeps.healInflight(),
    now: baseDeps.now,
    isSuperAdmin: async () => true,
    provision: baseDeps.provision,
  });
  assert.equal(id, OFFICE_UUID);
  console.log("  ✅ SA UUID impersonation still resolves to canonical office");
}

console.log("\n═══ HEAL-7: eligible onboarded user gets UUID office ═══");

{
  const cache = new Map<string, { officeId: string; ts: number }>();
  const healInflight = new Map<string, Promise<string>>();
  let provisionCalls = 0;
  const id = await resolveTenantId(USER, undefined, {
    db: createDb({
      members: [],
      users: [],
      registry: [],
      trial: [],
      onboarding: [{ office_id: "default", data: { officeName: "مكتب الشفاء" } }],
    }),
    cache,
    healInflight,
    now: () => 1_000_000,
    isSuperAdmin: async () => false,
    provision: async (input) => {
      provisionCalls += 1;
      assert.equal(input.ownerUserId, USER);
      assert.equal(input.lifecycle, "trial");
      assert.equal(input.context, "onboarding_state");
      return { officeId: OFFICE_UUID, created: true, slug: "heal-office" };
    },
  });
  assert.equal(id, OFFICE_UUID);
  assert.ok(id && isUuid(id));
  assert.equal(provisionCalls, 1);
  assert.equal(cache.get(USER)?.officeId, OFFICE_UUID);
  console.log("  ✅ HEAL-7 awaits provision and returns UUID (unchanged)");
}

console.log("\n═══ concurrent/retry HEAL returns same UUID ═══");

{
  const cache = new Map<string, { officeId: string; ts: number }>();
  const healInflight = new Map<string, Promise<string>>();
  let provisionCalls = 0;
  let resolveProvision!: (v: { officeId: string; created: boolean; slug: string }) => void;
  const provisionGate = new Promise<{ officeId: string; created: boolean; slug: string }>((r) => {
    resolveProvision = r;
  });
  const deps = {
    db: createDb({
      members: [],
      users: [],
      registry: [],
      trial: [],
      onboarding: [{ office_id: "default", data: {} }],
    }),
    cache,
    healInflight,
    now: () => 2_000_000,
    isSuperAdmin: async () => false,
    provision: async () => {
      provisionCalls += 1;
      return provisionGate;
    },
  };
  const p1 = resolveTenantId(USER, undefined, deps);
  const p2 = resolveTenantId(USER, undefined, deps);
  resolveProvision({ officeId: OFFICE_UUID, created: true, slug: "x" });
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(a, OFFICE_UUID);
  assert.equal(b, OFFICE_UUID);
  assert.equal(provisionCalls, 1);
  console.log("  ✅ concurrent HEAL coalesces to one provision / same UUID");
}

{
  const cache = new Map<string, { officeId: string; ts: number }>();
  cache.set(USER, { officeId: OFFICE_UUID, ts: 3_000_000 });
  let provisionCalls = 0;
  const id = await resolveTenantId(USER, undefined, {
    db: createDb({ members: [], users: [], registry: [], trial: [], onboarding: [] }),
    cache,
    healInflight: new Map(),
    now: () => 3_000_100,
    isSuperAdmin: async () => false,
    provision: async () => {
      provisionCalls += 1;
      return { officeId: OFFICE_UUID_B, created: true, slug: "y" };
    },
  });
  assert.equal(id, OFFICE_UUID);
  assert.equal(provisionCalls, 0);
  console.log("  ✅ retry hits UUID cache; no second provision");
}

console.log("\n═══ HEAL-7 source + legacy fail closed ═══");

{
  const mw = readSrc("middlewares/tenantMiddleware.ts");
  assert.match(mw, /TENANT-HEAL-7/);
  assert.match(mw, /assertCanonicalBusinessOfficeId/);
  assert.match(mw, /blocksBusinessWrites/);
  assert.doesNotMatch(mw, /trial_\$\{safeId\}/);
  const healRegion = mw.slice(mw.indexOf("TENANT-HEAL-7"), mw.indexOf("TENANT-403"));
  assert.doesNotMatch(healRegion, /\.catch\(\(\)\s*=>\s*\{\}\)/);
  console.log("  ✅ HEAL-7 no trial_* mint; impersonation legacy blocked");
}

{
  let provisionCalls = 0;
  const cache = new Map<string, { officeId: string; ts: number }>();
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({
          members: [{ office_id: LEGACY }],
          onboarding: [{ office_id: LEGACY, data: {} }],
        }),
        cache,
        healInflight: new Map(),
        now: () => 4_000_000,
        isSuperAdmin: async () => false,
        provision: async () => {
          provisionCalls += 1;
          return { officeId: OFFICE_UUID, created: true, slug: "nope" };
        },
      }),
    (e: unknown) => isLegacyErr(e, LEGACY),
  );
  assert.equal(provisionCalls, 0);
  assert.equal(cache.has(USER), false);
  console.log("  ✅ legacy membership → no second office; not cached");
}

console.log("\n═══ provision failure + UUID short-circuit ═══");

{
  const cache = new Map<string, { officeId: string; ts: number }>();
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({
          members: [],
          users: [],
          registry: [],
          trial: [],
          onboarding: [{ office_id: "default", data: {} }],
        }),
        cache,
        healInflight: new Map(),
        now: () => 7_000_000,
        isSuperAdmin: async () => false,
        provision: async () => {
          throw Object.assign(new Error("db down"), { code: "TEST_FAIL" });
        },
      }),
    (e: unknown) => (e as { message?: string }).message === "db down",
  );
  assert.equal(cache.has(USER), false);
  console.log("  ✅ provision failure propagates; cache stays empty");
}

{
  let provisionCalls = 0;
  const id = await resolveTenantId(USER, undefined, {
    db: createDb({
      members: [{ office_id: OFFICE_UUID }],
      onboarding: [{ office_id: OFFICE_UUID, data: {} }],
    }),
    cache: new Map(),
    healInflight: new Map(),
    now: () => 8_000_000,
    isSuperAdmin: async () => false,
    provision: async () => {
      provisionCalls += 1;
      return { officeId: OFFICE_UUID_B, created: true, slug: "z" };
    },
  });
  assert.equal(id, OFFICE_UUID);
  assert.equal(provisionCalls, 0);
  console.log("  ✅ existing UUID membership wins; HEAL skipped");
}

console.log("\n✅ tenantHeal7 tests passed\n");
