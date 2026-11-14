/**
 * Isolated restore verification — disposable targets only.
 * NEVER targets production/staging hostnames or non-disposable DB names.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { verifyCustomFormat, sha256File, parseDatabaseUrl } from "../backup/pgDumpBackup";

export type RestoreOutcome = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";

export interface RestoreVerifyResult {
  outcome: RestoreOutcome;
  exitCode: number;
  stages: { stage: string; ok: boolean; detail?: string }[];
  restoreDurationMs?: number;
  error?: string;
}

const DISPOSABLE_DB_RE = /^adala_(restore|dr|reliability)_[a-z0-9_]+$/i;
const FORBIDDEN_HOST_RE = /(prod|production|staging|coolify|hetzner)/i;

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export function assertDisposableTarget(databaseUrl: string): void {
  const p = parseDatabaseUrl(databaseUrl);
  if (FORBIDDEN_HOST_RE.test(p.host) && process.env.ADALA_RESTORE_ALLOW_HOST !== "1") {
    throw new Error(`forbidden_restore_host:${p.host}`);
  }
  if (!DISPOSABLE_DB_RE.test(p.database)) {
    throw new Error(`non_disposable_database:${p.database}`);
  }
  if (process.env.ADALA_RESTORE_ALLOW !== "1") {
    throw new Error("ADALA_RESTORE_ALLOW=1 required");
  }
}

export async function verifyIsolatedRestore(opts: {
  artifactPath: string;
  expectedChecksum?: string;
  restoreDatabaseUrl: string;
  adminDatabaseUrl: string; /* used to CREATE/DROP disposable DB via maintenance connection */
  integrityMarkerSql?: string;
}): Promise<RestoreVerifyResult> {
  const stages: RestoreVerifyResult["stages"] = [];
  const push = (stage: string, ok: boolean, detail?: string) => stages.push({ stage, ok, detail });

  try {
    assertDisposableTarget(opts.restoreDatabaseUrl);
  } catch (e: unknown) {
    return {
      outcome: "FAIL",
      exitCode: 2,
      stages: [{ stage: "PRECHECK_TARGET", ok: false, detail: e instanceof Error ? e.message : String(e) }],
      error: "unsafe_target",
    };
  }

  if (!existsSync(opts.artifactPath)) {
    push("ARTIFACT_EXISTS", false, "missing");
    return { outcome: "FAIL", exitCode: 3, stages, error: "missing_artifact" };
  }
  push("ARTIFACT_EXISTS", true);

  if (!verifyCustomFormat(opts.artifactPath)) {
    push("FORMAT", false, "not_pgdump_Fc");
    return { outcome: "FAIL", exitCode: 4, stages, error: "corrupted_or_invalid_format" };
  }
  push("FORMAT", true);

  const checksum = sha256File(opts.artifactPath);
  if (opts.expectedChecksum && checksum !== opts.expectedChecksum) {
    push("CHECKSUM", false, "mismatch");
    return { outcome: "FAIL", exitCode: 5, stages, error: "checksum_mismatch" };
  }
  push("CHECKSUM", true, checksum.slice(0, 16));

  const target = parseDatabaseUrl(opts.restoreDatabaseUrl);
  const admin = parseDatabaseUrl(opts.adminDatabaseUrl);
  const envAdmin = {
    ...process.env,
    PGPASSWORD: admin.password,
    PGHOST: admin.host,
    PGPORT: admin.port,
    PGUSER: admin.user,
  };
  const envTarget = {
    ...process.env,
    PGPASSWORD: target.password,
    PGHOST: target.host,
    PGPORT: target.port,
    PGUSER: target.user,
  };

  /* Recreate disposable DB */
  await run("psql", ["-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${target.database}`], envAdmin);
  const created = await run(
    "psql",
    ["-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${target.database} OWNER ${target.user}`],
    envAdmin,
  );
  if (created.code !== 0) {
    push("CREATE_DB", false, created.stderr.slice(0, 300));
    return { outcome: "FAIL", exitCode: 6, stages, error: "create_db_failed" };
  }
  push("CREATE_DB", true);

  const t0 = Date.now();
  const restored = await run(
    "pg_restore",
    ["--no-owner", "--no-acl", "-d", target.database, opts.artifactPath],
    envTarget,
  );
  /* pg_restore may exit 1 with warnings; treat as fail only if no tables */
  const duration = Date.now() - t0;
  push("RESTORE", restored.code === 0 || restored.code === 1, `code=${restored.code}`);

  const count = await run(
    "psql",
    ["-d", target.database, "-tAc", "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"],
    envTarget,
  );
  const tableCount = Number((count.stdout || "").trim());
  if (!Number.isFinite(tableCount) || tableCount < 1) {
    push("SCHEMA", false, `tables=${tableCount}`);
    return { outcome: "FAIL", exitCode: 7, stages, error: "empty_schema", restoreDurationMs: duration };
  }
  push("SCHEMA", true, `tables=${tableCount}`);

  if (opts.integrityMarkerSql) {
    const marker = await run("psql", ["-d", target.database, "-tAc", opts.integrityMarkerSql], envTarget);
    if (marker.code !== 0 || !(marker.stdout || "").trim()) {
      push("INTEGRITY_MARKER", false, marker.stderr.slice(0, 200));
      return { outcome: "FAIL", exitCode: 8, stages, error: "integrity_marker_failed", restoreDurationMs: duration };
    }
    push("INTEGRITY_MARKER", true, marker.stdout.trim().slice(0, 80));
  }

  const smoke = await run("psql", ["-d", target.database, "-tAc", "SELECT 1"], envTarget);
  if (smoke.code !== 0 || smoke.stdout.trim() !== "1") {
    push("SMOKE_READ", false);
    return { outcome: "FAIL", exitCode: 9, stages, error: "smoke_failed", restoreDurationMs: duration };
  }
  push("SMOKE_READ", true);

  return { outcome: "PASS", exitCode: 0, stages, restoreDurationMs: duration };
}

export function corruptFileCopy(src: string, dest: string): void {
  const buf = Buffer.from(readFileSync(src));
  if (buf.length > 20) buf[20] = buf[20] ^ 0xff;
  writeFileSync(dest, buf);
}

export function checksumOf(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export { unlinkSync };
