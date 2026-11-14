/**
 * ADALA-PLATFORM-RELIABILITY-008 — real PostgreSQL logical backup (pg_dump custom format).
 * State machine: SCHEDULED → RUNNING → CAPTURED → UPLOADED → VERIFIED → COMPLETED
 * Failures: FAILED_CAPTURE | FAILED_UPLOAD | FAILED_VERIFICATION
 *
 * This is NOT point-in-time recovery. Completeness = DB schema+data only; object storage
 * and secrets require separate recovery processes.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
  renameSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type BackupStatus =
  | "SCHEDULED"
  | "RUNNING"
  | "CAPTURED"
  | "UPLOADED"
  | "VERIFIED"
  | "COMPLETED"
  | "FAILED_CAPTURE"
  | "FAILED_UPLOAD"
  | "FAILED_VERIFICATION"
  | "EXPIRED";

export interface BackupRecord {
  id: string;
  status: BackupStatus;
  createdAt: string;
  completedAt?: string;
  artifactPath?: string;
  checksumSha256?: string;
  sizeBytes?: number;
  pgVersion?: string;
  error?: string;
  stages: { stage: string; at: string; ok: boolean; detail?: string }[];
}

export interface BackupOptions {
  databaseUrl: string;
  /** Directory for local artifacts (required for local verification). */
  artifactDir?: string;
  /** Optional upload callback; if omitted, CAPTURED→VERIFIED locally only. */
  upload?: (localPath: string, meta: { id: string; checksum: string }) => Promise<string>;
  /** Label prefix for artifact filenames */
  label?: string;
}

const running = new Set<string>();

function stage(rec: BackupRecord, name: string, ok: boolean, detail?: string) {
  rec.stages.push({ stage: name, at: new Date().toISOString(), ok, detail });
}

function parseDatabaseUrl(url: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const u = new URL(url);
  return {
    host: u.hostname || "127.0.0.1",
    port: u.port || "5432",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "").split("?")[0],
  };
}

function runPgDump(opts: {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  outFile: string;
}): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    /* Pass password via env only — never argv */
    const env = { ...process.env, PGPASSWORD: opts.password, PGHOST: opts.host, PGPORT: opts.port, PGUSER: opts.user };
    const args = [
      "-Fc",
      "--no-owner",
      "--no-acl",
      "-f",
      opts.outFile,
      opts.database,
    ];
    const child = spawn("pg_dump", args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

function sha256File(path: string): string {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function verifyCustomFormat(path: string): boolean {
  /* pg_dump -Fc starts with "PGDMP" magic */
  const buf = readFileSync(path);
  return buf.length > 5 && buf.subarray(0, 5).toString("utf8") === "PGDMP";
}

export async function createLogicalBackup(options: BackupOptions): Promise<BackupRecord> {
  const id = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (running.has("full")) {
    return {
      id,
      status: "FAILED_CAPTURE",
      createdAt: new Date().toISOString(),
      error: "overlapping_full_backup",
      stages: [{ stage: "overlap_guard", at: new Date().toISOString(), ok: false }],
    };
  }
  running.add("full");

  const artifactDir = options.artifactDir || join(tmpdir(), "adala-backups");
  mkdirSync(artifactDir, { recursive: true });
  const tmpPath = join(artifactDir, `.partial-${id}.dump`);
  const finalPath = join(artifactDir, `${options.label || "adala"}_${id}.dump`);

  const rec: BackupRecord = {
    id,
    status: "SCHEDULED",
    createdAt: new Date().toISOString(),
    stages: [],
  };
  stage(rec, "SCHEDULED", true);
  rec.status = "RUNNING";
  stage(rec, "RUNNING", true);

  try {
    const parsed = parseDatabaseUrl(options.databaseUrl);
    if (!parsed.database || parsed.database.includes("prod") && process.env.ADALA_ALLOW_PROD_BACKUP !== "1") {
      /* Soft guard: refuse URLs that look production unless explicitly allowed */
      if (/prod|production/i.test(options.databaseUrl) && process.env.ADALA_ALLOW_PROD_BACKUP !== "1") {
        throw new Error("refusing_production_like_database_url");
      }
    }

    const dump = await runPgDump({
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      outFile: tmpPath,
    });
    if (dump.code !== 0 || !existsSync(tmpPath)) {
      rec.status = "FAILED_CAPTURE";
      rec.error = `pg_dump_exit_${dump.code}`;
      stage(rec, "CAPTURE", false, dump.stderr.slice(0, 500));
      return rec;
    }
    renameSync(tmpPath, finalPath);
    rec.artifactPath = finalPath;
    rec.sizeBytes = statSync(finalPath).size;
    rec.status = "CAPTURED";
    stage(rec, "CAPTURED", true, `bytes=${rec.sizeBytes}`);

    if (options.upload) {
      try {
        const checksum = sha256File(finalPath);
        const remote = await options.upload(finalPath, { id, checksum });
        rec.status = "UPLOADED";
        stage(rec, "UPLOADED", true, remote);
      } catch (e: unknown) {
        rec.status = "FAILED_UPLOAD";
        rec.error = e instanceof Error ? e.message : String(e);
        stage(rec, "UPLOAD", false, rec.error);
        return rec;
      }
    } else {
      stage(rec, "UPLOAD_SKIPPED_LOCAL", true, "local_artifact_only");
    }

    const checksum = sha256File(finalPath);
    rec.checksumSha256 = checksum;
    if (!verifyCustomFormat(finalPath)) {
      rec.status = "FAILED_VERIFICATION";
      rec.error = "invalid_pgdump_magic";
      stage(rec, "VERIFY", false, rec.error);
      return rec;
    }
    /* Write sidecar metadata (no secrets) */
    const metaPath = `${finalPath}.meta.json`;
    writeFileSync(
      metaPath,
      JSON.stringify(
        {
          id,
          checksumSha256: checksum,
          sizeBytes: rec.sizeBytes,
          createdAt: rec.createdAt,
          format: "pg_dump-Fc",
          databaseName: parsed.database,
          host: parsed.host,
          note: "database_only_not_full_platform_backup",
        },
        null,
        2,
      ),
    );
    rec.status = "VERIFIED";
    stage(rec, "VERIFIED", true, checksum.slice(0, 16));
    rec.status = "COMPLETED";
    rec.completedAt = new Date().toISOString();
    stage(rec, "COMPLETED", true);
    return rec;
  } catch (e: unknown) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
    rec.status = "FAILED_CAPTURE";
    rec.error = e instanceof Error ? e.message : String(e);
    stage(rec, "FAILED", false, rec.error);
    return rec;
  } finally {
    running.delete("full");
  }
}

export function listLocalBackups(artifactDir: string): string[] {
  if (!existsSync(artifactDir)) return [];
  return readdirSync(artifactDir)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => join(artifactDir, f))
    .sort();
}

export function verifyBackupChecksum(artifactPath: string, expected?: string): boolean {
  if (!existsSync(artifactPath) || !verifyCustomFormat(artifactPath)) return false;
  if (!expected) return true;
  return sha256File(artifactPath) === expected;
}

export { sha256File, verifyCustomFormat, parseDatabaseUrl };
