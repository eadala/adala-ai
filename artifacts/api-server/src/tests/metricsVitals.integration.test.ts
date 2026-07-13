/**
 * POST /api/metrics/vitals — sendBeacon integration (text/plain + application/json)
 * Run: pnpm --filter @workspace/api-server run test:metrics-vitals
 */

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

/* Env must be set before app/db load */
process.env.DATABASE_URL ??= "postgresql://mock:mock@127.0.0.1:5432/mock";
process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test";
process.env.CLERK_SECRET_KEY ??= "sk_test";
process.env.NODE_ENV = "test";

const dbModule = await import("@workspace/db");
const { db } = dbModule;
(db as { execute: typeof db.execute }).execute = ((async () => ({ rows: [] })) as unknown) as typeof db.execute;

const { default: app } = await import("../app");

const VITAL = {
  name: "LCP",
  value: 2100,
  rating: "good",
  id: "lcp-1",
  url: "/dashboard",
} as const;
const payload = JSON.stringify(VITAL);

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, resolve));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

async function postVitals(
  label: string,
  init: { headers?: Record<string, string>; path?: string },
): Promise<void> {
  const res = await fetch(`${base}${init.path ?? "/api/metrics/vitals"}`, {
    method: "POST",
    headers: init.headers ?? {},
    body: payload,
  });
  const text = await res.text();
  assert.equal(
    res.status,
    204,
    `${label}: expected 204, got ${res.status}: ${text}`,
  );
}

console.log("\n═══ metricsVitals: sendBeacon text/plain ═══");
await postVitals("text/plain (sendBeacon)", {
  headers: { "Content-Type": "text/plain;charset=UTF-8" },
});
console.log("  ✅ text/plain sendBeacon → 204");

console.log("\n═══ metricsVitals: no Content-Type (sendBeacon default) ═══");
await postVitals("no Content-Type", { headers: {} });
console.log("  ✅ no Content-Type → 204");

console.log("\n═══ metricsVitals: application/json (fetch fallback) ═══");
await postVitals("application/json", {
  headers: { "Content-Type": "application/json" },
});
console.log("  ✅ application/json → 204");

console.log("\n═══ metricsVitals: trailing slash + session cookie (Clerk bypass) ═══");
await postVitals("trailing slash + cookie", {
  path: "/api/metrics/vitals/",
  headers: {
    "Content-Type": "text/plain;charset=UTF-8",
    Cookie: "__session=eyJhbGciOiJIUzI1NiJ9.test",
  },
});
console.log("  ✅ /api/metrics/vitals/ + session cookie → 204 (not 500/415)");

console.log("\n═══ metricsVitals: production Clerk + session cookie on beacon ═══");
const prevEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_not_valid_for_clerk_parser";

const prodServer = http.createServer(app);
await new Promise<void>((resolve) => prodServer.listen(0, resolve));
const prodPort = (prodServer.address() as AddressInfo).port;

const prodRes = await fetch(`http://127.0.0.1:${prodPort}/api/metrics/vitals`, {
  method: "POST",
  headers: {
    "Content-Type": "text/plain;charset=UTF-8",
    Cookie: "__session=fake-session",
    Authorization: "Bearer fake.jwt.token",
  },
  body: payload,
});
assert.equal(
  prodRes.status,
  204,
  `production beacon with invalid Clerk key must skip auth: ${await prodRes.text()}`,
);
prodServer.close();
process.env.NODE_ENV = prevEnv;
process.env.CLERK_PUBLISHABLE_KEY = "pk_test";
console.log("  ✅ production + invalid Clerk + cookies → 204 (Clerk skipped)");

server.close();
console.log("\n✅ metricsVitals integration: all checks passed\n");
process.exit(0);
