/**
 * Stage 14.1 — Private file open via authenticated signed GET URL.
 * Run: pnpm --filter @workspace/api-server run test:storage-signed-open
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeToCanonicalObjectKey } from "../lib/storageObjectOwnership";
import { entityIdToObjectKey, objectKeyToEntityPath } from "../core/storage/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..");
const ADALA = resolve(__dirname, "../../../adala/src");

const storageTs = readFileSync(join(SRC, "modules/operations/storage.ts"), "utf8");
const objectStorageTs = readFileSync(join(SRC, "lib/objectStorage.ts"), "utf8");
const docsTs = readFileSync(join(ADALA, "pages/legal-core/documents.tsx"), "utf8");
const settingsTs = readFileSync(join(ADALA, "pages/platform/storage-settings.tsx"), "utf8");
const uploaderTs = readFileSync(join(ADALA, "components/smart-uploader.tsx"), "utf8");
const helperTs = readFileSync(join(ADALA, "lib/storageSignedUrl.ts"), "utf8");

const PREFIX = "private";
const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const ENTITY = `uploads/${UUID}`;
const OBJECT_PATH = `/objects/${ENTITY}`;

console.log("\n═══ GET /storage/files/:id/signed-url route ═══");

{
  const start = storageTs.indexOf('router.get("/storage/files/:id/signed-url"');
  assert.ok(start >= 0, "signed-url route must exist");
  const end = storageTs.indexOf("router.", start + 1);
  const route = storageTs.slice(start, end === -1 ? undefined : end);

  assert.match(route, /requireAuthWithTenant/, "must keep requireAuthWithTenant");
  assert.match(route, /getMgmtUser/, "must resolve tenant user");
  assert.match(route, /office_id\s*=\s*\$\{u\.officeId\}/, "must filter by tenant office_id");
  assert.match(route, /normalizeToCanonicalObjectKey/);
  assert.match(route, /tenantOwnsCanonicalObjectKey/);
  assert.match(route, /getObjectEntityDownloadURL/);
  assert.match(route, /expiresIn:\s*ttlSec/);
  assert.match(route, /ttlSec\s*=\s*300/);
  assert.match(route, /status\(404\)/);
  assert.doesNotMatch(route, /public-read|makePublic|ACL:\s*['"]public/i);
  assert.match(route, /objects\/objects/, "must repair legacy duplicated objects path");
  console.log("  ✅ signed-url: auth + tenant ownership + short TTL + no public ACL");
}

console.log("\n═══ upload Content-Type parity ═══");

{
  const start = storageTs.indexOf('router.post("/storage/uploads/request-url"');
  assert.ok(start >= 0);
  const end = storageTs.indexOf("router.", start + 1);
  const route = storageTs.slice(start, end === -1 ? undefined : end);
  assert.match(route, /getObjectEntityUploadURL\(safeType\)/);
  assert.match(route, /application\/octet-stream/);
  assert.match(objectStorageTs, /getObjectEntityUploadURL\(contentType\?/);
  assert.match(
    objectStorageTs,
    /contentType:\s*type/,
    "upload sign must pass Content-Type into provider",
  );
  console.log("  ✅ request-url signs client MIME (fallback octet-stream)");
}

{
  const importStart = storageTs.indexOf('router.post("/storage/import-url"');
  assert.ok(importStart >= 0);
  const importEnd = storageTs.indexOf("router.", importStart + 1);
  const route = storageTs.slice(importStart, importEnd === -1 ? undefined : importEnd);
  assert.match(route, /getObjectEntityUploadURL\(safeType\)/);
  assert.match(route, /["']Content-Type["']:\s*safeType/);
  assert.doesNotMatch(
    route,
    /`\/api\/storage\/objects\$\{objectPath\}`/,
    "must not generate duplicated /objects/objects/ file_url",
  );
  assert.match(route, /`\/api\/storage\$\{objectPath\}`|privateApiUrl/);
  console.log("  ✅ import-url Content-Type matches PUT; no double objects/");
}

console.log("\n═══ existing storage_key compatibility ═══");

{
  const canonical = normalizeToCanonicalObjectKey(OBJECT_PATH, PREFIX);
  assert.equal(canonical, `${PREFIX}/${ENTITY}`);
  assert.equal(
    normalizeToCanonicalObjectKey(`/api/storage/objects/${ENTITY}`, PREFIX),
    `${PREFIX}/${ENTITY}`,
  );
  /* Legacy bad file_url is rejected by strict normalize — signed-url repairs it first */
  assert.equal(
    normalizeToCanonicalObjectKey(`/api/storage/objects/objects/${ENTITY}`, PREFIX),
    null,
  );
  const repaired = `/api/storage/objects/objects/${ENTITY}`.replace(
    /\/objects\/objects\//g,
    "/objects/",
  );
  assert.equal(normalizeToCanonicalObjectKey(repaired, PREFIX), `${PREFIX}/${ENTITY}`);

  const key = entityIdToObjectKey(ENTITY);
  assert.equal(objectKeyToEntityPath(key), OBJECT_PATH);
  console.log("  ✅ storage_key /objects/uploads/{id} still resolves; legacy double path repairable");
}

console.log("\n═══ frontend: no bare private object links ═══");

{
  assert.match(helperTs, /authFetch\(`\$\{BASE\}\/api\/storage\/files\/\$\{/);
  assert.match(helperTs, /signed-url/);
  assert.match(helperTs, /window\.open/);
  assert.match(helperTs, /privateStorageObjectApiPath/);
  assert.doesNotMatch(helperTs, /R2_ACCESS|SECRET_ACCESS|credentials/);

  for (const [name, src] of [
    ["documents.tsx", docsTs],
    ["storage-settings.tsx", settingsTs],
  ] as const) {
    assert.doesNotMatch(
      src,
      /href=\{[^}]*file_url/,
      `${name} must not use bare file_url href`,
    );
    assert.doesNotMatch(
      src,
      /<a[^>]+href=\{[^}]*\/api\/storage\/objects/,
      `${name} must not link directly to /api/storage/objects`,
    );
    assert.match(src, /openStorageFile|fetchStorageFileSignedUrl/);
  }

  assert.match(docsTs, /fetchStorageFileSignedUrl/);
  assert.match(docsTs, /img src=\{previewUrl\}/);
  assert.doesNotMatch(docsTs, /img src=\{preview\}/);

  assert.match(uploaderTs, /privateStorageObjectApiPath\(objectPath\)/);
  assert.doesNotMatch(uploaderTs, /`\/api\/storage\/objects\$\{objectPath\}`/);
  assert.match(uploaderTs, /contentType:\s*mimeType/);
  assert.match(uploaderTs, /xhrUpload\(uploadURL,\s*f,/);
  assert.match(uploaderTs, /signedType\)/);
  assert.match(uploaderTs, /Content-Type", contentType \|\| file\.type \|\| "application\/octet-stream"/);
  console.log("  ✅ documents / storage-settings / smart-uploader use signed open + matched MIME");
}

console.log("\n═══ security invariants ═══");

{
  assert.match(storageTs, /requireAuthWithTenant/);
  /* Private objects route must still require auth — do not weaken */
  const objStart = storageTs.indexOf('router.get("/storage/objects/*path"');
  const objSlice = storageTs.slice(objStart, objStart + 200);
  assert.match(objSlice, /requireAuthWithTenant/);
  assert.doesNotMatch(objectStorageTs, /public-read|MakePublic/i);
  console.log("  ✅ requireAuthWithTenant preserved; objects stay private");
}

console.log("\n✅ storage signed-open checks passed\n");
