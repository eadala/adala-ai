/**
 * ADALA-PLATFORM-RELIABILITY-008 — isolated backup/restore/DR/readiness harness.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import express from "express";

const HERE = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(HERE, "../../.."); /* artifacts/api-server */
const REPO_ROOT = join(API_ROOT, "../.."); /* /workspace */
const ARTIFACT_DIR = join(REPO_ROOT, ".adala-backups-test");
const EVIDENCE_DIR = join(REPO_ROOT, "docs/engineering/platform-reliability/evidence");
const SRC_DB = "adala_reliability_src";
const RESTORE_DB = "adala_restore_harness_001";
const APP_URL = "postgresql://adala_app:repro_app@127.0.0.1:5432";
/** Maintenance connection for CREATE/DROP disposable DBs (adala_app has CREATEDB). */
const ADMIN_URL = `${APP_URL}/postgres`;

process.env.ADALA_RESTORE_ALLOW = "1";
process.env.ADALA_BACKUP_ARTIFACT_DIR = ARTIFACT_DIR;
process.env.DATABASE_URL = `${APP_URL}/${SRC_DB}`;
process.env.NODE_ENV = "test";

const results: { id: string; ok: boolean; detail: string }[] = [];

function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
  assert.ok(ok, `${id}: ${detail}`);
}

function psqlAdmin(sql: string): void {
  const r = spawnSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`psqlAdmin failed: ${r.stderr || r.stdout}`);
}

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const { createLogicalBackup, verifyBackupChecksum } = await import(
    "../../reliability/backup/pgDumpBackup.js"
  );
  const { verifyIsolatedRestore, corruptFileCopy, assertDisposableTarget } = await import(
    "../../reliability/dr/restoreVerify.js"
  );
  const {
    livenessPayload,
    readinessCheck,
    startupPayload,
    markStartupComplete,
    markShuttingDown,
  } = await import("../../reliability/probes/readiness.js");
  const { retryWithBackoff } = await import("../../recovery/retry.engine.js");

  psqlAdmin(`DROP DATABASE IF EXISTS ${SRC_DB}`);
  psqlAdmin(`CREATE DATABASE ${SRC_DB} OWNER adala_app`);
  const seed = spawnSync(
    "psql",
    [
      `${APP_URL}/${SRC_DB}`,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE TABLE reliability_marker (id text PRIMARY KEY, note text);
       INSERT INTO reliability_marker (id, note) VALUES ('marker-1', 'adala-reliability-008');`,
    ],
    { encoding: "utf8", env: { ...process.env, PGPASSWORD: "repro_app" } },
  );
  if (seed.status !== 0) throw new Error(`seed failed: ${seed.stderr}`);

  const backup = await createLogicalBackup({
    databaseUrl: `${APP_URL}/${SRC_DB}`,
    artifactDir: ARTIFACT_DIR,
    label: "adala_full",
  });
  const artifactPath = backup.artifactPath ?? "";
  record(
    "BACKUP_CREATION",
    backup.status === "COMPLETED" && artifactPath.length > 0,
    `${backup.status} path=${artifactPath} bytes=${backup.sizeBytes}`,
  );
  record(
    "BACKUP_INTEGRITY",
    !!backup.checksumSha256 &&
      artifactPath.length > 0 &&
      verifyBackupChecksum(artifactPath, backup.checksumSha256),
    `sha256=${backup.checksumSha256?.slice(0, 16)}`,
  );

  writeFileSync(
    join(EVIDENCE_DIR, "backup-record.json"),
    JSON.stringify(backup, null, 2),
  );

  psqlAdmin(`DROP DATABASE IF EXISTS ${RESTORE_DB}`);
  const restoreUrl = `${APP_URL}/${RESTORE_DB}`;
  const restore = await verifyIsolatedRestore({
    artifactPath,
    expectedChecksum: backup.checksumSha256,
    restoreDatabaseUrl: restoreUrl,
    adminDatabaseUrl: ADMIN_URL,
    integrityMarkerSql: "SELECT note FROM reliability_marker WHERE id='marker-1'",
  });
  writeFileSync(join(EVIDENCE_DIR, "restore-record.json"), JSON.stringify(restore, null, 2));
  record(
    "ISOLATED_RESTORE",
    restore.outcome === "PASS",
    `outcome=${restore.outcome} ms=${restore.restoreDurationMs}`,
  );
  record(
    "RESTORED_DATA_VALIDATION",
    restore.stages.some((s) => s.stage === "INTEGRITY_MARKER" && s.ok),
    JSON.stringify(restore.stages.filter((s) => s.stage === "INTEGRITY_MARKER")),
  );

  const corruptPath = join(ARTIFACT_DIR, "corrupt.dump");
  corruptFileCopy(artifactPath, corruptPath);
  psqlAdmin(`DROP DATABASE IF EXISTS adala_restore_corrupt_001`);
  const corrupt = await verifyIsolatedRestore({
    artifactPath: corruptPath,
    expectedChecksum: backup.checksumSha256,
    restoreDatabaseUrl: `${APP_URL}/adala_restore_corrupt_001`,
    adminDatabaseUrl: ADMIN_URL,
  });
  record(
    "CORRUPTED_BACKUP_REJECTION",
    corrupt.outcome === "FAIL" && corrupt.exitCode !== 0,
    `outcome=${corrupt.outcome} exit=${corrupt.exitCode}`,
  );

  const missing = await verifyIsolatedRestore({
    artifactPath: join(ARTIFACT_DIR, "does-not-exist.dump"),
    restoreDatabaseUrl: `${APP_URL}/adala_restore_missing_001`,
    adminDatabaseUrl: ADMIN_URL,
  });
  record("MISSING_BACKUP_FAIL", missing.outcome === "FAIL", `outcome=${missing.outcome}`);

  let unsafeOk = false;
  try {
    assertDisposableTarget(`${APP_URL}/production_db`);
  } catch {
    unsafeOk = true;
  }
  record("UNSAFE_TARGET_REJECTED", unsafeOk, "production_db rejected");

  record("LIVENESS", livenessPayload().ok === true, "alive");
  record(
    "STARTUP_BEFORE",
    startupPayload().ok === false && startupPayload().httpStatus === 503,
    "starting",
  );
  markStartupComplete();
  record("STARTUP_AFTER", startupPayload().ok === true, "ok");

  process.env.DATABASE_URL = `${APP_URL}/${SRC_DB}`;
  const ready = await readinessCheck({ dbTimeoutMs: 2000 });
  record("READINESS_OK", ready.ok === true, JSON.stringify(ready.checks));

  markShuttingDown();
  const readyDown = await readinessCheck();
  record("READINESS_SHUTDOWN", readyDown.ok === false, JSON.stringify(readyDown.status));

  const app = express();
  app.get("/api/healthz", (_req, res) => res.status(200).json(livenessPayload()));
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const hz = await fetch(`http://127.0.0.1:${port}/api/healthz`);
  record("HEALTHZ_HTTP", hz.status === 200, `status=${hz.status}`);
  server.close();

  let attempts = 0;
  await retryWithBackoff(
    async () => {
      attempts++;
      if (attempts < 2) throw new Error("fail-once");
      return "ok";
    },
    { retries: 3, initialDelay: 10, label: "jitter-test" },
  );
  record("RETRY_JITTER_BOUNDED", attempts === 2, `attempts=${attempts}`);

  const docker = readFileSync(join(REPO_ROOT, "Dockerfile"), "utf8");
  record(
    "DOCKER_FROZEN_LOCKFILE",
    docker.includes("pnpm install --frozen-lockfile") && !docker.includes("--no-frozen-lockfile"),
    "frozen-lockfile enforced",
  );

  const drSrc = readFileSync(join(API_ROOT, "src/modules/security/drCenter.ts"), "utf8");
  record(
    "DR_NO_UNCONDITIONAL_SUCCESS",
    !drSrc.includes('message: "اختبار الاسترداد ناجح"') && drSrc.includes('outcome: "BLOCKED"'),
    "evidence-driven DR",
  );

  const fullCron = readFileSync(join(API_ROOT, "src/cron/agentCron.ts"), "utf8");
  record(
    "FULL_BACKUP_NOT_STATS_ONLY",
    fullCron.includes("createLogicalBackup") && !fullCron.includes('type: "full_system"'),
    "pg_dump path wired",
  );

  psqlAdmin(`DROP DATABASE IF EXISTS ${RESTORE_DB}`);
  psqlAdmin(`DROP DATABASE IF EXISTS adala_restore_corrupt_001`);
  try {
    unlinkSync(corruptPath);
  } catch {
    /* ignore */
  }

  const report = {
    suite: "platform-reliability-008",
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  writeFileSync(join(EVIDENCE_DIR, "harness-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exit(1);
  console.log("PASS platform reliability harness");
}

main().catch((e) => {
  console.error(e);
  writeFileSync(
    join(EVIDENCE_DIR, "harness-report.json"),
    JSON.stringify({ suite: "platform-reliability-008", error: String(e), results }, null, 2),
  );
  process.exit(1);
});
