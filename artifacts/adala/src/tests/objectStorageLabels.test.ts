/**
 * Frontend object-storage label helpers + settings source checks.
 * Run: pnpm --dir ../api-server exec tsx ../adala/src/tests/objectStorageLabels.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canDownloadObjectStorageFile,
  isObjectStorageProviderLabel,
} from "../lib/objectStorageLabels";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("\n═══ adala objectStorageLabels ═══");

{
  assert.equal(isObjectStorageProviderLabel("cloudflare_r2"), true);
  assert.equal(isObjectStorageProviderLabel("replit_object_storage"), true);
  assert.equal(isObjectStorageProviderLabel("db_base64"), false);
  console.log("  ✅ cloudflare_r2 + legacy replit_object_storage are object storage");
}

{
  assert.equal(
    canDownloadObjectStorageFile({
      storage_provider: "cloudflare_r2",
      storage_key: "docs/o/f.pdf",
    }),
    true,
  );
  assert.equal(
    canDownloadObjectStorageFile({
      storage_provider: "replit_object_storage",
      storage_key: "docs/o/f.pdf",
    }),
    true,
  );
  assert.equal(
    canDownloadObjectStorageFile({
      storage_provider: "cloudflare_r2",
      storage_key: null,
    }),
    false,
  );
  assert.equal(
    canDownloadObjectStorageFile({
      storage_provider: "db_base64",
      storage_key: "ignored",
    }),
    false,
  );
  assert.equal(
    canDownloadObjectStorageFile({
      storage_provider: "db_base64",
      storage_key: null,
    }),
    false,
  );
  console.log("  ✅ download visibility: both aliases with key; db_base64 blocked");
}

{
  const page = readFileSync(
    join(root, "pages/platform/document-center.tsx"),
    "utf8",
  );
  assert.match(page, /canDownloadObjectStorageFile/);
  assert.match(page, /isObjectStorageProviderLabel/);
  assert.doesNotMatch(
    page,
    /storage_provider === ["']replit_object_storage["']/,
  );
  assert.match(page, /Cloudflare R2/);
  console.log("  ✅ document-center uses helpers; no sole replit equality for download");
}

{
  const settings = readFileSync(
    join(root, "pages/platform/storage-settings.tsx"),
    "utf8",
  );
  assert.match(settings, /\["cloudflare-r2", "local"\]/);
  assert.doesNotMatch(settings, /"replit"/);
  assert.match(settings, /val\("default_provider", "cloudflare-r2"\)/);
  console.log("  ✅ storage settings: Replit option absent; R2 default");
}

{
  const registry = readFileSync(
    join(root, "lib/fileUploadRegistry.ts"),
    "utf8",
  );
  assert.match(registry, /\| "cloudflare_r2"/);
  assert.match(registry, /\| "replit_object_storage"/);
  assert.match(registry, /storageProvider:\s*"cloudflare_r2"/);
  console.log("  ✅ registry includes cloudflare_r2; retains legacy type alias");
}

console.log("\n✅ adala objectStorageLabels: all checks passed\n");
