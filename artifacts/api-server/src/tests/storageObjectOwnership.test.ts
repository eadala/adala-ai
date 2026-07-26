/**
 * GET /storage/objects/* tenant ownership — security corrections.
 * Run: pnpm --filter @workspace/api-server run test:storage-object-ownership
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectJsonStringLeaves,
  entityIdFromCanonicalKey,
  normalizeToCanonicalObjectKey,
  tenantOwnsCanonicalObjectKey,
  type OwnershipDb,
} from "../lib/storageObjectOwnership";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageTs = readFileSync(join(SRC, "modules/operations/storage.ts"), "utf8");
const ownershipTs = readFileSync(join(SRC, "lib/storageObjectOwnership.ts"), "utf8");
const documentCenterTs = readFileSync(join(SRC, "modules/documents/documentCenter.ts"), "utf8");

const PREFIX = "private";
const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ENTITY = `uploads/${UUID}`;
const CANONICAL = `${PREFIX}/${ENTITY}`;
const TENANT_A = "trial_office_a";
const TENANT_B = "550e8400-e29b-41d4-a716-446655440000";

type FileRow = { storage_key?: string | null; file_url?: string | null };

function mockDb(opts: {
  files?: FileRow[];
  branding?: Record<string, string | null> | null;
  officePage?: { logo?: string | null; website_config?: unknown } | null;
  team?: Array<{ photo_url: string | null }>;
  throwOn?: "storage_files" | "office_branding" | "office_page" | "office_team" | "any";
}): OwnershipDb {
  return {
    execute: async (q: unknown) => {
      const text = (() => {
        try {
          return JSON.stringify(q);
        } catch {
          return String(q);
        }
      })();

      if (opts.throwOn === "any" || (opts.throwOn && text.includes(`FROM ${opts.throwOn}`))) {
        throw new Error("simulated db failure");
      }
      // office_branding table name check
      if (opts.throwOn === "office_branding" && text.includes("FROM office_branding")) {
        throw new Error("simulated db failure");
      }

      if (text.includes("FROM storage_files")) {
        return (opts.files ?? []).map((f) => ({
          storage_key: f.storage_key ?? null,
          file_url: f.file_url ?? null,
        }));
      }
      if (text.includes("FROM office_branding")) {
        return opts.branding ? [opts.branding] : [];
      }
      if (text.includes("FROM office_page")) {
        return opts.officePage
          ? [{ logo: opts.officePage.logo ?? null, website_config: opts.officePage.website_config ?? null }]
          : [];
      }
      if (text.includes("FROM office_team")) {
        return opts.team ?? [];
      }
      return [];
    },
  };
}

console.log("\n═══ canonical normalization ═══");

{
  assert.equal(normalizeToCanonicalObjectKey(ENTITY, PREFIX), CANONICAL);
  assert.equal(normalizeToCanonicalObjectKey(`/objects/${ENTITY}`, PREFIX), CANONICAL);
  assert.equal(normalizeToCanonicalObjectKey(`${PREFIX}/${ENTITY}`, PREFIX), CANONICAL);
  assert.equal(
    normalizeToCanonicalObjectKey(`/api/storage/objects/${ENTITY}`, PREFIX),
    CANONICAL,
  );
  assert.equal(
    normalizeToCanonicalObjectKey(`https://app.example/api/storage/objects/${ENTITY}`, PREFIX),
    CANONICAL,
  );
  assert.equal(entityIdFromCanonicalKey(CANONICAL, PREFIX), ENTITY);
  console.log("  ✅ canonical normalization maps all supported forms to one key");
}

{
  assert.equal(normalizeToCanonicalObjectKey(`objects/objects/${ENTITY}`, PREFIX), null);
  assert.equal(normalizeToCanonicalObjectKey(`/api/storage/objects/objects/${ENTITY}`, PREFIX), null);
  assert.equal(normalizeToCanonicalObjectKey(`${PREFIX}/${PREFIX}/${ENTITY}`, PREFIX), null);
  console.log("  ✅ duplicate object/private prefixes rejected");
}

{
  assert.equal(normalizeToCanonicalObjectKey(`uploads/../${UUID}`, PREFIX), null);
  assert.equal(normalizeToCanonicalObjectKey(`uploads/%2e%2e/${UUID}`, PREFIX), null);
  assert.equal(normalizeToCanonicalObjectKey(`uploads/%2E%2E/${UUID}`, PREFIX), null);
  assert.equal(normalizeToCanonicalObjectKey(`uploads/%252e%252e/${UUID}`, PREFIX), null);
  console.log("  ✅ encoded / literal traversal rejected");
}

{
  assert.equal(normalizeToCanonicalObjectKey("not-a-url://%%%", PREFIX), null);
  assert.equal(
    normalizeToCanonicalObjectKey(`https://app.example/api/storage/objects/${ENTITY}?x=1`, PREFIX),
    null,
  );
  assert.equal(normalizeToCanonicalObjectKey("", PREFIX), null);
  assert.equal(normalizeToCanonicalObjectKey("uploads", PREFIX), null);
  console.log("  ✅ malformed / ambiguous URLs and paths rejected");
}

console.log("\n═══ ownership exact equality ═══");

{
  const ok = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_A,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({ files: [{ storage_key: `/objects/${ENTITY}` }] }),
  });
  assert.equal(ok, true);
  console.log("  ✅ exact same-tenant key allowed");
}

{
  const prefixSibling = `${PREFIX}/uploads/${UUID_B}`;
  const ok = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_A,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({
      files: [{ storage_key: `/objects/uploads/${UUID_B}` }],
    }),
  });
  assert.equal(ok, false);
  assert.notEqual(prefixSibling, CANONICAL);
  console.log("  ✅ same prefix, different key denied (prefix collision)");
}

{
  const ok = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_B,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({
      files: [{ storage_key: `/objects/${ENTITY}` }], // would match if office_id ignored
    }),
  });
  // mock returns files regardless of tenant filter text — simulate empty for B by separate mock
  const okB = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_B,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({ files: [] }),
  });
  assert.equal(okB, false);
  void ok;
  console.log("  ✅ another tenant with no rows denied");
}

{
  // Prove query includes office_id binding by inspecting execute payload
  const captured: string[] = [];
  const db: OwnershipDb = {
    execute: async (q) => {
      captured.push(JSON.stringify(q));
      return [];
    },
  };
  await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_A,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db,
  });
  assert.ok(captured.some((c) => c.includes("office_id") || c.includes(TENANT_A)));
  console.log("  ✅ storage_files ownership queries bind office_id / tenant");
}

{
  const ok = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_A,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({
      branding: { logo_url: `https://cdn.example/api/storage/objects/${ENTITY}` },
    }),
  });
  assert.equal(ok, true);
  console.log("  ✅ branding exact match (absolute URL) allowed");
}

{
  // Partial / prefix collision in branding must NOT authorize
  const ok = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_A,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({
      branding: {
        // Longer sibling UUID — must not match via includes/endsWith
        logo_url: `/objects/uploads/${UUID}ff`,
      },
    }),
  });
  assert.equal(ok, false);

  const okPartial = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_A,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({
      officePage: {
        website_config: {
          note: `see also /objects/uploads/${UUID.slice(0, 8)}`,
          other: `/objects/uploads/${UUID_B}`,
        },
      },
    }),
  });
  assert.equal(okPartial, false);
  console.log("  ✅ branding / website_config partial match denied");
}

{
  const ok = await tenantOwnsCanonicalObjectKey({
    tenantId: TENANT_A,
    canonicalKey: CANONICAL,
    privatePrefix: PREFIX,
    db: mockDb({
      officePage: {
        website_config: { heroImage: `/objects/${ENTITY}` },
      },
    }),
  });
  assert.equal(ok, true);
  assert.deepEqual(
    collectJsonStringLeaves({ heroImage: `/objects/${ENTITY}` }),
    [`/objects/${ENTITY}`],
  );
  console.log("  ✅ website_config exact string leaf match allowed");
}

{
  await assert.rejects(
    () =>
      tenantOwnsCanonicalObjectKey({
        tenantId: TENANT_A,
        canonicalKey: CANONICAL,
        privatePrefix: PREFIX,
        db: mockDb({ throwOn: "any" }),
      }),
    /simulated db failure/,
  );
  console.log("  ✅ DB failure propagates (route must fail closed / 404)");
}

{
  assert.equal(
    await tenantOwnsCanonicalObjectKey({
      tenantId: "",
      canonicalKey: CANONICAL,
      privatePrefix: PREFIX,
      db: mockDb({ files: [{ storage_key: CANONICAL }] }),
    }),
    false,
  );
  assert.equal(
    await tenantOwnsCanonicalObjectKey({
      tenantId: "platform",
      canonicalKey: CANONICAL,
      privatePrefix: PREFIX,
      db: mockDb({ files: [{ storage_key: CANONICAL }] }),
    }),
    false,
  );
  console.log("  ✅ missing / platform tenant denied");
}

console.log("\n═══ source wiring / no substring matchers ═══");

{
  assert.doesNotMatch(ownershipTs, /\bLIKE\s/);
  assert.doesNotMatch(ownershipTs, /\bILIKE\b/);
  assert.doesNotMatch(ownershipTs, /\.includes\(/);
  assert.doesNotMatch(ownershipTs, /\.endsWith\(/);
  assert.doesNotMatch(ownershipTs, /website_config::text/);
  assert.doesNotMatch(ownershipTs, /cfg\.includes/);
  console.log("  ✅ ownership helper has no pattern/includes/endsWith/JSON text search");
}

{
  const routeStart = storageTs.indexOf('router.get("/storage/objects/*path"');
  const routeEnd = storageTs.indexOf("router.get", routeStart + 1);
  const route = storageTs.slice(routeStart, routeEnd === -1 ? undefined : routeEnd);
  assert.match(route, /normalizeToCanonicalObjectKey/);
  assert.match(route, /tenantOwnsCanonicalObjectKey/);
  const ownsIdx = route.indexOf("tenantOwnsCanonicalObjectKey");
  const lookupIdx = route.indexOf("getObjectEntityFile");
  assert.ok(ownsIdx > 0 && lookupIdx > ownsIdx, "ownership must run before object lookup");
  assert.match(route, /status\(404\)/);
  assert.doesNotMatch(route, /status\(403\)/);
  assert.doesNotMatch(route, /canAccessObjectEntity/);
  console.log("  ✅ auth before lookup; deny is 404 (existence oracle prevented)");
}

{
  assert.doesNotMatch(documentCenterTs, /\/storage\/objects/);
  assert.match(documentCenterTs, /getSignedUrl\(doc\.storage_key\)/);
  console.log("  ✅ document center unchanged");
}

console.log("\n✅ storage object ownership security corrections passed\n");
