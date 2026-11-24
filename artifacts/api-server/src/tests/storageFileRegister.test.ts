/**
 * Centralized storage file register — transaction + tenant key + safe errors.
 * Run: pnpm --filter @workspace/api-server run test:storage-file-register
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
import {
  STORAGE_REGISTER_FAILED,
  registerStorageFileWithQuota,
  storageRegisterErrorResponse,
} from "../lib/storageFileRegister";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const storageTs = readFileSync(join(SRC, "modules/operations/storage.ts"), "utf8");
const registerTs = readFileSync(join(SRC, "lib/storageFileRegister.ts"), "utf8");
const migration007 = readFileSync(
  join(SRC, "..", "migrations", "007_office_storage_quota_text_tenant.sql"),
  "utf8",
);
const migration008 = readFileSync(
  join(SRC, "..", "migrations", "008_storage_files_text_tenant.sql"),
  "utf8",
);

const USER_ID = "user_3GAZkvsPRRIyUOY77l9gJ1TIcai";
const TRIAL_ID = "trial_gJ1TIcai";
const PERM_TEXT_ID = "office_north_law_01";

type Call = { kind: "file" | "quota" };

function createMockDb(opts: {
  failQuota?: boolean;
  failFile?: boolean;
  captured?: Call[];
}) {
  const captured = opts.captured ?? [];
  let rolledBack = false;

  return {
    rolledBack: () => rolledBack,
    transaction: async <T>(fn: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<T>) => {
      const tx = {
        execute: async (q: unknown) => {
          const text = (() => {
            try { return JSON.stringify(q); } catch { return String(q); }
          })();
          if (text.includes("INSERT INTO storage_files")) {
            if (opts.failFile) {
              throw Object.assign(new Error("file insert failed"), { code: "23502" });
            }
            captured.push({ kind: "file" });
            return [{ id: "file-1", original_name: "a.pdf" }];
          }
          if (text.includes("office_storage_quota")) {
            if (opts.failQuota) {
              throw Object.assign(
                new Error('invalid input syntax for type uuid: "trial_gJ1TIcai"'),
                { code: "22P02", detail: "quota upsert rejected" },
              );
            }
            captured.push({ kind: "quota" });
            return [];
          }
          return [];
        },
      };
      try {
        return await fn(tx);
      } catch (e) {
        rolledBack = true;
        throw e;
      }
    },
  };
}

console.log("\n═══ tenant keys for storage register ═══");

{
  assert.equal(resolveStorageOfficeId({ tenantId: TRIAL_ID }), TRIAL_ID);
  assert.notEqual(resolveStorageOfficeId({ tenantId: TRIAL_ID }), USER_ID);
  console.log("  ✅ trial tenant uses req.tenantId");
}

{
  assert.equal(resolveStorageOfficeId({ tenantId: PERM_TEXT_ID }), PERM_TEXT_ID);
  assert.notEqual(resolveStorageOfficeId({ tenantId: PERM_TEXT_ID }), USER_ID);
  console.log("  ✅ permanent text tenant uses req.tenantId");
}

{
  const res = storageMgmtAuthResponse("office_required");
  assert.equal(res.status, 403);
  assert.deepEqual(res.body, { ...OFFICE_CONTEXT_REQUIRED });
  console.log("  ✅ missing office context → OFFICE_CONTEXT_REQUIRED 403");
}

console.log("\n═══ registerStorageFileWithQuota transaction ═══");

{
  const captured: Call[] = [];
  const mock = createMockDb({ captured });
  const result = await registerStorageFileWithQuota(
    {
      officeId: TRIAL_ID,
      userId: USER_ID,
      originalName: "doc.pdf",
      mimeType: "application/pdf",
      fileSize: 100,
      category: "document",
      fileHash: "abc",
    },
    { db: mock },
  );
  assert.equal(result.record.id, "file-1");
  assert.deepEqual(captured.map((c) => c.kind), ["file", "quota"]);
  assert.equal(mock.rolledBack(), false);
  console.log("  ✅ trial upload: file insert then quota upsert");
}

{
  const captured: Call[] = [];
  const mock = createMockDb({ captured });
  const result = await registerStorageFileWithQuota(
    {
      officeId: PERM_TEXT_ID,
      userId: USER_ID,
      originalName: "doc.pdf",
      fileSize: 50,
      category: "document",
      fileHash: null,
    },
    { db: mock },
  );
  assert.equal(result.record.id, "file-1");
  assert.deepEqual(captured.map((c) => c.kind), ["file", "quota"]);
  console.log("  ✅ permanent text tenant upload: file + quota upsert");
}

{
  const mock = createMockDb({ failQuota: true });
  await assert.rejects(
    () =>
      registerStorageFileWithQuota(
        {
          officeId: TRIAL_ID,
          userId: USER_ID,
          originalName: "doc.pdf",
          fileSize: 10,
          category: "document",
          fileHash: null,
        },
        { db: mock },
      ),
    (err: unknown) => {
      assert.equal((err as { code?: string }).code, "22P02");
      return true;
    },
  );
  assert.equal(mock.rolledBack(), true);
  console.log("  ✅ quota failure rolls back (no orphan file commit)");
}

{
  const mock = createMockDb({ failFile: true });
  await assert.rejects(() =>
    registerStorageFileWithQuota(
      {
        officeId: TRIAL_ID,
        userId: USER_ID,
        originalName: "doc.pdf",
        fileSize: 10,
        category: "document",
        fileHash: null,
      },
      { db: mock },
    ),
  );
  assert.equal(mock.rolledBack(), true);
  console.log("  ✅ file insert failure rolls back before quota");
}

console.log("\n═══ safe error response ═══");

{
  const res = storageRegisterErrorResponse();
  assert.equal(res.status, 500);
  assert.equal(res.body.code, "STORAGE_REGISTER_FAILED");
  assert.equal(res.body.message, STORAGE_REGISTER_FAILED.message);
  assert.doesNotMatch(res.body.message, /Failed query|22P02|invalid input syntax|SQLSTATE/i);
  console.log("  ✅ browser body is generic STORAGE_REGISTER_FAILED (no raw SQL)");
}

console.log("\n═══ storage.ts wiring ═══");

assert.match(storageTs, /registerStorageFileWithQuota\(/);
assert.match(storageTs, /logEndpointError\(\s*"POST \/api\/storage\/files"/);
assert.match(storageTs, /storageRegisterErrorResponse\(\)/);
/* The register catch must return the safe helper body — not raw e.message */
const registerCatch = storageTs.match(
  /registerStorageFileWithQuota\([\s\S]*?catch\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/,
);
assert.ok(registerCatch, "registerStorageFileWithQuota catch block present");
const catchBody = registerCatch?.[1] ?? "";
assert.match(catchBody, /storageRegisterErrorResponse/);
assert.doesNotMatch(catchBody, /e\.message/);
assert.match(registerTs, /client\.transaction/);
assert.match(registerTs, /ON CONFLICT \(office_id\)/);
assert.doesNotMatch(registerTs, /auth\.userId/);
assert.match(storageTs, /officeId:\s*u\.officeId/);
console.log("  ✅ POST /storage/files uses transaction helper + logEndpointError + safe body");

console.log("\n═══ migration 007 / 008 shape ═══");

assert.match(migration007, /CREATE TABLE IF NOT EXISTS office_storage_quota/);
assert.match(migration007, /office_id\s+TYPE TEXT USING office_id::text/);
assert.match(migration007, /DROP CONSTRAINT/);
assert.match(migration007, /PRIMARY KEY \(office_id\)|UNIQUE \(office_id\)/);
assert.match(migration007, /office_page/);
console.log("  ✅ 007 creates office_storage_quota TEXT tenant model");

assert.match(migration008, /CREATE TABLE IF NOT EXISTS storage_files/);
assert.match(migration008, /office_id\s+TEXT NOT NULL/);
assert.match(migration008, /id\s+UUID PRIMARY KEY/);
assert.match(migration008, /DROP CONSTRAINT/);
assert.match(migration008, /idx_storage_files_office_id/);
assert.doesNotMatch(migration008, /REFERENCES\s+office_page/);
/* Repo gap: storage_files must not appear in earlier formal migrations */
const migDir = join(SRC, "..", "migrations");
for (const name of [
  "001_tenant_isolation.sql",
  "003_drizzle_baseline_safe.sql",
  "004_legal_core_extensions.sql",
  "005_tenant_platform_tables.sql",
  "006_post_migration_api_support.sql",
  "007_office_storage_quota_text_tenant.sql",
]) {
  const body = readFileSync(join(migDir, name), "utf8");
  assert.doesNotMatch(body, /CREATE TABLE IF NOT EXISTS\s+"?storage_files"?/i);
}
console.log("  ✅ 008 creates storage_files (TEXT office_id); absent from 001–007");

console.log("\n✅ storageFileRegister: all checks passed\n");
