/**
 * Stage 16.2b — Cloudflare Insights CSP allowlist (no broad wildcards).
 * Run: pnpm --filter @workspace/api-server run test:csp-insights
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");

const INSIGHTS_SCRIPT = "https://static.cloudflareinsights.com";

const appTs = readFileSync(join(ROOT, "artifacts/api-server/src/app.ts"), "utf8");
const viteTs = readFileSync(join(ROOT, "artifacts/adala/vite.config.ts"), "utf8");
const nginxConf = readFileSync(join(ROOT, "infra/nginx/gateway.conf"), "utf8");
const indexHtml = readFileSync(join(ROOT, "artifacts/adala/index.html"), "utf8");

function scriptSrcSlice(src: string, marker: string): string {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `missing CSP marker: ${marker}`);
  const end = src.indexOf("workerSrc", start);
  const end2 = src.indexOf("worker-src", start);
  const cut = Math.min(
    end === -1 ? src.length : end,
    end2 === -1 ? src.length : end2,
  );
  return src.slice(start, cut);
}

console.log("\n═══ Cloudflare Insights not app-injected ═══");

assert.doesNotMatch(indexHtml, /cloudflareinsights|cf-beacon|beacon\.min\.js/i);
assert.doesNotMatch(appTs, /data-cf-beacon|beacon\.min\.js/);
console.log("  ✅ no app-owned Insights beacon injection (zone/edge injects it)");

console.log("\n═══ helmet + vite + nginx allow Insights script host only ═══");

{
  const helmetScripts = scriptSrcSlice(appTs, "scriptSrc:");
  assert.match(helmetScripts, /https:\/\/static\.cloudflareinsights\.com/);
  assert.match(helmetScripts, /https:\/\/clerk\.adalahai\.com/);
  assert.match(helmetScripts, /https:\/\/challenges\.cloudflare\.com/);
  assert.match(helmetScripts, /https:\/\/js\.stripe\.com/);
  assert.doesNotMatch(helmetScripts, /scriptSrc:[\s\S]*"https:"/);
  assert.doesNotMatch(helmetScripts, /\*\.cloudflareinsights\.com/);

  assert.match(viteTs, /script-src[^"]*https:\/\/static\.cloudflareinsights\.com/);
  assert.match(viteTs, /https:\/\/clerk\.adalahai\.com/);
  assert.match(viteTs, /https:\/\/fonts\.googleapis\.com/);

  assert.match(nginxConf, /Content-Security-Policy/);
  assert.match(nginxConf, /script-src[^"]*https:\/\/static\.cloudflareinsights\.com/);
  assert.doesNotMatch(nginxConf, /script-src[^"]*\*\.cloudflareinsights/);
  console.log("  ✅ script-src allows", INSIGHTS_SCRIPT, "without Insights wildcards");
}

console.log("\n═══ existing CSP surfaces preserved ═══");

{
  assert.match(appTs, /connectSrc:[\s\S]*"'self'"/);
  assert.match(appTs, /fontSrc:[\s\S]*fonts\.gstatic\.com/);
  assert.match(appTs, /frameSrc:[\s\S]*challenges\.cloudflare\.com/);
  assert.match(viteTs, /connect-src 'self'/);
  assert.match(viteTs, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(nginxConf, /connect-src 'self'/);
  assert.match(nginxConf, /fonts\.googleapis\.com/);
  console.log("  ✅ Clerk / fonts / connect / frame directives retained");
}

console.log("\n✅ cloudflareInsightsCsp tests passed\n");
