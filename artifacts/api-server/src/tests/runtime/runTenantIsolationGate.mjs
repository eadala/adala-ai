#!/usr/bin/env node
/**
 * ADALA-SEC-TENANT-P0-006 — machine-readable tenant isolation CI gate.
 * Isolated DBs only. Exit nonzero on required security failures.
 * Does not touch staging/production or deployment workflows.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const OUT_DIR = join(ROOT, "../../docs/engineering/security/tenant-p0/runtime-assurance/evidence");
mkdirSync(OUT_DIR, { recursive: true });

const RUNTIME_URL =
  process.env.TENANT_RUNTIME_DATABASE_URL ||
  "postgresql://adala_app:repro_app@127.0.0.1:5432/adala_tenant_runtime";
const RLS_URL =
  process.env.TENANT_RLS_DATABASE_URL ||
  "postgresql://adala_app:repro_app@127.0.0.1:5432/adala_rls_061";

const suites = [
  {
    id: "http-adversarial",
    required: true,
    cmd: "pnpm",
    args: ["exec", "tsx", "src/tests/runtime/httpAdversarialHarness.ts"],
    env: {
      DATABASE_URL: RUNTIME_URL,
      ADALA_HTTP_SECURITY_TEST: "1",
      ADALA_TEST_AUTH_SECRET: "runtime-assurance-secret-key",
      WHATSAPP_APP_SECRET: "wa-test-secret",
      NODE_ENV: "test",
    },
  },
  {
    id: "ai-runtime",
    required: true,
    cmd: "pnpm",
    args: ["exec", "tsx", "src/tests/runtime/aiRuntimeIsolationHarness.ts"],
    env: {
      DATABASE_URL: RUNTIME_URL,
      ADALA_HTTP_SECURITY_TEST: "1",
      ADALA_TEST_AUTH_SECRET: "runtime-assurance-secret-key",
      NODE_ENV: "test",
    },
  },
  {
    id: "rls-061",
    required: true,
    cmd: "pnpm",
    args: ["exec", "tsx", "src/tests/runtime/rlsMigration061Harness.ts"],
    env: { DATABASE_URL: RLS_URL, NODE_ENV: "test" },
  },
  {
    id: "pool-guc",
    required: true,
    cmd: "pnpm",
    args: ["exec", "tsx", "src/tests/runtime/poolGucContainmentHarness.ts"],
    env: { DATABASE_URL: RLS_URL, NODE_ENV: "test" },
  },
  {
    id: "static-p0",
    required: true,
    cmd: "pnpm",
    args: ["exec", "tsx", "src/tests/tenantP0Remediation.static.test.ts"],
    env: { NODE_ENV: "test" },
  },
];

const report = {
  gate: "tenant-isolation-p0-006",
  startedAt: new Date().toISOString(),
  suites: [],
  skipped: [],
  failedRequired: [],
};

let exitCode = 0;

for (const s of suites) {
  const r = spawnSync(s.cmd, s.args, {
    cwd: ROOT,
    env: { ...process.env, ...s.env },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const entry = {
    id: s.id,
    required: s.required,
    status: r.status,
    ok: r.status === 0,
    stdoutTail: (r.stdout || "").slice(-2000),
    stderrTail: (r.stderr || "").slice(-1000),
  };
  report.suites.push(entry);
  writeFileSync(join(OUT_DIR, `${s.id}.log`), `${r.stdout || ""}\n---STDERR---\n${r.stderr || ""}`);
  if (!entry.ok && s.required) {
    report.failedRequired.push(s.id);
    exitCode = 1;
  }
  if (!entry.ok && !s.required) report.skipped.push(s.id);
}

report.finishedAt = new Date().toISOString();
report.decision = exitCode === 0 ? "GATE_PASS" : "GATE_FAIL";
writeFileSync(join(OUT_DIR, "gate-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
