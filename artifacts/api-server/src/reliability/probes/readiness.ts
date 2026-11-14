/**
 * Liveness / readiness / startup probe helpers (ADALA-PLATFORM-RELIABILITY-008).
 * Liveness: process alive (no external deps).
 * Readiness: critical deps for serving case-management traffic (DB + init).
 * Startup: initialization gate before readiness is meaningful.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type ProbeStatus = "ok" | "not_ready" | "starting" | "shutting_down";

let startupComplete = false;
let shuttingDown = false;
let lastReadinessOk = false;
const startedAt = Date.now();

export function markStartupComplete(): void {
  startupComplete = true;
}

export function markShuttingDown(): void {
  shuttingDown = true;
}

/** Cache last readiness outcome for metrics/observability (no high-cardinality labels). */
export function setReadinessOk(ok: boolean): void {
  lastReadinessOk = ok;
}

export function getReadinessOk(): boolean {
  return lastReadinessOk;
}

export function isStartupComplete(): boolean {
  return startupComplete;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function livenessPayload() {
  return {
    ok: true,
    status: "alive" as const,
    probe: "liveness",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    ts: Date.now(),
  };
}

export function startupPayload() {
  if (shuttingDown) {
    return { ok: false, status: "shutting_down" as ProbeStatus, probe: "startup", httpStatus: 503 };
  }
  if (!startupComplete) {
    return { ok: false, status: "starting" as ProbeStatus, probe: "startup", httpStatus: 503 };
  }
  return { ok: true, status: "ok" as ProbeStatus, probe: "startup", httpStatus: 200 };
}

export async function readinessCheck(opts?: { dbTimeoutMs?: number }): Promise<{
  ok: boolean;
  status: ProbeStatus;
  httpStatus: number;
  checks: Record<string, { ok: boolean; detail?: string; latencyMs?: number }>;
}> {
  const checks: Record<string, { ok: boolean; detail?: string; latencyMs?: number }> = {};

  if (shuttingDown) {
    checks.shutdown = { ok: false, detail: "shutting_down" };
    return { ok: false, status: "shutting_down", httpStatus: 503, checks };
  }
  if (!startupComplete) {
    checks.startup = { ok: false, detail: "startup_incomplete" };
    return { ok: false, status: "starting", httpStatus: 503, checks };
  }

  if (!process.env.DATABASE_URL) {
    checks.config = { ok: false, detail: "DATABASE_URL_missing" };
    return { ok: false, status: "not_ready", httpStatus: 503, checks };
  }
  checks.config = { ok: true };

  const timeoutMs = opts?.dbTimeoutMs ?? 1500;
  const t0 = Date.now();
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("db_timeout")), timeoutMs)),
    ]);
    checks.database = { ok: true, latencyMs: Date.now() - t0 };
  } catch (e: unknown) {
    checks.database = {
      ok: false,
      latencyMs: Date.now() - t0,
      detail: e instanceof Error ? e.message : "db_error",
    };
    return { ok: false, status: "not_ready", httpStatus: 503, checks };
  }

  /* Optional providers intentionally excluded from readiness */
  checks.optional_providers = { ok: true, detail: "excluded_from_readiness" };

  return { ok: true, status: "ok", httpStatus: 200, checks };
}
