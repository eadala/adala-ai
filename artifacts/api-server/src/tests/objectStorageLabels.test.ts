/**
 * Object-storage provider label aliases (UI + stats compatibility).
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/objectStorageLabels.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OBJECT_STORAGE_PROVIDER_LABELS,
  OBJECT_STORAGE_PROVIDER_SQL_PREDICATE,
  isObjectStorageProviderLabel,
} from "../core/storage/objectStorageLabels";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("\n═══ objectStorageLabels ═══");

{
  assert.deepEqual([...OBJECT_STORAGE_PROVIDER_LABELS], [
    "cloudflare_r2",
    "replit_object_storage",
  ]);
  assert.equal(isObjectStorageProviderLabel("cloudflare_r2"), true);
  assert.equal(isObjectStorageProviderLabel("replit_object_storage"), true);
  assert.equal(isObjectStorageProviderLabel("db_base64"), false);
  assert.equal(isObjectStorageProviderLabel("unknown"), false);
  assert.equal(isObjectStorageProviderLabel(null), false);
  assert.equal(isObjectStorageProviderLabel(undefined), false);
  console.log("  ✅ alias helper recognizes only known object-storage labels");
}

{
  assert.equal(
    OBJECT_STORAGE_PROVIDER_SQL_PREDICATE,
    "storage_provider IN ('cloudflare_r2', 'replit_object_storage')",
  );
  assert.ok(!OBJECT_STORAGE_PROVIDER_SQL_PREDICATE.includes("db_base64"));
  console.log("  ✅ SQL predicate is explicit IN list (no unknown auto-classify)");
}

{
  const src = readFileSync(
    join(root, "modules/documents/documentCenter.ts"),
    "utf8",
  );
  assert.match(src, /OBJECT_STORAGE_PROVIDER_SQL_PREDICATE/);
  assert.doesNotMatch(
    src,
    /COUNT\(\*\) FILTER \(WHERE storage_provider = 'replit_object_storage'\)/,
  );
  assert.match(
    src,
    /storage_provider TEXT DEFAULT 'cloudflare_r2'/,
  );
  assert.match(
    src,
    /ALTER COLUMN storage_provider SET DEFAULT 'cloudflare_r2'/,
  );
  assert.match(
    src,
    /storage_provider = \$\{result\.provider\}/,
  );
  // Version parent update must set provider with key
  assert.match(
    src,
    /SET version = \$\{nextVer\},[\s\S]*?storage_key = \$\{result\.storageKey\},[\s\S]*?storage_provider = \$\{result\.provider\},/,
  );
  // No backfill UPDATE of existing rows by label
  assert.doesNotMatch(
    src,
    /UPDATE\s+document_center_files[\s\S]*SET\s+storage_provider\s*=\s*'cloudflare_r2'\s*WHERE\s+storage_provider\s*=\s*'replit_object_storage'/,
  );
  console.log("  ✅ documentCenter stats/default/version writer use aliases; no backfill");
}

console.log("\n✅ objectStorageLabels: all checks passed\n");
