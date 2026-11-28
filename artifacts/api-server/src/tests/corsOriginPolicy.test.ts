/**
 * CORS origin policy — explicit trusted-origin allowlist (no Host reflection).
 * Run: pnpm --filter @workspace/api-server run test:cors-origin
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import {
  createCorsOriginRejectedError,
  evaluateCorsOrigin,
  parseAllowedOriginsEnv,
  parseTrustedOrigin,
  PRODUCTION_CORS_DOMAINS,
  STAGING_CORS_DOMAINS,
} from "../lib/corsOriginPolicy";
import { globalErrorHandler } from "../middlewares/errorHandler";

console.log("\n═══ parseTrustedOrigin / parseAllowedOriginsEnv ═══");
{
  assert.equal(parseTrustedOrigin("https://staging.adalahai.com"), "https://staging.adalahai.com");
  assert.equal(parseTrustedOrigin("https://evil.example/path"), null);
  assert.equal(parseTrustedOrigin("https://*.adalahai.com"), null);
  assert.equal(parseTrustedOrigin("https://user:pass@evil.example"), null);
  assert.equal(parseTrustedOrigin("not-a-url"), null);
  assert.deepEqual(
    parseAllowedOriginsEnv("https://staging.adalahai.com, https://evil.example/x, *"),
    ["https://staging.adalahai.com"],
  );
  console.log("  ✅ trusted origin parser rejects wildcards/paths/userinfo");
}

console.log("\n═══ corsOriginPolicy: evaluateCorsOrigin ═══");

{
  const d = evaluateCorsOrigin("null", {
    method: "POST",
    originalUrl: "/api/metrics/vitals",
  });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "metrics-beacon-null");
  console.log("  ✅ Origin:null + POST /api/metrics/vitals → allowed");
}

{
  const d = evaluateCorsOrigin("null", {
    method: "POST",
    originalUrl: "/api/metrics/route-analytics",
  });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "metrics-beacon-null");
  console.log("  ✅ Origin:null + POST /api/metrics/route-analytics → allowed");
}

{
  const d = evaluateCorsOrigin("null", {
    method: "POST",
    originalUrl: "/api/metrics/vitals?x=1",
    path: "/stripped",
  });
  assert.equal(d.allowed, true, "uses originalUrl / normalized path");
  console.log("  ✅ Origin:null + vitals with query / misleading path → allowed");
}

{
  const d = evaluateCorsOrigin("null", {
    method: "POST",
    originalUrl: "/api/offices/my",
  });
  assert.equal(d.allowed, false);
  console.log("  ✅ Origin:null + protected API route → rejected");
}

{
  const d = evaluateCorsOrigin("null", {
    method: "GET",
    originalUrl: "/api/metrics/vitals/summary",
  });
  assert.equal(d.allowed, false, "summary is not a public beacon");
  console.log("  ✅ Origin:null + /metrics/vitals/summary → rejected");
}

{
  for (const origin of PRODUCTION_CORS_DOMAINS) {
    const d = evaluateCorsOrigin(origin, {
      method: "POST",
      originalUrl: "/api/offices/my",
    });
    assert.equal(d.allowed, true, origin);
    assert.equal(d.reason, "allowlist");
  }
  console.log("  ✅ allowed production origin → unchanged");
}

{
  for (const origin of [
    "https://example.replit.app",
    "https://example.replit.dev",
    "https://example.repl.co",
    "https://repl.it",
  ]) {
    const d = evaluateCorsOrigin(origin, {
      method: "POST",
      originalUrl: "/api/offices/my",
    });
    assert.equal(d.allowed, false, origin);
  }
  console.log("  ✅ legacy Replit origins → rejected");
}

{
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const d = evaluateCorsOrigin("http://localhost:5173", {
    method: "POST",
    originalUrl: "/api/offices/my",
  });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "allowlist");
  process.env.NODE_ENV = prev;
  console.log("  ✅ localhost development origin → allowed (non-production)");
}

{
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const d = evaluateCorsOrigin("http://localhost:5173", {
    method: "POST",
    originalUrl: "/api/offices/my",
  });
  assert.equal(d.allowed, false);
  process.env.NODE_ENV = prev;
  console.log("  ✅ localhost rejected when NODE_ENV=production");
}

{
  const d = evaluateCorsOrigin("https://evil.example", {
    method: "POST",
    originalUrl: "/api/metrics/vitals",
  });
  assert.equal(d.allowed, false);
  console.log("  ✅ unknown origin → rejected (even on beacon path)");
}

{
  for (const origin of STAGING_CORS_DOMAINS) {
    const d = evaluateCorsOrigin(origin, {
      method: "GET",
      originalUrl: "/assets/index.js",
    });
    assert.equal(d.allowed, true, origin);
    assert.equal(d.reason, "allowlist");
  }
  console.log("  ✅ staging CORS domains → allowed (Vite crossorigin assets)");
}

{
  // Spoofed Host must NEVER grant CORS — only explicit allowlist.
  const d = evaluateCorsOrigin("https://attacker.example", {
    method: "GET",
    originalUrl: "/assets/vendor-react.js",
  });
  assert.equal(d.allowed, false);
  console.log("  ✅ arbitrary Origin rejected (no Host reflection)");
}

{
  for (const origin of [
    "https://staging.adalahai.com.evil.com",
    "https://adalahai.com.evil.com",
    "https://notstaging.adalahai.com",
    "https://staging.adalahai.com.attacker",
    "http://staging.adalahai.com",
    "https://staging.adalahai.com:8443",
    "https://Staging.Adalahai.com",
    "https://staging.adalahai.com/",
    "https://staging.adalahai.com/path",
  ]) {
    const d = evaluateCorsOrigin(origin, {
      method: "GET",
      originalUrl: "/assets/index.js",
    });
    assert.equal(d.allowed, false, origin);
  }
  console.log("  ✅ lookalike / wrong-protocol / port / case / path Origins rejected");
}

{
  const d = evaluateCorsOrigin("https://preview.example.com", {
    method: "GET",
    originalUrl: "/assets/x.js",
  }, parseAllowedOriginsEnv("https://preview.example.com, https://bad.example/path"));
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "allowlist");
  console.log("  ✅ validated ALLOWED_ORIGINS entry → allowed");
}

{
  const d = evaluateCorsOrigin(undefined, {
    method: "POST",
    originalUrl: "/api/offices/my",
  });
  assert.equal(d.allowed, true);
  assert.equal(d.reason, "missing-origin");
  console.log("  ✅ missing Origin header → allowed (non-browser)");
}

{
  const err = createCorsOriginRejectedError("null");
  assert.equal(err.status, 403);
  assert.equal(err.statusCode, 403);
  assert.equal(err.code, "CORS_ORIGIN_NOT_ALLOWED");
  assert.match(err.message, /CORS: origin not allowed — null/);
  console.log("  ✅ rejection error carries 403 + CORS_ORIGIN_NOT_ALLOWED");
}

console.log("\n═══ corsOriginPolicy: express middleware integration ═══");

function buildCorsApp() {
  const app = express();
  const allowedOrigins: string[] = [];
  app.use((req, res, next) => {
    cors({
      credentials: true,
      origin(origin, callback) {
        const decision = evaluateCorsOrigin(origin, req, allowedOrigins);
        if (decision.allowed) return callback(null, true);
        callback(createCorsOriginRejectedError(origin ?? ""));
      },
    })(req, res, next);
  });
  app.post("/api/metrics/vitals", (_req, res) => res.status(204).end());
  app.post("/api/metrics/route-analytics", (_req, res) => res.status(204).end());
  app.post("/api/offices/my", (_req, res) => res.status(200).json({ ok: true }));
  app.use(globalErrorHandler);
  return app;
}

type JsonBody = {
  error?: { code?: string; message?: string };
  ok?: boolean;
} | string | null;

async function post(
  app: express.Express,
  path: string,
  origin: string | undefined,
): Promise<{ status: number; body: JsonBody }> {
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "text/plain;charset=UTF-8",
    };
    if (origin !== undefined) headers.Origin = origin;
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers,
      body: "{}",
    });
    const text = await res.text();
    let body: JsonBody = null;
    try {
      body = text ? (JSON.parse(text) as JsonBody) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } finally {
    server.close();
  }
}

{
  const app = buildCorsApp();
  const r = await post(app, "/api/metrics/vitals", "null");
  assert.equal(r.status, 204);
  console.log("  ✅ middleware: Origin:null + vitals → 204");
}

{
  const app = buildCorsApp();
  const r = await post(app, "/api/metrics/route-analytics", "null");
  assert.equal(r.status, 204);
  console.log("  ✅ middleware: Origin:null + route-analytics → 204");
}

{
  const app = buildCorsApp();
  const r = await post(app, "/api/offices/my", "null");
  assert.equal(r.status, 403);
  assert.ok(r.body && typeof r.body === "object");
  assert.equal(r.body.error?.code, "CORS_ORIGIN_NOT_ALLOWED");
  assert.match(String(r.body.error?.message ?? ""), /origin not allowed — null/);
  console.log("  ✅ middleware: Origin:null + protected route → 403 (not 500)");
}

{
  const app = buildCorsApp();
  const r = await post(app, "/api/offices/my", "https://adalahai.com");
  assert.equal(r.status, 200);
  console.log("  ✅ middleware: production origin → unchanged");
}

{
  const app = buildCorsApp();
  const r = await post(app, "/api/offices/my", "https://staging.adalahai.com");
  assert.equal(r.status, 200);
  console.log("  ✅ middleware: staging origin → allowed");
}

{
  const app = buildCorsApp();
  const r = await post(app, "/api/metrics/vitals", "https://evil.example");
  assert.equal(r.status, 403);
  assert.ok(r.body && typeof r.body === "object");
  assert.equal(r.body.error?.code, "CORS_ORIGIN_NOT_ALLOWED");
  console.log("  ✅ middleware: unknown origin → 403");
}

{
  // OPTIONS preflight: trusted staging Origin must not 403; evil must.
  const app = buildCorsApp();
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  try {
    const ok = await fetch(`http://127.0.0.1:${port}/api/offices/my`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://staging.adalahai.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.notEqual(ok.status, 403, `staging preflight status=${ok.status}`);
    const vary = ok.headers.get("vary") || "";
    assert.match(vary, /origin/i, `Vary should include Origin, got "${vary}"`);

    const bad = await fetch(`http://127.0.0.1:${port}/api/offices/my`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert.equal(bad.status, 403);
    console.log("  ✅ middleware: OPTIONS preflight staging OK + Vary Origin; evil 403");
  } finally {
    server.close();
  }
}

console.log("\n✅ corsOriginPolicy: all checks passed\n");
