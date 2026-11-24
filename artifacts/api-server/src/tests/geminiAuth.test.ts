/**
 * Gemini auth helpers — trim + x-goog-api-key (no ?key= query).
 * Run: pnpm --filter @workspace/api-server run test:gemini-auth
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getGeminiApiKey,
  geminiApiHeaders,
  geminiGenerateContentUrl,
  geminiStreamGenerateContentUrl,
} from "../lib/geminiAuth";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT);

console.log("\n═══ getGeminiApiKey trims whitespace ═══");
{
  const prev = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = "  AIzaSyTestKey  \n";
    assert.equal(getGeminiApiKey(), "AIzaSyTestKey");
    process.env.GEMINI_API_KEY = "   ";
    assert.equal(getGeminiApiKey(), undefined);
    delete process.env.GEMINI_API_KEY;
    assert.equal(getGeminiApiKey(), undefined);
    console.log("  ✅ trim + blank → undefined");
  } finally {
    if (prev === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prev;
  }
}

console.log("\n═══ geminiApiHeaders uses x-goog-api-key ═══");
{
  const headers = geminiApiHeaders("AIzaSyHeaderKey");
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers["x-goog-api-key"], "AIzaSyHeaderKey");
  assert.ok(!("Authorization" in headers));
  assert.throws(() => geminiApiHeaders("  "), /GEMINI_API_KEY/);
  console.log("  ✅ header auth; no Bearer");
}

console.log("\n═══ URLs omit ?key= ═══");
{
  const u = geminiGenerateContentUrl("gemini-2.5-flash");
  assert.equal(
    u,
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  );
  assert.doesNotMatch(u, /\?key=/);
  const s = geminiStreamGenerateContentUrl("gemini-2.5-flash");
  assert.match(s, /streamGenerateContent\?alt=sse$/);
  assert.doesNotMatch(s, /[?&]key=/);
  console.log("  ✅ generateContent / stream URLs have no API key query");
}

console.log("\n═══ no production caller uses ?key= for Gemini ═══");
{
  const hits: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name === "node_modules" || name.name === "dist") continue;
      const p = join(dir, name.name);
      if (name.isDirectory()) walk(p);
      else if (name.name.endsWith(".ts") && !name.name.endsWith(".test.ts")) {
        const src = readFileSync(p, "utf8");
        if (/generativelanguage\.googleapis\.com[^"'`]*\?key=/.test(src)) {
          hits.push(p.replace(SRC + "/", ""));
        }
      }
    }
  }
  walk(SRC);
  assert.deepEqual(hits, [], `unexpected ?key= in: ${hits.join(", ")}`);
  console.log("  ✅ no ?key= Gemini URLs in src");
}

console.log("\n✅ gemini auth tests passed\n");
