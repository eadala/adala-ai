#!/usr/bin/env node
/** ADALA-SAAS-007 Profile A — isolated health/ready latency (not full app). */
import http from "node:http";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../lib/db/package.json"),
);
const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://adala_app:repro_app@127.0.0.1:5432/adala_rls_repro",
  max: 10,
});

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, status: "healthy" }));
    return;
  }
  if (req.url === "/api/readyz") {
    try {
      await pool.query("SELECT 1");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ready: true }));
    } catch {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function bench(path, n = 50, concurrency = 5) {
  const times = [];
  let errors = 0;
  async function one() {
    const t0 = performance.now();
    try {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) errors++;
      await res.text();
    } catch {
      errors++;
    }
    times.push(performance.now() - t0);
  }
  const queue = [];
  for (let i = 0; i < n; i++) {
    queue.push(one());
    if (queue.length >= concurrency) await Promise.all(queue.splice(0));
  }
  await Promise.all(queue);
  times.sort((a, b) => a - b);
  const pct = (p) => times[Math.min(times.length - 1, Math.floor((p / 100) * (times.length - 1)))];
  return {
    path,
    n,
    concurrency,
    errors,
    p50_ms: Number(pct(50).toFixed(3)),
    p95_ms: Number(pct(95).toFixed(3)),
    p99_ms: Number(pct(99).toFixed(3)),
    max_ms: Number(times[times.length - 1].toFixed(3)),
    mean_ms: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(3)),
  };
}

const mem0 = process.memoryUsage();
const healthz = await bench("/api/healthz", 100, 10);
const readyz = await bench("/api/readyz", 50, 5);
const mem1 = process.memoryUsage();

const report = {
  suite: "saas-assurance-007-perf-baseline",
  profile: "A-baseline",
  assumptions:
    "synthetic local http+pg SELECT 1; not full Express/Clerk stack; not production SLO",
  results: [healthz, readyz],
  memory: {
    rss0: mem0.rss,
    rss1: mem1.rss,
    heapUsed0: mem0.heapUsed,
    heapUsed1: mem1.heapUsed,
  },
  poolDefaultMax: pool.options.max,
  measuredAt: new Date().toISOString(),
};

const out = join(dirname(fileURLToPath(import.meta.url)), "perf-baseline-local.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
server.close();
await pool.end();
