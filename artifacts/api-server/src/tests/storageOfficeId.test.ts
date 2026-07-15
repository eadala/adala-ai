/**
 * Storage management office_id resolution — never invent from Clerk userId.
 * Run: pnpm --filter @workspace/api-server run test:storage-office-id
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveStorageOfficeId } from "../lib/storageOfficeId";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageTs = readFileSync(join(SRC, "modules/operations/storage.ts"), "utf8");

const USER_ID = "user_3GAZkvsPRRIyUOY77l9gJ1TIcai";
const TRIAL_ID = "trial_560de17b7b63";
const META_OFFICE = "550e8400-e29b-41d4-a716-446655440000";

console.log("\n═══ resolveStorageOfficeId ═══");

{
  const officeId = resolveStorageOfficeId({
    tenantId: TRIAL_ID,
    metadataOfficeId: null,
  });
  assert.equal(officeId, TRIAL_ID);
  assert.notEqual(officeId, USER_ID);
  console.log("  ✅ trial user uses req.tenantId (trial_...)");
}

{
  const officeId = resolveStorageOfficeId({
    tenantId: undefined,
    metadataOfficeId: META_OFFICE,
  });
  assert.equal(officeId, META_OFFICE);
  console.log("  ✅ metadata officeId fallback works when tenant missing");
}

{
  const officeId = resolveStorageOfficeId({
    tenantId: TRIAL_ID,
    metadataOfficeId: META_OFFICE,
  });
  assert.equal(officeId, TRIAL_ID);
  console.log("  ✅ tenantId preferred over metadata officeId");
}

{
  const officeId = resolveStorageOfficeId({
    tenantId: null,
    metadataOfficeId: null,
  });
  assert.equal(officeId, null);
  console.log("  ✅ missing tenant and metadata fails closed (null)");
}

{
  const officeId = resolveStorageOfficeId({
    tenantId: "   ",
    metadataOfficeId: "",
  });
  assert.equal(officeId, null);
  console.log("  ✅ blank strings fail closed");
}

{
  const officeId = resolveStorageOfficeId({
    tenantId: undefined,
    metadataOfficeId: undefined,
  });
  assert.equal(officeId, null);
  // Explicit: Clerk userId must never be an implicit fallback input to this helper
  assert.notEqual(officeId, USER_ID);
  console.log("  ✅ auth.userId is never used as officeId by resolver");
}

console.log("\n═══ storage.ts wiring ═══");

assert.match(
  storageTs,
  /resolveStorageOfficeId\(\{\s*tenantId:\s*req\.tenantId/,
  "getMgmtUser must prefer req.tenantId via resolveStorageOfficeId",
);
assert.doesNotMatch(
  storageTs,
  /officeId\s*=\s*\([^)]*publicMetadata\?\.officeId[^)]*\)\s*\?\?\s*auth\.userId/,
  "must not fall back publicMetadata.officeId ?? auth.userId",
);
assert.doesNotMatch(
  storageTs,
  /\?\?\s*auth\.userId/,
  "must not use auth.userId as officeId fallback anywhere in storage.ts",
);
assert.match(
  storageTs,
  /if\s*\(!resolvedOfficeId\)\s*return null/,
  "getMgmtUser must fail closed when office id cannot be resolved",
);
console.log("  ✅ getMgmtUser wired to tenant-first resolution + fail-closed");

console.log("\n✅ storageOfficeId: all checks passed\n");
