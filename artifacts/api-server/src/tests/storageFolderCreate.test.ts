/**
 * POST /api/storage/folders — must never send an empty 200 body.
 * Run: pnpm --filter @workspace/api-server run test:storage-folder-create
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createStorageFolder } from "../lib/storageFolderCreate";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageTs = readFileSync(join(SRC, "modules/operations/storage.ts"), "utf8");
const createTs = readFileSync(join(SRC, "lib/storageFolderCreate.ts"), "utf8");
const migration009 = readFileSync(
  join(SRC, "..", "migrations", "009_storage_folders.sql"),
  "utf8",
);

const OFFICE_ID = "trial_gJ1TIcai";
const USER_ID = "user_3GAZkvsPRRIyUOY77l9gJ1TIcai";

type Call = { text: string };

function createMockDb(opts: { rows?: Record<string, unknown>[]; failWith?: unknown }) {
  const captured: Call[] = [];
  return {
    captured,
    execute: async (q: unknown) => {
      const text = (() => {
        try { return JSON.stringify(q); } catch { return String(q); }
      })();
      captured.push({ text });
      if (opts.failWith) throw opts.failWith;
      return opts.rows ?? [];
    },
  };
}

console.log("\n═══ createStorageFolder: successful insert ═══");

{
  const mock = createMockDb({ rows: [{ id: "folder-1", office_id: OFFICE_ID, name: "عقود", parent_id: null }] });
  const result = await createStorageFolder(
    { officeId: OFFICE_ID, userId: USER_ID, name: "عقود", parentId: null },
    { db: mock },
  );
  assert.equal(result.folder.id, "folder-1");
  assert.equal(result.folder.name, "عقود");
  assert.equal(mock.captured.length, 1);
  assert.match(mock.captured[0].text, /INSERT INTO storage_folders/);
  console.log("  ✅ returns the inserted row as { folder }");
}

console.log("\n═══ createStorageFolder: empty insert result (never silently succeeds) ═══");

{
  const mock = createMockDb({ rows: [] });
  await assert.rejects(
    () => createStorageFolder({ officeId: OFFICE_ID, userId: USER_ID, name: "عقود", parentId: null }, { db: mock }),
    /storage_folders insert returned no row/,
  );
  console.log("  ✅ empty RETURNING result throws instead of resolving with undefined");
}

console.log("\n═══ storageFolderCreate.ts: never swallows errors ═══");

assert.doesNotMatch(
  createTs,
  /catch\s*\{\s*return\s*(\[\]|undefined)\s*;?\s*\}/,
  "createStorageFolder must not have a catch-and-swallow branch",
);
assert.match(
  createTs,
  /if \(!folder\) \{\s*throw new Error/,
  "empty RETURNING result must throw, not resolve silently",
);
console.log("  ✅ helper has no catch-and-swallow branch; empty insert throws");

console.log("\n═══ createStorageFolder: DB error propagates (never swallowed) ═══");

{
  const dbErr = Object.assign(new Error('relation "storage_folders" does not exist'), { code: "42P01" });
  const mock = createMockDb({ failWith: dbErr });
  await assert.rejects(
    () => createStorageFolder({ officeId: OFFICE_ID, userId: USER_ID, name: "عقود", parentId: null }, { db: mock }),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, "42P01");
      return true;
    },
  );
  console.log("  ✅ missing-relation error is not caught inside createStorageFolder");
}

console.log("\n═══ storage.ts: POST /storage/folders wiring ═══");

/* Isolate the CREATE folder route body between its own route registration
 * and the next router.<method> call, so assertions can't accidentally match
 * unrelated folder routes (rename/delete/permissions) later in the file. */
const createRouteStart = storageTs.indexOf('router.post("/storage/folders"');
assert.ok(createRouteStart >= 0, "POST /storage/folders route must exist");
const nextRouteIdx = storageTs.indexOf("router.", createRouteStart + 40);
const createRouteBody = storageTs.slice(createRouteStart, nextRouteIdx > -1 ? nextRouteIdx : undefined);

assert.match(
  createRouteBody,
  /createStorageFolder\(/,
  "route must call the non-swallowing createStorageFolder helper",
);
assert.doesNotMatch(
  createRouteBody,
  /await dbRows\(sql`INSERT INTO storage_folders/,
  "route must not run the folder INSERT through the error-swallowing dbRows helper",
);
assert.match(
  createRouteBody,
  /res\.status\(201\)\.json\(\{\s*folder\s*\}\)/,
  "success must return 201 with { folder }",
);
assert.doesNotMatch(
  createRouteBody,
  /res\.json\(rows\[0\]\)/,
  "route must not respond with res.json(rows[0]) (can be undefined → empty 200 body)",
);
assert.match(
  createRouteBody,
  /catch\s*\(err\)\s*\{[\s\S]*logEndpointError\(\s*"POST \/api\/storage\/folders"/,
  "failure must be logged via logEndpointError",
);
assert.match(
  createRouteBody,
  /catch\s*\(err\)\s*\{[\s\S]*res\.status\(500\)\.json\(\{\s*error:/,
  "failure must return 500 with JSON error body (never an empty 200)",
);
console.log("  ✅ POST /storage/folders uses createStorageFolder + logEndpointError + 201/{folder} contract");

console.log("\n═══ migration 009: storage_folders + folder_permissions shape ═══");

assert.match(migration009, /CREATE TABLE IF NOT EXISTS storage_folders/);
assert.match(migration009, /id\s+UUID PRIMARY KEY/);
assert.match(migration009, /office_id\s+TEXT NOT NULL/);
assert.match(migration009, /parent_id\s+UUID/);
assert.match(migration009, /name\s+TEXT NOT NULL/);
assert.match(migration009, /visibility\s+TEXT NOT NULL DEFAULT 'everyone'/);
assert.match(migration009, /idx_storage_folders_office_id/);
assert.doesNotMatch(migration009, /REFERENCES\s+office_page/);

assert.match(migration009, /CREATE TABLE IF NOT EXISTS folder_permissions/);
assert.match(migration009, /folder_id\s+UUID NOT NULL/);
assert.match(migration009, /UNIQUE \(folder_id, user_id\)/);
console.log("  ✅ 009 creates storage_folders + folder_permissions with the columns actual queries use");

/* Repo gap: storage_folders/folder_permissions must not appear in earlier formal migrations */
const migDir = join(SRC, "..", "migrations");
for (const name of [
  "001_tenant_isolation.sql",
  "003_drizzle_baseline_safe.sql",
  "004_legal_core_extensions.sql",
  "005_tenant_platform_tables.sql",
  "006_post_migration_api_support.sql",
  "007_office_storage_quota_text_tenant.sql",
  "008_storage_files_text_tenant.sql",
]) {
  const body = readFileSync(join(migDir, name), "utf8");
  assert.doesNotMatch(body, /CREATE TABLE IF NOT EXISTS\s+"?storage_folders"?/i);
  assert.doesNotMatch(body, /CREATE TABLE IF NOT EXISTS\s+"?folder_permissions"?/i);
}
console.log("  ✅ storage_folders/folder_permissions absent from 001–008 (confirmed missing before 009)");

console.log("\n✅ storageFolderCreate: all checks passed\n");
