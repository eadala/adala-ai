/**
 * Unit/runtime checks for 010-B fail-closed live storage gate.
 * Does not contact live R2.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../../../..");
const LOCAL_ROOT = join(REPO, ".adala-local-storage-010b-gate");
const EVIDENCE = join(REPO, "docs/engineering/platform-reliability/phase-010a/evidence");

mkdirSync(EVIDENCE, { recursive: true });
rmSync(LOCAL_ROOT, { recursive: true, force: true });
mkdirSync(LOCAL_ROOT, { recursive: true });

const results: { id: string; ok: boolean; detail: string }[] = [];
function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
  assert.ok(ok, `${id}: ${detail}`);
}

async function main() {
  delete process.env.ADALA_010B_AUTHORIZED;
  process.env.STORAGE_PROVIDER = "cloudflare_r2";
  process.env.R2_BUCKET_NAME = "should-not-be-used";
  process.env.R2_ENDPOINT = "https://example.invalid";
  process.env.R2_ACCESS_KEY_ID = "x";
  process.env.R2_SECRET_ACCESS_KEY = "y";

  const { resetStorageProviderCache } = await import("../../core/storage/storageFactory.js");
  const {
    assertLiveBackupStorageAllowed,
    isSyntheticBackupKey,
  } = await import("../../reliability/gates/phase010bAuth.js");

  const blocked = assertLiveBackupStorageAllowed("upload");
  record("LIVE_UPLOAD_BLOCKED_WITHOUT_AUTH", !blocked.ok, blocked.ok ? "ok" : blocked.reason);

  process.env.STORAGE_PROVIDER = "local";
  process.env.LOCAL_STORAGE_ROOT = LOCAL_ROOT;
  resetStorageProviderCache();
  const localOk = assertLiveBackupStorageAllowed("upload");
  record("LOCAL_MODE_ALLOWED", localOk.ok && localOk.mode === "local", JSON.stringify(localOk));

  const { uploadBackup, downloadBackup, deleteBackup, fullBackupKey } = await import(
    "../../core/backupStorage.js"
  );

  let prefixReject = false;
  try {
    await uploadBackup("../escape.dump", Buffer.from("x"));
  } catch {
    prefixReject = true;
  }
  record("PREFIX_ESCAPE_REJECTED", prefixReject, "path escape");

  const key = fullBackupKey("synthetic-drill");
  await uploadBackup(key, Buffer.from("gate-bytes"));
  const down = await downloadBackup(key);
  record("LOCAL_ROUNDTRIP", down.toString() === "gate-bytes", key);

  /* Live mode still blocked even if someone flips provider mid-process without auth */
  process.env.STORAGE_PROVIDER = "cloudflare_r2";
  resetStorageProviderCache();
  delete process.env.ADALA_010B_AUTHORIZED;
  let liveReject = false;
  try {
    await uploadBackup(key, Buffer.from("nope"));
  } catch {
    liveReject = true;
  }
  record("LIVE_STILL_BLOCKED", liveReject, "no ADALA_010B_AUTHORIZED");

  record(
    "SYNTHETIC_KEY_HELPER",
    isSyntheticBackupKey("backups/full/full-synthetic-drill-1.dump.enc") &&
      !isSyntheticBackupKey("backups/../etc/passwd"),
    "helper",
  );

  /* Cleanup via local mode */
  process.env.STORAGE_PROVIDER = "local";
  process.env.LOCAL_STORAGE_ROOT = LOCAL_ROOT;
  resetStorageProviderCache();
  await deleteBackup(key);

  const report = {
    suite: "phase-010b-gate",
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    note: "No live R2 contacted; 010-B remains NOT_AUTHORIZED",
  };
  writeFileSync(join(EVIDENCE, "phase010b-gate-harness.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("PASS phase 010b gate harness");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
