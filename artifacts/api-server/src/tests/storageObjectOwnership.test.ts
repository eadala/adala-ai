/**
 * GET /storage/objects/* tenant ownership enforcement.
 * Run: pnpm --filter @workspace/api-server run test:storage-object-ownership
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  brandingRefMatchesObject,
  buildOwnershipMatchCandidates,
  entityIdFromObjectsWildcard,
  objectEntityPath,
  tenantOwnsStorageObject,
  type OwnershipDb,
} from "../lib/storageObjectOwnership";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageTs = readFileSync(join(SRC, "modules/operations/storage.ts"), "utf8");
const ownershipTs = readFileSync(join(SRC, "lib/storageObjectOwnership.ts"), "utf8");
const documentCenterTs = readFileSync(join(SRC, "modules/documents/documentCenter.ts"), "utf8");

const TENANT_A = "trial_office_a";
const TENANT_B = "550e8400-e29b-41d4-a716-446655440000";
const ENTITY = "uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const OBJECT_PATH = `/objects/${ENTITY}`;
const OBJECT_KEY = `private/${ENTITY}`;

function mockDb(handlers: {
  storageFiles?: boolean;
  branding?: Record<string, string | null> | null;
  officePage?: { logo?: string | null; website_config_text?: string | null } | null;
  team?: boolean;
  captured?: string[];
}): OwnershipDb {
  const captured = handlers.captured ?? [];
  return {
    execute: async (q: unknown) => {
      const text = (() => {
        try {
          return JSON.stringify(q);
        } catch {
          return String(q);
        }
      })();
      captured.push(text);

      if (text.includes("FROM storage_files")) {
        return handlers.storageFiles ? [{ ok: 1 }] : [];
      }
      if (text.includes("FROM office_branding")) {
        return handlers.branding ? [handlers.branding] : [];
      }
      if (text.includes("FROM office_page")) {
        return handlers.officePage
          ? [{
              logo: handlers.officePage.logo ?? null,
              website_config_text: handlers.officePage.website_config_text ?? null,
            }]
          : [];
      }
      if (text.includes("FROM office_team")) {
        return handlers.team ? [{ photo_url: OBJECT_PATH }] : [];
      }
      return [];
    },
  };
}

console.log("\n═══ path helpers ═══");

{
  assert.equal(entityIdFromObjectsWildcard(ENTITY), ENTITY);
  assert.equal(entityIdFromObjectsWildcard(`/${ENTITY}`), ENTITY);
  assert.equal(entityIdFromObjectsWildcard(""), null);
  assert.equal(entityIdFromObjectsWildcard("uploads/../etc/passwd"), null);
  assert.equal(objectEntityPath(ENTITY), OBJECT_PATH);
  console.log("  ✅ entity id parsing rejects empty/malformed paths");
}

{
  const c = buildOwnershipMatchCandidates(ENTITY, OBJECT_KEY);
  assert.ok(c.includes(OBJECT_PATH));
  assert.ok(c.includes(ENTITY));
  assert.ok(c.includes(OBJECT_KEY));
  assert.ok(c.includes(`/api/storage/objects/${ENTITY}`));
  console.log("  ✅ ownership candidates include stored path forms");
}

{
  assert.equal(
    brandingRefMatchesObject(OBJECT_PATH, ENTITY, buildOwnershipMatchCandidates(ENTITY, OBJECT_KEY)),
    true,
  );
  assert.equal(
    brandingRefMatchesObject(
      `https://app.example/api/storage/objects/${ENTITY}`,
      ENTITY,
      buildOwnershipMatchCandidates(ENTITY, OBJECT_KEY),
    ),
    true,
  );
  assert.equal(
    brandingRefMatchesObject("/objects/uploads/other-uuid", ENTITY, buildOwnershipMatchCandidates(ENTITY, OBJECT_KEY)),
    false,
  );
  console.log("  ✅ branding ref matcher accepts path + absolute URL");
}

console.log("\n═══ tenantOwnsStorageObject ═══");

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_A,
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({ storageFiles: true }),
  });
  assert.equal(ok, true);
  console.log("  ✅ same tenant allowed via storage_files");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_B,
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({ storageFiles: false, branding: null, officePage: null, team: false }),
  });
  assert.equal(ok, false);
  console.log("  ✅ other tenant denied when no matching references");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: "",
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({ storageFiles: true }),
  });
  assert.equal(ok, false);
  console.log("  ✅ empty tenant denied (unauthenticated context)");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: "platform",
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({ storageFiles: true }),
  });
  assert.equal(ok, false);
  console.log("  ✅ platform synthetic tenant denied (no ownership fallback)");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_A,
    wildcardPath: "../secret",
    objectKey: OBJECT_KEY,
    db: mockDb({ storageFiles: true }),
  });
  assert.equal(ok, false);
  console.log("  ✅ malformed key denied");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_A,
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({
      storageFiles: false,
      branding: { logo_url: OBJECT_PATH },
    }),
  });
  assert.equal(ok, true);
  console.log("  ✅ branding path allowed for current tenant");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_A,
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({
      storageFiles: false,
      branding: {
        logo_url: `https://cdn.example/api/storage/objects/${ENTITY}`,
      },
    }),
  });
  assert.equal(ok, true);
  console.log("  ✅ branding absolute URL allowed for current tenant");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_A,
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({
      storageFiles: false,
      branding: { logo_url: "/objects/uploads/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
    }),
  });
  assert.equal(ok, false);
  console.log("  ✅ branding of another object denied");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_B,
    wildcardPath: ENTITY,
    objectKey: OBJECT_KEY,
    db: mockDb({
      storageFiles: false,
      officePage: { logo: OBJECT_PATH },
    }),
  });
  assert.equal(ok, true);
  console.log("  ✅ office_page.logo allowed when office id matches tenant");
}

{
  const ok = await tenantOwnsStorageObject({
    tenantId: TENANT_A,
    wildcardPath: "uploads/unknown-unknown-unknown-unknown-unknown000",
    objectKey: "private/uploads/unknown-unknown-unknown-unknown-unknown000",
    db: mockDb({ storageFiles: false, branding: null, officePage: null, team: false }),
  });
  assert.equal(ok, false);
  console.log("  ✅ unknown key with no DB row denied");
}

console.log("\n═══ route wiring (storage.ts) ═══");

{
  assert.match(storageTs, /tenantOwnsStorageObject/);
  assert.match(storageTs, /status\(403\).*Forbidden|json\(\{ error: "Forbidden" \}\)/);
  assert.doesNotMatch(
    storageTs,
    /const canAccess = await objectStorageService\.canAccessObjectEntity/,
  );
  assert.doesNotMatch(storageTs, /canAccessObjectEntity\(\{/);
  assert.match(ownershipTs, /Does NOT use object ACL metadata/);
  console.log("  ✅ GET /storage/objects uses ownership helper; canAccessObjectEntity not enabled");
}

{
  assert.doesNotMatch(documentCenterTs, /\/storage\/objects/);
  assert.match(documentCenterTs, /getSignedUrl\(doc\.storage_key\)/);
  assert.match(
    documentCenterTs,
    /WHERE\s+id = \$\{id\} AND office_id = \$\{officeId\}/,
  );
  console.log("  ✅ document center unchanged (signed URL + office_id filter)");
}

console.log("\n✅ storage object ownership tests passed\n");
