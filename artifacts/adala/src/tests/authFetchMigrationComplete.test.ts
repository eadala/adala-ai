/**
 * Task 5 — protected /api calls must use authFetch (not bare fetch).
 * Run: pnpm --filter @workspace/adala run test:auth-fetch-migration
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const PUBLIC_OK = [
  "/api/billing/plans",
  "/api/healthz",
  "/api/status",
  "/api/monitoring/client-error",
  "/api/metrics/vitals",
  "/api/metrics/route-analytics",
  "/api/push/vapid-public-key",
  "/api/adoul/lead",
  "/api/adoul/marketing",
  "/api/office/public",
  "/api/client-auth/login",
  "/api/client-auth/register",
  "/api/client-auth/request-otp",
  "/api/client-auth/verify-otp",
  "/api/client-auth/me",
  "/api/client-auth/logout",
  "/api/client-auth/link-token",
  "/api/invoices/public/",
  "/api/signatures/token",
  "/api/platform/modules",
  "/api/landing-variant",
  "/api/home/content",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "tests" || name === "node_modules") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !p.endsWith("lib/authFetch.ts")) out.push(p);
  }
  return out;
}

function isPublic(look: string, file: string): boolean {
  if (PUBLIC_OK.some((p) => look.includes(p))) return true;
  if (look.includes("/api/office/public")) return true;
  if (file.includes("portal-view") && look.includes("/api/portal/")) return true;
  if (/\/api\/portal\/\$\{/.test(look)) return true;
  if (look.includes("uploadURL")) return true;
  return false;
}

const offenders: string[] = [];
for (const file of walk(SRC)) {
  const src = readFileSync(file, "utf8");
  const re = /(?<![\w])fetch\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const idx = m.index;
    const before = src.slice(Math.max(0, idx - 10), idx);
    if (/auth$|public$/i.test(before)) continue;
    const look = src.slice(idx, idx + 300);
    if (!/\/api\b|\$\{BASE\}|\$\{BASE_URL\}/.test(look) && !/fetch\(\s*uploadURL/.test(look)) continue;
    if (isPublic(look, file)) continue;
    if (/fetch\(\s*uploadURL/.test(look)) continue;
    const line = src.slice(0, idx).split("\n").length;
    offenders.push(`${file.replace(SRC + "/", "")}:${line}`);
  }
}

assert.deepEqual(offenders, [], `protected bare fetch remaining:\n${offenders.join("\n")}`);
console.log("✅ no protected frontend API request remains on bare fetch");
