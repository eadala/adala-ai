import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "index.ts"), "utf8");

test("JLWM demo auto-seed is gated in production", () => {
  assert.match(src, /JLWM_DEMO_ALLOW_PROD/);
  assert.match(src, /NODE_ENV/);
  assert.match(src, /Skipped in production/);
});

test("JLWM demo seed import remains explicit", () => {
  assert.match(src, /seedNorthSouthDemoData/);
});
