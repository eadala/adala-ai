#!/usr/bin/env node
/**
 * Staging asset-delivery smoke (operator-run).
 *
 * Proves HTML + every first-party /assets/* referenced by index.html return 200
 * with correct MIME types, and that staging Origin does not yield CORS JSON 403.
 *
 * Usage:
 *   STAGING_URL=https://staging.adalahai.com \
 *   STAGING_BASIC_AUTH_USER=... \
 *   STAGING_BASIC_AUTH_PASS=... \
 *   node scripts/staging/smoke-asset-delivery.mjs
 *
 * Never prints secret values. Exit 0 = PASS, 1 = FAIL.
 */
import assert from "node:assert/strict";

const base = (process.env.STAGING_URL || "https://staging.adalahai.com").replace(/\/$/, "");
const user = process.env.STAGING_BASIC_AUTH_USER || "";
const pass = process.env.STAGING_BASIC_AUTH_PASS || "";

if (!user || !pass) {
  console.error(
    "BLOCKED: set STAGING_BASIC_AUTH_USER and STAGING_BASIC_AUTH_PASS (Traefik Basic Auth).",
  );
  process.exit(2);
}

const auth = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");

async function req(path, { origin } = {}) {
  const headers = {
    Authorization: `Basic ${auth}`,
    "User-Agent": "adala-staging-smoke/1.0",
  };
  if (origin) headers.Origin = origin;
  const res = await fetch(`${base}${path}`, {
    headers,
    redirect: "manual",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    body: buf.toString("utf8"),
  };
}

function assetRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)) {
    refs.add(m[1].split("?")[0]);
  }
  return [...refs];
}

console.log(`\n═══ Staging smoke: ${base} ═══`);

const html = await req("/");
assert.equal(html.status, 200, `HTML status ${html.status}`);
assert.match(html.type, /text\/html/i);
assert.doesNotMatch(html.body, /CORS_ORIGIN_NOT_ALLOWED/);
console.log("  ✅ HTML 200");

const refs = assetRefs(html.body);
assert.ok(refs.length > 0, "HTML must reference /assets/*");
console.log(`  … ${refs.length} asset refs`);

const stagingOrigin = new URL(base).origin;

for (const path of refs) {
  const r = await req(path, { origin: stagingOrigin });
  assert.equal(r.status, 200, `${path} status=${r.status} body=${r.body.slice(0, 120)}`);
  assert.doesNotMatch(r.body, /CORS_ORIGIN_NOT_ALLOWED|auth_blocked/i);
  if (path.endsWith(".css")) {
    assert.match(r.type, /text\/css/i, `${path} type=${r.type}`);
  } else if (path.endsWith(".js") || path.endsWith(".mjs")) {
    assert.match(r.type, /javascript|ecmascript/i, `${path} type=${r.type}`);
  }
  console.log(`  ✅ ${path} → 200 ${r.type.split(";")[0]}`);
}

const evil = await req(refs[0], { origin: "https://evil.example" });
assert.equal(evil.status, 403, "evil Origin must remain rejected");
assert.match(evil.body, /CORS_ORIGIN_NOT_ALLOWED/);
console.log("  ✅ evil Origin still 403 JSON (CORS intact)");

const api = await req("/api/cases", { origin: stagingOrigin });
assert.ok(
  api.status === 401 || api.status === 403,
  `protected API must stay gated, got ${api.status}`,
);
console.log(`  ✅ /api/cases → ${api.status} (still protected)`);

console.log("\n✅ staging asset-delivery smoke PASS\n");
