/**
 * Staging asset-403 incident reproduction (CORS) — differential proof.
 *
 * Proven against live production (sanitized):
 *   GET /assets/*.js + Origin: https://staging.adalahai.com
 *     → 403 application/json { code: CORS_ORIGIN_NOT_ALLOWED }
 *   GET /assets/*.js + Origin: https://adalahai.com → 200 text/javascript
 *
 * This harness fails under the broken policy (production domains only) and
 * passes under the fixed evaluateCorsOrigin (staging + same-origin).
 *
 * Run: pnpm --filter @workspace/api-server run test:frontend-static-cors
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import cors from "cors";
import {
  createCorsOriginRejectedError,
  evaluateCorsOrigin,
  PRODUCTION_CORS_DOMAINS,
  STAGING_CORS_DOMAINS,
} from "../lib/corsOriginPolicy";
import { globalErrorHandler } from "../middlewares/errorHandler";
import {
  registerEarlyProductionFrontendAssets,
  registerProductionSpaFallback,
} from "../middlewares/productionFrontendStatic";

type PolicyMode = "broken-baseline" | "fixed";

function buildApp(mode: PolicyMode, publicDir: string) {
  const app = express();
  const allowedOrigins: string[] = [];

  app.use((req, res, next) => {
    cors({
      credentials: true,
      origin(origin, callback) {
        let decision;
        if (mode === "broken-baseline") {
          // Historical: production domains + ALLOWED_ORIGINS + localhost only.
          // Staging origin not present → Vite crossorigin asset GETs → JSON 403.
          if (!origin) {
            decision = { allowed: true as const, reason: "missing-origin" as const };
          } else if (
            (PRODUCTION_CORS_DOMAINS as readonly string[]).includes(origin) ||
            allowedOrigins.includes(origin) ||
            /^http:\/\/localhost(:\d+)?$/.test(origin)
          ) {
            decision = { allowed: true as const, reason: "allowlist" as const };
          } else {
            decision = { allowed: false as const };
          }
        } else {
          decision = evaluateCorsOrigin(origin, req, allowedOrigins);
        }
        if (decision.allowed) return callback(null, true);
        callback(createCorsOriginRejectedError(origin ?? ""));
      },
    })(req, res, next);
  });

  registerEarlyProductionFrontendAssets(app, { publicDir, force: true });
  app.get("/api/cases", (_req, res) => res.status(401).json({ error: "auth required" }));
  registerProductionSpaFallback(app, { publicDir, force: true });
  app.use(globalErrorHandler);
  return app;
}

async function listen(app: express.Express) {
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return {
    base: `http://127.0.0.1:${addr.port}`,
    close: () => server.close(),
  };
}

async function get(base: string, path: string, origin: string | undefined) {
  // Policy is Origin-allowlist only — Host/X-Forwarded-Host must not affect CORS.
  const headers: Record<string, string> = {};
  if (origin !== undefined) headers.Origin = origin;
  const res = await fetch(`${base}${path}`, { headers });
  const body = await res.text();
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    body,
  };
}

const dir = mkdtempSync(join(tmpdir(), "adala-cors-static-"));
mkdirSync(join(dir, "assets"));
writeFileSync(
  join(dir, "index.html"),
  `<!doctype html><html><head>
<link rel="stylesheet" crossorigin href="/assets/app.css">
<script type="module" crossorigin src="/assets/app.js"></script>
</head><body><div id="root">loading</div></body></html>`,
);
writeFileSync(join(dir, "assets", "app.js"), "window.__ADALA_BOOT__=1");
writeFileSync(join(dir, "assets", "app.css"), "body{margin:0}");

console.log("\n═══ broken baseline: staging Origin → asset JSON 403 ═══");
{
  const { base, close } = await listen(buildApp("broken-baseline", dir));
  try {
    const html = await get(base, "/", undefined);
    assert.equal(html.status, 200);
    assert.match(html.type, /html/);

    const js = await get(base, "/assets/app.js", "https://staging.adalahai.com");
    assert.equal(js.status, 403, "baseline MUST 403 staging Origin assets");
    assert.match(js.type, /json/);
    assert.match(js.body, /CORS_ORIGIN_NOT_ALLOWED/);

    const css = await get(base, "/assets/app.css", "https://staging.adalahai.com");
    assert.equal(css.status, 403);
    assert.match(css.type, /json/);

    const prodOrigin = await get(base, "/assets/app.js", "https://adalahai.com");
    assert.equal(prodOrigin.status, 200);
    assert.match(prodOrigin.type, /javascript|ecmascript/);

    console.log("  ✅ reproduced incident: HTML 200, staging Origin assets → 403 JSON");
  } finally {
    close();
  }
}

console.log("\n═══ fixed policy: staging Origin assets succeed; API still protected ═══");
{
  assert.ok(STAGING_CORS_DOMAINS.includes("https://staging.adalahai.com"));
  const { base, close } = await listen(buildApp("fixed", dir));
  try {
    const js = await get(base, "/assets/app.js", "https://staging.adalahai.com");
    assert.equal(js.status, 200, `js=${js.status} ${js.body.slice(0, 120)}`);
    assert.match(js.type, /javascript|ecmascript/);
    assert.equal(js.body, "window.__ADALA_BOOT__=1");
    assert.doesNotMatch(js.body, /CORS_ORIGIN_NOT_ALLOWED/);

    const css = await get(base, "/assets/app.css", "https://staging.adalahai.com");
    assert.equal(css.status, 200);
    assert.match(css.type, /text\/css/);

    const evil = await get(base, "/assets/app.js", "https://evil.example");
    assert.equal(evil.status, 403);
    assert.match(evil.body, /CORS_ORIGIN_NOT_ALLOWED/);

    const api = await get(base, "/api/cases", "https://staging.adalahai.com");
    assert.equal(api.status, 401);
    assert.match(api.type, /json/);

    const missing = await get(base, "/assets/nope.js", "https://staging.adalahai.com");
    assert.equal(missing.status, 404);
    assert.doesNotMatch(missing.body, /doctype html/i);

    console.log("  ✅ fixed: staging assets MIME OK; evil Origin still 403; API auth intact");
  } finally {
    close();
  }
}

rmSync(dir, { recursive: true, force: true });
console.log("\n✅ frontendStaticCorsIncident differential passed\n");
