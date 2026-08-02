/**
 * Stage 15.2b — UUID tenant resolution + HEAL-7 canonical provision.
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
  classifyTenantId,
  isCacheableTenantId,
} from "../lib/tenantResolution";
import { isUuid } from "../lib/officePageResolverLogic";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const OFFICE_UUID = "550e8400-e29b-41d4-a716-446655440099";
const OFFICE_UUID_B = "660e8400-e29b-41d4-a716-446655440099";
const USER = "user_heal7_test";
const LEGACY = "trial_legacyheal7";

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
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

console.log("\n═══ classify / accept helpers ═══");

{
  assert.equal(classifyTenantId(OFFICE_UUID), "uuid");
  assert.equal(classifyTenantId(LEGACY), "legacy_trial");
  assert.equal(classifyTenantId("default"), "default");
  assert.equal(classifyTenantId("platform"), "platform");
  assert.equal(classifyTenantId(null), "empty");
  assert.equal(isCacheableTenantId(OFFICE_UUID), true);
  assert.equal(isCacheableTenantId(LEGACY), false);
  assert.equal(isCacheableTenantId("platform"), false);
  assert.equal(
    acceptNormalUserTenantId(OFFICE_UUID, { userId: USER, source: "t" }),
    OFFICE_UUID,
  );
  assert.equal(acceptNormalUserTenantId("default", { userId: USER, source: "t" }), null);
  assert.throws(
    () => acceptNormalUserTenantId(LEGACY, { userId: USER, source: "office_members" }),
    (e: unknown) =>
      e instanceof TenantResolutionError &&
      e.code === LEGACY_NON_UUID_TENANT &&
      e.details.needsMigration === true &&
      e.details.migrationStage === "15.2c",
  );
  assert.throws(
    () => acceptNormalUserTenantId("platform", { userId: USER, source: "t" }),
    (e: unknown) =>
      e instanceof TenantResolutionError && e.code === PLATFORM_FORBIDDEN_FOR_USER,
  );
  console.log("  ✅ UUID accepted; trial_*/platform fail closed; default treated as empty");
}

console.log("\n═══ HEAL-7: eligible onboarded user gets UUID office ═══");

{
  const cache = new Map<string, { officeId: string; ts: number }>();
  const healInflight = new Map<string, Promise<string>>();
  let provisionCalls = 0;
  const db = createDb({
    members: [],
    users: [],
    registry: [],
    trial: [],
    onboarding: [{ office_id: "default", data: { officeName: "مكتب الشفاء" } }],
  });

  const id = await resolveTenantId(USER, undefined, {
    db,
    cache,
    healInflight,
    now: () => 1_000_000,
    isSuperAdmin: async () => false,
    provision: async (input) => {
      provisionCalls += 1;
      assert.equal(input.ownerUserId, USER);
      assert.equal(input.lifecycle, "trial");
      assert.equal(input.context, "onboarding_state");
      assert.notEqual(input.ownerUserId, "platform");
      return { officeId: OFFICE_UUID, created: true, slug: "heal-office" };
    },
  });

  assert.equal(id, OFFICE_UUID);
  assert.ok(id && isUuid(id));
  assert.equal(provisionCalls, 1);
  assert.equal(cache.get(USER)?.officeId, OFFICE_UUID);
  console.log("  ✅ HEAL-7 awaits provisionOfficeForUser and returns UUID");
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

  const db = createDb({
    members: [],
    users: [],
    registry: [],
    trial: [],
    onboarding: [{ office_id: "default", data: {} }],
  });

  const deps = {
    db,
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

console.log("\n═══ no trial_* / default mint in HEAL-7 source ═══");

{
  const mw = readSrc("middlewares/tenantMiddleware.ts");
  assert.match(mw, /TENANT-HEAL-7/);
  assert.match(mw, /provisionOfficeForUser|deps\.provision|provision\(/);
  assert.match(mw, /await healProvisionOffice|await deps\.provision|await provision\(/);
  assert.doesNotMatch(mw, /trial_\$\{safeId\}/);
  assert.doesNotMatch(mw, /const newOfficeId = `trial_/);
  const healRegion = mw.slice(mw.indexOf("TENANT-HEAL-7"), mw.indexOf("TENANT-403"));
  assert.doesNotMatch(healRegion, /\.catch\(\(\)\s*=>\s*\{\}\)/);
  assert.doesNotMatch(healRegion, /fire-and-forget|DO NOTHING`\)\.catch/);
  console.log("  ✅ HEAL-7 no longer mints trial_*; no fire-and-forget catches");
}

console.log("\n═══ legacy trial_* fails closed without second office ═══");

{
  let provisionCalls = 0;
  const cache = new Map<string, { officeId: string; ts: number }>();
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({
          members: [{ office_id: LEGACY }],
          users: [],
          registry: [],
          trial: [],
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
    (e: unknown) =>
      e instanceof TenantResolutionError &&
      e.code === LEGACY_NON_UUID_TENANT &&
      e.details.legacyOfficeId === LEGACY &&
      e.details.needsMigration === true,
  );
  assert.equal(provisionCalls, 0);
  assert.equal(cache.has(USER), false);
  console.log("  ✅ legacy membership → LEGACY_NON_UUID_TENANT; no provision; not cached");
}

{
  let provisionCalls = 0;
  await assert.rejects(
    () =>
      resolveTenantId(USER, undefined, {
        db: createDb({
          members: [],
          users: [],
          registry: [],
          trial: [{ office_id: LEGACY }],
          onboarding: [],
        }),
        cache: new Map(),
        healInflight: new Map(),
        now: () => 5_000_000,
        isSuperAdmin: async () => false,
        provision: async () => {
          provisionCalls += 1;
          return { officeId: OFFICE_UUID, created: true, slug: "nope" };
        },
      }),
    (e: unknown) => e instanceof TenantResolutionError && e.code === LEGACY_NON_UUID_TENANT,
  );
  assert.equal(provisionCalls, 0);
  console.log("  ✅ legacy trial_offices row fails closed without second office");
}

console.log("\n═══ platform behavior ═══");

{
  const id = await resolveTenantId(USER, undefined, {
    db: createDb({
      members: [{ office_id: OFFICE_UUID }],
      users: [],
      registry: [],
      trial: [],
      onboarding: [],
    }),
    cache: new Map(),
    healInflight: new Map(),
    now: () => 6_000_000,
    isSuperAdmin: async () => false,
    provision: async () => {
      throw new Error("should not provision");
    },
  });
  assert.equal(id, OFFICE_UUID);
  assert.notEqual(id, "platform");
  console.log("  ✅ normal user resolves to UUID office, never platform");
}

{
  const requireAuthSrc = readSrc("middlewares/requireAuth.ts");
  assert.match(requireAuthSrc, /tenantId = "platform"/);
  assert.match(requireAuthSrc, /checkIsSuperAdmin|isSuperAdmin/);
  assert.match(requireAuthSrc, /LEGACY_NON_UUID_TENANT/);
  assert.match(requireAuthSrc, /PLATFORM_FORBIDDEN_FOR_USER/);
  console.log("  ✅ requireAuth: platform is explicit SA-only; legacy surfaced");
}

console.log("\n═══ provision failure propagates and is not cached ═══");

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

console.log("\n═══ UUID membership short-circuit (no heal) ═══");

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
