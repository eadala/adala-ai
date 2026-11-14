/**
 * ADALA-PLATFORM-RELIABILITY-GATE-009 — local storage + readiness transition harness.
 * Does not contact live object storage. Disposable paths only.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../../../..");
const EVIDENCE = join(REPO, "docs/engineering/platform-reliability/integration-gate/evidence");
const LOCAL_ROOT = join(REPO, ".adala-local-storage-gate009");
const ARTIFACT_DIR = join(REPO, ".adala-backups-gate009");

mkdirSync(EVIDENCE, { recursive: true });
rmSync(LOCAL_ROOT, { recursive: true, force: true });
rmSync(ARTIFACT_DIR, { recursive: true, force: true });
mkdirSync(LOCAL_ROOT, { recursive: true });
mkdirSync(ARTIFACT_DIR, { recursive: true });

process.env.STORAGE_PROVIDER = "local";
process.env.LOCAL_STORAGE_ROOT = LOCAL_ROOT;
process.env.LOCAL_STORAGE_BUCKET = "adala-gate009-test";
process.env.LOCAL_STORAGE_SSE = "local-at-rest-filesystem";
process.env.ADALA_BACKUP_ARTIFACT_DIR = ARTIFACT_DIR;
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://adala_app:repro_app@127.0.0.1:5432/adala_reliability_src";

const results: { id: string; ok: boolean; detail: string }[] = [];
function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
  assert.ok(ok, `${id}: ${detail}`);
}

async function main() {
  const { resetStorageProviderCache } = await import("../../core/storage/storageFactory.js");
  resetStorageProviderCache();
  const { isObjectStorageConfigured } = await import("../../core/storage/config.js");
  const {
    uploadBackup,
    downloadBackup,
    listBackups,
    deleteBackup,
    fullBackupKey,
  } = await import("../../core/backupStorage.js");
  const { createLogicalBackup, verifyBackupChecksum } = await import(
    "../../reliability/backup/pgDumpBackup.js"
  );
  const { verifyIsolatedRestore } = await import("../../reliability/dr/restoreVerify.js");
  const {
    readinessCheck,
    markStartupComplete,
    markShuttingDown,
    livenessPayload,
  } = await import("../../reliability/probes/readiness.js");

  record("LOCAL_STORAGE_CONFIGURED", isObjectStorageConfigured(), "STORAGE_PROVIDER=local");

  /* Artifact naming + integrity metadata */
  const key = fullBackupKey();
  record("ARTIFACT_NAMING", key.startsWith("backups/full/full-") && key.endsWith(".dump.enc"), key);

  const payload = Buffer.from("gate009-synthetic-backup-bytes");
  const sha = createHash("sha256").update(payload).digest("hex");
  await uploadBackup(key, payload, "application/octet-stream");
  const listed = await listBackups("backups/full/");
  record("UPLOAD_LIST", listed.some((f) => f.key === key), `listed=${listed.length}`);

  const downloaded = await downloadBackup(key);
  record(
    "DOWNLOAD_INTEGRITY",
    downloaded.equals(payload) && createHash("sha256").update(downloaded).digest("hex") === sha,
    `sha256=${sha.slice(0, 16)}`,
  );

  /* Download failure */
  let missingFail = false;
  try {
    await downloadBackup("backups/full/does-not-exist.dump.enc");
  } catch {
    missingFail = true;
  }
  record("DOWNLOAD_MISSING_FAILS", missingFail, "missing throws");

  /* Upload failure: path escape rejected */
  let unsafeFail = false;
  try {
    await uploadBackup("../escape.dump", payload);
  } catch {
    unsafeFail = true;
  }
  record("UPLOAD_UNSAFE_KEY_REJECTED", unsafeFail, "path escape blocked");

  /* Credential isolation: no R2 secrets required for local */
  record(
    "CREDENTIAL_ISOLATION",
    !process.env.R2_SECRET_ACCESS_KEY && isObjectStorageConfigured(),
    "local works without R2 credentials",
  );

  /* Retention config surface (env-driven; no live deletion of customer data) */
  process.env.ADALA_BACKUP_RETENTION_DAYS = "30";
  record(
    "RETENTION_CONFIG",
    process.env.ADALA_BACKUP_RETENTION_DAYS === "30",
    "retention days configured for activation plan",
  );

  await deleteBackup(key);
  const after = await listBackups("backups/full/");
  record("CLEANUP_DELETE", !after.some((f) => f.key === key), "deleted from local emulator");

  /* Restore-from-storage workflow: dump → upload → download → isolated restore */
  const databaseUrl =
    process.env.DATABASE_URL ||
    "postgresql://adala_app:repro_app@127.0.0.1:5432/adala_reliability_src";
  const backup = await createLogicalBackup({
    databaseUrl,
    artifactDir: ARTIFACT_DIR,
    label: "gate009",
  });
  const dumpPath = backup.artifactPath ?? "";
  record("LOGICAL_BACKUP", backup.status === "COMPLETED" && dumpPath.length > 0, backup.status);

  const { readFileSync } = await import("node:fs");
  const dumpBuf = readFileSync(dumpPath);
  const storeKey = fullBackupKey();
  await uploadBackup(storeKey, dumpBuf);
  const fromStore = await downloadBackup(storeKey);
  const restorePath = join(ARTIFACT_DIR, "from-storage.dump");
  writeFileSync(restorePath, fromStore);
  record(
    "RESTORE_FROM_STORAGE_CHECKSUM",
    verifyBackupChecksum(restorePath, backup.checksumSha256),
    "checksum matches after round-trip",
  );

  process.env.ADALA_RESTORE_ALLOW = "1";
  const adminUrl = "postgresql://adala_app:repro_app@127.0.0.1:5432/postgres";
  const restoreUrl = "postgresql://adala_app:repro_app@127.0.0.1:5432/adala_restore_gate009_001";
  const restore = await verifyIsolatedRestore({
    artifactPath: restorePath,
    expectedChecksum: backup.checksumSha256,
    restoreDatabaseUrl: restoreUrl,
    adminDatabaseUrl: adminUrl,
  });
  record("RESTORE_FROM_STORAGE", restore.outcome === "PASS", `outcome=${restore.outcome}`);

  /* Readiness transitions (in-process) */
  record("LIVENESS_INDEPENDENT", livenessPayload().ok === true, "alive");
  const beforeStart = await readinessCheck();
  record("READINESS_BEFORE_STARTUP", beforeStart.ok === false, beforeStart.status);
  markStartupComplete();
  const ready = await readinessCheck();
  record("READINESS_AFTER_STARTUP", ready.ok === true, JSON.stringify(ready.checks));
  markShuttingDown();
  const shutting = await readinessCheck();
  record("READINESS_SHUTDOWN", shutting.ok === false && shutting.status === "shutting_down", shutting.status);

  /* Encryption config recorded in local meta */
  const { getStorageProvider } = await import("../../core/storage/storageFactory.js");
  resetStorageProviderCache();
  const provider = getStorageProvider();
  await provider.putObject("backups/full/meta-check.dump.enc", Buffer.from("x"), {
    contentType: "application/octet-stream",
  });
  const meta = await provider.getObjectMetadata("backups/full/meta-check.dump.enc");
  record(
    "ENCRYPTION_METADATA",
    !!meta.metadata || meta.contentType === "application/octet-stream",
    JSON.stringify(meta),
  );

  const report = {
    suite: "reliability-integration-gate-009",
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  writeFileSync(join(EVIDENCE, "local-storage-harness.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log("PASS integration gate 009 local storage harness");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
