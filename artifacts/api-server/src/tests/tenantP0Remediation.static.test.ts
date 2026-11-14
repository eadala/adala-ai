/**
 * ADALA-SEC-TENANT-P0-005 — static regression for closed P0 findings.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("F-TENANT-OFFICE-IDOR-001", () => {
  const office = read("modules/marketplace/office.ts");
  it("office nested routes use requireAuthWithTenant + path match", () => {
    assert.match(office, /requireAuthWithTenant/);
    assert.match(office, /requirePathOfficeMatchesTenant/);
    assert.match(office, /\/office\/my\/:officeId\/services[\s\S]{0,120}requireAuthWithTenant/);
    assert.doesNotMatch(
      office.slice(office.indexOf("/* ── Services")),
      /router\.(get|post|patch|delete)\([^)]+requireAuth,\s*async/,
    );
  });
  it("nested resource mutates include officeId predicate", () => {
    assert.match(office, /eq\(officeServicesTable\.officeId,\s*officeId\)/);
    assert.match(office, /eq\(officeTeamTable\.officeId,\s*officeId\)/);
  });
});

describe("F-TENANT-PAYMENTS-LIST-001", () => {
  it("transactions list scopes by office_id", () => {
    const p = read("modules/financial/payments.ts");
    const start = p.indexOf('"/payments/transactions"');
    const block = p.slice(start, start + 500);
    assert.match(block, /WHERE office_id = \$\{officeId\}/);
  });
});

describe("F-TENANT-RESOLVER-TRACE-001", () => {
  it("resolveTenantWithTrace requires membership for header", () => {
    const t = read("core/tenant/tenantResolver.ts");
    assert.match(t, /HEADER_MEMBERSHIP_OK|HEADER_MEMBERSHIP_DENIED/);
    assert.match(t, /office_members[\s\S]{0,200}headerTenantId/);
    assert.doesNotMatch(t, /role:\s*"api_key"/);
  });
});

describe("F-TENANT-AI-CREDITS-001", () => {
  it("deduct uses tenant context not body officeId", () => {
    const c = read("modules/ai/aiCredits.ts");
    const start = c.indexOf("/ai-credits/deduct");
    const block = c.slice(start, start + 900);
    assert.match(block, /requireAuthWithTenant/);
    assert.match(block, /Ignore client-supplied officeId|tenantId/);
    assert.doesNotMatch(block, /officeId = "default"/);
  });
  it("office ai-credits GET uses tenantId", () => {
    const c = read("modules/ai/aiCredits.ts");
    const start = c.indexOf('"/office/ai-credits"');
    const block = c.slice(start, start + 700);
    assert.match(block, /requireAuthWithTenant/);
    assert.doesNotMatch(block, /office_id = 'default'/);
  });
});

describe("F-TENANT-AI-AGENT-UNSCOPED-001", () => {
  it("logs and workflows are tenant scoped", () => {
    const a = read("modules/ai/ai-agent.ts");
    assert.match(a, /\/ai-agent\/logs[\s\S]{0,200}requireAuthWithTenant/);
    assert.match(a, /WHERE office_id = \$\{officeId\}/);
    assert.match(a, /INSERT INTO ai_workflows \(id, office_id/);
  });
});

describe("F-TENANT-MOYASAR-001 remediation", () => {
  it("signature required and updates include office_id", () => {
    const w = read("modules/integrations/webhook.ts");
    const moyasar = w.slice(w.indexOf("webhook/moyasar"));
    assert.match(moyasar, /webhook_secret not configured/);
    assert.doesNotMatch(moyasar, /signature verification SKIPPED/);
    assert.match(moyasar, /WHERE id = \$\{txId\}::uuid AND office_id = \$\{officeId\}/);
  });
});

describe("pool GUC guard wiring", () => {
  it("db package installs pool GUC guard", () => {
    const idx = readFileSync(
      join(SRC, "../../../lib/db/src/index.ts"),
      "utf8",
    );
    assert.match(idx, /installPoolGucGuard/);
  });
});
