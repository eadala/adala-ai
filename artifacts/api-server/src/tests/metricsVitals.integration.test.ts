/**
 * POST /api/metrics/vitals — full Production middleware chain integration
 * Cold-starts app with invalid Clerk publishable key (mirrors Coolify misconfig).
 * Run: pnpm --filter @workspace/api-server run test:metrics-vitals
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_HELPER = join(HERE, "metricsVitals.prodServer.ts");

const VITAL = JSON.stringify({
  name: "LCP",
  value: 2100,
  rating: "good",
  id: "lcp-1",
  url: "/dashboard",
});

async function waitForPort(child: ReturnType<typeof spawn>, timeoutMs = 15_000): Promise<{
  port: number;
  lines: string[];
}> {
  const lines: string[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server start timeout\n${lines.join("\n")}`)), timeoutMs);
    if (!child.stdout) {
      clearTimeout(timer);
      reject(new Error("no stdout"));
      return;
    }
    const rl = createInterface({ input: child.stdout });
    rl.on("line", (line) => {
      lines.push(line);
      const m = line.match(/^READY:(\d+)$/);
      if (m) {
        clearTimeout(timer);
        resolve({ port: Number(m[1]), lines });
      }
    });
    child.stderr?.on("data", (buf) => lines.push(String(buf)));
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early code=${code}\n${lines.join("\n")}`));
    });
  });
}

console.log("\n═══ metricsVitals: cold Production app + invalid Clerk key ═══");

const child = spawn(
  process.execPath,
  ["--import", "tsx", SERVER_HELPER],
  {
    cwd: join(HERE, "../.."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://mock:mock@127.0.0.1:5432/mock",
      CLERK_PUBLISHABLE_KEY: "pk_test_not_valid_for_clerk_parser",
      CLERK_SECRET_KEY: "sk_test_not_valid",
      PUBLIC_DIR: join(HERE, "nonexistent-public"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

const { port, lines: bootLines } = await waitForPort(child);
const base = `http://127.0.0.1:${port}`;

async function post(
  label: string,
  path: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: VITAL,
  });
  const body = await res.text();
  return { status: res.status, body, ms: Date.now() - t0 };
}

const cookieHeaders = {
  "Content-Type": "text/plain;charset=UTF-8",
  Cookie: "__session=eyJhbGciOiJIUzI1NiJ9.fake",
  Authorization: "Bearer fake.jwt.token",
  Host: "adalahai.com",
  Origin: "https://adalahai.com",
};

/* text/plain sendBeacon */
{
  const r = await post("text/plain", "/api/metrics/vitals", cookieHeaders);
  assert.equal(r.status, 204, `text/plain: ${r.status} ${r.body}`);
  console.log(`  ✅ text/plain + cookies + invalid Clerk → 204 (${r.ms}ms)`);
}

/* application/json fetch fallback */
{
  const r = await post("json", "/api/metrics/vitals", {
    ...cookieHeaders,
    "Content-Type": "application/json",
  });
  assert.equal(r.status, 204, `json: ${r.status} ${r.body}`);
  console.log(`  ✅ application/json + cookies + invalid Clerk → 204 (${r.ms}ms)`);
}

/* trailing slash */
{
  const r = await post("slash", "/api/metrics/vitals/", cookieHeaders);
  assert.equal(r.status, 204, `trailing slash: ${r.status} ${r.body}`);
  console.log(`  ✅ /api/metrics/vitals/ + cookies → 204 (${r.ms}ms)`);
}

/* no Content-Type (browser sendBeacon default variance) */
{
  const r = await post("no-ct", "/api/metrics/vitals", {
    Cookie: cookieHeaders.Cookie,
    Host: "adalahai.com",
  });
  assert.equal(r.status, 204, `no-ct: ${r.status} ${r.body}`);
  console.log(`  ✅ no Content-Type + cookies → 204 (${r.ms}ms)`);
}

/* Collect gate logs while posting diagnostics */
const logBuf: string[] = [...bootLines];
const onLog = (buf: Buffer) => logBuf.push(String(buf));
child.stdout?.on("data", onLog);
child.stderr?.on("data", onLog);

{
  await post("diag", "/api/metrics/vitals", cookieHeaders);
  await new Promise((r) => setTimeout(r, 400));
}
child.stdout?.off("data", onLog);
child.stderr?.off("data", onLog);

const gateLog = logBuf.join("\n");
assert.match(gateLog, /clerkBeaconGate/, "expected [clerkBeaconGate] diagnostic log");
assert.match(gateLog, /"skip":\s*true/, "expected skip:true on beacon POST");
console.log("  ✅ clerkBeaconGate diagnostic log shows skip:true");

/* Non-beacon path must NOT be skipped — Clerk still runs → 500 with invalid key */
{
  const res = await fetch(`${base}/api/healthz`);
  assert.equal(res.status, 200, "healthz still works without Clerk");
  console.log("  ✅ /api/healthz unaffected");

  const res2 = await fetch(`${base}/api/offices/my`, {
    headers: { Cookie: "__session=fake", Host: "adalahai.com" },
  });
  assert.notEqual(res2.status, 204, "non-beacon must not get beacon 204");
  assert.ok(
    res2.status === 500 || res2.status === 401 || res2.status === 403,
    `non-beacon should still hit Clerk/auth (got ${res2.status})`,
  );
  console.log(`  ✅ /api/offices/my still goes through Clerk (status ${res2.status})`);
}

child.kill("SIGTERM");
await new Promise((r) => child.once("exit", r));

console.log("\n✅ metricsVitals production-chain: all checks passed\n");
process.exit(0);
