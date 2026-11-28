/**
 * Frontend static delivery boundaries — middleware order / allowlist (Layer 1).
 *
 * NOTE: The primary staging asset JSON-403 root cause is CORS rejecting the
 * staging Origin on Vite `crossorigin` asset GETs (see test:frontend-static-cors).
 * This suite covers a separate invariant: allowlisted assets must not be
 * intercepted by auth JSON after early static registration.
 *
 * Run: pnpm --filter @workspace/api-server run test:frontend-static
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  isPublicFrontendAssetPath,
  isSpaFallbackPath,
} from "../lib/publicFrontendAssetPath";
import {
  registerEarlyProductionFrontendAssets,
  registerProductionSpaFallback,
  skipAuthForPublicFrontendAssets,
} from "../middlewares/productionFrontendStatic";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = join(HERE, "..");
const readSrc = (rel: string) => readFileSync(join(API, rel), "utf8");

console.log("\n═══ publicFrontendAssetPath allowlist ═══");
{
  assert.equal(isPublicFrontendAssetPath("/assets/index-abc.js"), true);
  assert.equal(isPublicFrontendAssetPath("/assets/index-abc.css"), true);
  assert.equal(isPublicFrontendAssetPath("/favicon.svg"), true);
  assert.equal(isPublicFrontendAssetPath("/api/cases"), false);
  assert.equal(isPublicFrontendAssetPath("/assets/../.env"), false);
  assert.equal(isPublicFrontendAssetPath("/.env"), false);
  assert.equal(isPublicFrontendAssetPath("/dashboard"), false);
  assert.equal(isSpaFallbackPath("/dashboard"), true);
  assert.equal(isSpaFallbackPath("/assets/x.js"), false);
  assert.equal(isSpaFallbackPath("/api/healthz"), false);
  assert.equal(skipAuthForPublicFrontendAssets({ path: "/assets/x.js" }), true);
  assert.equal(skipAuthForPublicFrontendAssets({ path: "/api/cases" }), false);
  console.log("  ✅ allowlist + SPA fallback predicates");
}

console.log("\n═══ wiring: assets before Clerk; SPA after /api ═══");
{
  const appTs = readSrc("app.ts");
  // Call sites (ignore import lines): register early → clerk() → /api → SPA
  const earlyCall = appTs.indexOf("registerEarlyProductionFrontendAssets(app");
  const clerkCall = appTs.indexOf("clerk(req, res, next)");
  const skipCall = appTs.indexOf("skipAuthForPublicFrontendAssets(req)");
  const apiMount = appTs.indexOf('app.use("/api", router)');
  const spaCall = appTs.indexOf("registerProductionSpaFallback(app");
  assert.ok(earlyCall > 0, "early assets registration call missing");
  assert.ok(clerkCall > earlyCall, "early assets must register before clerk() invocation");
  assert.ok(skipCall > 0 && skipCall < clerkCall, "Clerk skip helper must gate clerk()");
  assert.ok(spaCall > apiMount && apiMount > clerkCall, "SPA fallback must register after /api router");
  assert.doesNotMatch(
    appTs,
    /app\.use\(express\.static\(publicDir/,
    "legacy post-API express.static mount must be removed",
  );
  console.log("  ✅ middleware order wired correctly");
}

console.log("\n═══ HTTP: assets bypass auth JSON 403; MIME + missing 404 ═══");
{
  const dir = mkdtempSync(join(tmpdir(), "adala-static-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>t</title><div id=root></div>");
  writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
  writeFileSync(join(dir, "assets", "app.css"), "body{color:red}");
  writeFileSync(join(dir, "favicon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'></svg>");

  const app = express();
  registerEarlyProductionFrontendAssets(app, { publicDir: dir, force: true });

  // Hostile auth AFTER early static — blocks /api only (Clerk-like).
  // Public assets must never receive this JSON 403.
  app.use((req, res, next) => {
    if (skipAuthForPublicFrontendAssets(req)) return next();
    if (String(req.path || "").startsWith("/api")) {
      return res.status(403).json({ error: "auth_blocked", code: "TEST_403" });
    }
    next();
  });

  app.get("/api/cases", (_req, res) => res.status(200).json({ ok: true }));

  registerProductionSpaFallback(app, { publicDir: dir, force: true });

  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const base = `http://127.0.0.1:${addr.port}`;

  async function get(path: string) {
    const res = await fetch(`${base}${path}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      type: res.headers.get("content-type") || "",
      body: buf.toString("utf8"),
    };
  }

  const html = await get("/");
  assert.equal(html.status, 200);
  assert.match(html.type, /text\/html/);
  assert.match(html.body, /doctype html/i);

  const js = await get("/assets/app.js");
  assert.equal(js.status, 200, `js status=${js.status} body=${js.body.slice(0, 80)}`);
  assert.match(js.type, /javascript|ecmascript/);
  assert.equal(js.body, "console.log(1)");
  assert.doesNotMatch(js.body, /auth_blocked/);

  const css = await get("/assets/app.css");
  assert.equal(css.status, 200, `css status=${css.status} body=${css.body.slice(0, 80)}`);
  assert.match(css.type, /text\/css/);
  assert.doesNotMatch(css.body, /auth_blocked|application\/json/);

  const missing = await get("/assets/missing-XYZ.js");
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.body, /doctype html/i);
  assert.doesNotMatch(missing.body, /auth_blocked/);

  const api = await get("/api/cases");
  assert.equal(api.status, 403);
  assert.match(api.type, /json/);
  assert.match(api.body, /auth_blocked/);

  const envPath = await get("/.env");
  assert.equal(envPath.status, 404);

  const assetsEnv = await get("/assets/../.env");
  assert.notEqual(assetsEnv.status, 200);
  assert.doesNotMatch(assetsEnv.body, /SECRET|PASSWORD|DATABASE_URL/i);

  server.close();
  rmSync(dir, { recursive: true, force: true });
  console.log("  ✅ assets served with correct MIME; auth JSON blocked from assets; API still 403");
}

console.log("\n✅ frontendStaticDelivery tests passed\n");
