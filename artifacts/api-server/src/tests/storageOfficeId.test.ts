/**
 * Storage management office_id resolution — never invent from Clerk userId.
 * Run: pnpm --filter @workspace/api-server run test:storage-office-id
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OFFICE_CONTEXT_REQUIRED,
  resolveStorageOfficeId,
  storageMgmtAuthResponse,
} from "../lib/storageOfficeId";

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
  assert.notEqual(officeId, USER_ID);
  console.log("  ✅ auth.userId is never used as officeId by resolver");
}

console.log("\n═══ storage.ts wiring ═══");

assert.match(
  storageTs,
  /resolveStorageOfficeId\(\{\s*tenantId:\s*req\.tenantId/,
  "getMgmtUser must prefer req.tenantId via resolveStorageOfficeId",
);
assert.match(
  storageTs,
  /reason:\s*"office_required"/,
  "getMgmtUser must fail closed with office_required when office id cannot be resolved",
);
assert.match(
  storageTs,
  /storageMgmtAuthResponse\(result\.reason\)/,
  "handlers must map office_required through storageMgmtAuthResponse",
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
console.log("  ✅ getMgmtUser wired to tenant-first resolution + fail-closed 403");

console.log("\n═══ OFFICE_CONTEXT_REQUIRED response ═══");

{
  const res = storageMgmtAuthResponse("office_required");
  assert.equal(res.status, 403);
  assert.deepEqual(res.body, {
    code: "OFFICE_CONTEXT_REQUIRED",
    message: OFFICE_CONTEXT_REQUIRED.message,
  });
  assert.equal(
    res.body.message,
    "تعذر تحديد المكتب المرتبط بحسابك. يرجى إكمال إعداد المكتب أو التواصل مع المسؤول.",
  );
  // Must not imply "not registered in an office" or raw unauthenticated phrasing
  assert.doesNotMatch(res.body.message, /غير مسجّل|غير مسجل|غير مصادق/);
  console.log("  ✅ missing office → HTTP 403 OFFICE_CONTEXT_REQUIRED (Arabic UX)");
}

{
  const res = storageMgmtAuthResponse("unauthenticated");
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: "غير مصادق" });
  console.log("  ✅ missing auth still → HTTP 401");
}

console.log("\n✅ storageOfficeId: all checks passed\n");
