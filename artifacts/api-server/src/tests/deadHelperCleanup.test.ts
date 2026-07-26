/**
 * Dead helper cleanup regression — P1a.
 * Run: pnpm --filter @workspace/api-server run test:dead-helper-cleanup
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(SRC, "..");

function walkTs(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walkTs(p, out);
    } else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

const requireAuthTs = readFileSync(join(SRC, "middlewares/requireAuth.ts"), "utf8");
const tenantMiddlewareTs = readFileSync(join(SRC, "middlewares/tenantMiddleware.ts"), "utf8");
const srcFiles = walkTs(SRC);

console.log("\n═══ requireAuthWithTenant single export ═══");

{
  const exportRe = /export\s+async\s+function\s+requireAuthWithTenant\b/g;
  const inRequireAuth = [...requireAuthTs.matchAll(exportRe)];
  assert.equal(inRequireAuth.length, 1, "requireAuth.ts must export requireAuthWithTenant once");

  assert.doesNotMatch(
    tenantMiddlewareTs,
    /export\s+async\s+function\s+requireAuthWithTenant\b/,
    "tenantMiddleware.ts must not export requireAuthWithTenant",
  );
  assert.match(
    tenantMiddlewareTs,
    /export\s+async\s+function\s+requireAuthWithTenantAudit\b/,
    "requireAuthWithTenantAudit must remain",
  );
  assert.match(
    tenantMiddlewareTs,
    /export\s+async\s+function\s+resolveTenantId\b/,
    "resolveTenantId must remain",
  );

  const importersOfTenantMwAuth = srcFiles.filter((f) => {
    if (f.endsWith("tenantMiddleware.ts")) return false;
    const text = readFileSync(f, "utf8");
    return (
      /requireAuthWithTenant/.test(text) &&
      /from\s+["'][^"']*tenantMiddleware["']/.test(text) &&
      /requireAuthWithTenant/.test(
        text.match(/import\s+\{[^}]*\}\s+from\s+["'][^"']*tenantMiddleware["']/)?.[0] ?? "",
      )
    );
  });
  assert.equal(
    importersOfTenantMwAuth.length,
    0,
    `no file may import requireAuthWithTenant from tenantMiddleware; found: ${importersOfTenantMwAuth.join(", ")}`,
  );

  const liveImporters = srcFiles.filter((f) => {
    if (f.endsWith("requireAuth.ts")) return false;
    const text = readFileSync(f, "utf8");
    return /from\s+["'][^"']*middlewares\/requireAuth["']/.test(text) && /requireAuthWithTenant/.test(text);
  });
  assert.ok(liveImporters.length > 0, "live requireAuthWithTenant must still have importers");
  console.log(`  ✅ single requireAuthWithTenant export; ${liveImporters.length} live importers`);
}

console.log("\n═══ deleted retry layer ═══");

{
  assert.equal(
    existsSync(join(SRC, "prevention/retry.layer.ts")),
    false,
    "prevention/retry.layer.ts must be deleted",
  );
  assert.equal(
    existsSync(join(SRC, "recovery/retry.engine.ts")),
    true,
    "recovery/retry.engine.ts must remain",
  );

  const refs = srcFiles.filter((f) => {
    if (f.endsWith("deadHelperCleanup.test.ts")) return false;
    const text = readFileSync(f, "utf8");
    return (
      /retry\.layer/.test(text) ||
      /\bretryWithLimit\b/.test(text) ||
      /\bretryWebhook\b/.test(text) ||
      /\bretryDb\b/.test(text)
    );
  });
  assert.equal(refs.length, 0, `deleted retry layer must have zero refs; found: ${refs.join(", ")}`);

  const engine = readFileSync(join(SRC, "recovery/retry.engine.ts"), "utf8");
  assert.match(engine, /export async function retryWithBackoff/);
  assert.match(engine, /export async function sleep/);
  console.log("  ✅ retry.layer gone; retry.engine untouched");
}

console.log("\n═══ deleted shared helpers ═══");

{
  for (const name of ["errors.ts", "validators.ts", "response.ts"]) {
    assert.equal(
      existsSync(join(SRC, "shared", name)),
      false,
      `shared/${name} must be deleted`,
    );
  }

  const refs = srcFiles.filter((f) => {
    if (f.endsWith("deadHelperCleanup.test.ts")) return false;
    const text = readFileSync(f, "utf8");
    return (
      /shared\/errors/.test(text) ||
      /shared\/validators/.test(text) ||
      /shared\/response/.test(text) ||
      /from\s+["'][^"']*\/shared\/(errors|validators|response)["']/.test(text)
    );
  });
  assert.equal(refs.length, 0, `deleted shared helpers must have zero imports; found: ${refs.join(", ")}`);
  console.log("  ✅ shared/errors|validators|response deleted with zero imports");
}

console.log("\n═══ SA helper left intentionally duplicate ═══");

{
  /* Documented deferral: isSuperAdminUser early-returns when env email list is empty;
     checkIsSuperAdmin still allows Clerk publicMetadata.role === "super_admin". */
  assert.match(tenantMiddlewareTs, /async function isSuperAdminUser/);
  assert.match(requireAuthTs, /export async function checkIsSuperAdmin/);
  assert.match(tenantMiddlewareTs, /if \(!saEmails\.length\) return false;/);
  assert.doesNotMatch(
    requireAuthTs,
    /if \(!saEmails\.length\) return false;/,
  );
  console.log("  ✅ isSuperAdminUser kept (not equivalent to checkIsSuperAdmin)");
}

console.log("\n═══ package / tree sanity ═══");

{
  assert.equal(existsSync(join(ROOT, "package.json")), true);
  console.log("  ✅ api-server package intact");
}

console.log("\n✅ dead helper cleanup regression passed\n");
