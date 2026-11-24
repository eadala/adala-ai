/**
 * Quick-create SPA routes — must render list pages, not the catch-all NotFound.
 * Run: pnpm --filter @workspace/adala run test:create-routes
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appTsx = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
const notFoundTsx = readFileSync(resolve(__dirname, "../pages/not-found.tsx"), "utf8");

const routePaths = [...appTsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
const routeSet = new Set(routePaths);

function routeLine(path: string): string {
  const line = appTsx.split("\n").find((l) => l.includes(`path="${path}"`));
  assert.ok(line, `missing Route line for ${path}`);
  return line;
}

function assertRendersPageNotNotFound(path: string, pageTag: string): void {
  assert.ok(routeSet.has(path), `expected registered route ${path}`);
  const line = routeLine(path);
  assert.match(line, /ProtectedRoute/, `${path} should use ProtectedRoute`);
  assert.match(line, new RegExp(`<${pageTag}\\s*/>`), `${path} should render <${pageTag} />`);
  assert.doesNotMatch(line, /NotFound/, `${path} must not render NotFound`);
}

assert.ok(
  notFoundTsx.includes("404 Page Not Found"),
  "NotFound page copy present (catch-all marker)",
);
assert.ok(
  appTsx.includes("<Route><Layout><Suspense fallback={<PageLoader />}><NotFound /></Suspense></Layout></Route>"),
  "catch-all NotFound route remains last-resort only",
);

assertRendersPageNotNotFound("/contracts/new", "Contracts");
assertRendersPageNotNotFound("/invoices/new", "Invoices");
assertRendersPageNotNotFound("/contracts", "Contracts");
assertRendersPageNotNotFound("/invoices", "Invoices");

// Specific /new routes must be declared before list siblings so they win in Switch
const contractsNewIdx = appTsx.indexOf('path="/contracts/new"');
const contractsIdx = appTsx.indexOf('path="/contracts"');
const invoicesNewIdx = appTsx.indexOf('path="/invoices/new"');
const invoicesIdx = appTsx.indexOf('path="/invoices"');
assert.ok(contractsNewIdx > -1 && contractsNewIdx < contractsIdx, "/contracts/new before /contracts");
assert.ok(invoicesNewIdx > -1 && invoicesNewIdx < invoicesIdx, "/invoices/new before /invoices");

console.log("createRoutes.test.ts: all assertions passed");
