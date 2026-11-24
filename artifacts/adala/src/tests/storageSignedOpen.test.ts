/**
 * Frontend guards for Stage 14.1 private file open.
 * Run: pnpm --filter @workspace/adala run test:storage-signed-open
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const docs = readFileSync(resolve(root, "pages/legal-core/documents.tsx"), "utf8");
const settings = readFileSync(resolve(root, "pages/platform/storage-settings.tsx"), "utf8");
const uploader = readFileSync(resolve(root, "components/smart-uploader.tsx"), "utf8");
const helper = readFileSync(resolve(root, "lib/storageSignedUrl.ts"), "utf8");

console.log("\n═══ storageSignedUrl helper ═══");
assert.match(helper, /from "@\/lib\/authFetch"/);
assert.match(helper, /\/api\/storage\/files\/\$\{encodeURIComponent\(id\)\}\/signed-url/);
assert.match(helper, /window\.open\(url,\s*"_blank"/);
assert.match(helper, /privateStorageObjectApiPath/);
assert.match(helper, /\/api\/storage\$\{objectPath\}/);
console.log("  ✅ helper uses authFetch + signed-url + safe file_url builder");

console.log("\n═══ no bare private /api/storage/objects links ═══");
for (const [label, src] of [
  ["documents", docs],
  ["storage-settings", settings],
  ["smart-uploader", uploader],
] as const) {
  assert.doesNotMatch(src, /href=\{f\.file_url\}|href=\{fileUrl\}|href=\{file\.file_url\}/);
  assert.doesNotMatch(src, /`\/api\/storage\/objects\$\{/);
  assert.doesNotMatch(src, /src=\{[^}]*file_url/);
  console.log(`  ✅ ${label}: no bare private object href/src`);
}

assert.match(docs, /openStorageFile/);
assert.match(docs, /fetchStorageFileSignedUrl/);
assert.match(settings, /openStorageFile/);
assert.match(uploader, /privateStorageObjectApiPath/);
assert.match(uploader, /mimeType = f\.type\?\.trim\(\) \|\| "application\/octet-stream"/);

console.log("\n✅ frontend storage signed-open checks passed\n");
