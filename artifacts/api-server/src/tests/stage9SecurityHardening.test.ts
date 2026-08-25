/**
 * Stage 9 — Security hardening: sensitive SPA paths + HEAL_SECRET fail-closed.
 * Run: pnpm --filter @workspace/api-server run test:stage9-security
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isSensitiveDotPath } from "../lib/sensitiveStaticPath";
import { resolveHealSecret } from "../lib/healSecret";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");
const readRepo = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const readSrc = (rel: string) => readFileSync(join(API, rel), "utf8");

console.log("\n═══ isSensitiveDotPath ═══");
{
  for (const p of [
    "/.git/config",
    "/.git/HEAD",
    "/.env",
    "/.env.local",
    "/.aws/credentials",
    "/foo/.git/config",
    "/.dockerignore",
  ]) {
    assert.equal(isSensitiveDotPath(p), true, `must reject ${p}`);
  }
  for (const p of [
    "/",
    "/dashboard",
    "/cases/123",
    "/api/healthz",
    "/assets/index.js",
    "/robots.txt",
    "/favicon.svg",
  ]) {
    assert.equal(isSensitiveDotPath(p), false, `must allow ${p}`);
  }
  assert.equal(isSensitiveDotPath("/.git/config?x=1"), true);
  console.log("  ✅ /.git/* /.env rejected; normal SPA routes allowed");
}

console.log("\n═══ resolveHealSecret ═══");
{
  const missingProd = resolveHealSecret({ NODE_ENV: "production" });
  assert.equal(missingProd.ok, false);
  if (!missingProd.ok) assert.equal(missingProd.reason, "missing_in_production");

  const emptyProd = resolveHealSecret({ NODE_ENV: "production", HEAL_SECRET: "   " });
  assert.equal(emptyProd.ok, false);

  const shortProd = resolveHealSecret({ NODE_ENV: "production", HEAL_SECRET: "short" });
  assert.equal(shortProd.ok, false);
  if (!shortProd.ok) assert.equal(shortProd.reason, "too_short");

  const okProd = resolveHealSecret({
    NODE_ENV: "production",
    HEAL_SECRET: "production-heal-secret-value",
  });
  assert.equal(okProd.ok, true);
  if (okProd.ok) assert.equal(okProd.secret, "production-heal-secret-value");

  const devDefault = resolveHealSecret({ NODE_ENV: "development" });
  assert.equal(devDefault.ok, true);
  if (devDefault.ok) assert.equal(devDefault.secret, "adala-heal-token");

  console.log("  ✅ production fail-closed without HEAL_SECRET; configured secret accepted");
}

console.log("\n═══ wiring: app.ts + internalHeal.ts ═══");
{
  const appTs = readSrc("app.ts");
  assert.match(appTs, /isSensitiveDotPath/);
  assert.match(appTs, /status\(404\)/);
  const guardIdx = appTs.indexOf("isSensitiveDotPath(req.path)");
  const spaIdx = appTs.indexOf('sendFile("index.html"');
  assert.ok(guardIdx >= 0 && spaIdx > guardIdx, "dot-path guard must run before SPA fallback");

  const heal = readSrc("routes/internalHeal.ts");
  assert.match(heal, /resolveHealSecret/);
  assert.match(heal, /heal_secret_not_configured|HEAL_SECRET/);
  assert.doesNotMatch(heal, /process\.env\.HEAL_SECRET\s*\?\?\s*["']adala-heal-token["']/);

  assert.match(readRepo("artifacts/api-server/package.json"), /test:stage9-security/);
  assert.match(readRepo(".github/workflows/ci.yml"), /test:stage9-security/);
  console.log("  ✅ SPA guard wired; production default HEAL_SECRET removed");
}

console.log("\n✅ stage9SecurityHardening tests passed\n");
