/**
 * Stage 16.1 — Billing schema authority + tenant-scoped reads.
 * Run: pnpm --filter @workspace/api-server run test:billing-025
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertTenantBillingOfficeId,
  fetchBillingOverview,
  listTenantPlatformInvoices,
  normalizeMoneySum,
  tenantPlatformInvoiceStats,
} from "../lib/billingTenantReads";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");
const ROOT = join(HERE, "..", "..", "..", "..");

const mig025Path = join(ROOT, "artifacts/api-server/migrations/025_billing_schema_authority.sql");
const preflightPath = join(ROOT, "scripts/db/preflight-migration-025.sql");
const billingTs = readFileSync(join(SRC, "modules/financial/billing.ts"), "utf8");
const helperTs = readFileSync(join(SRC, "lib/billingTenantReads.ts"), "utf8");
const mig025 = readFileSync(mig025Path, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const integ = readFileSync(join(ROOT, "scripts/db/test-migrations.integration.sh"), "utf8");

const OFFICE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const OFFICE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

type Call = { text: string };

function createMockDb(handler: (text: string) => unknown) {
  const captured: Call[] = [];
  return {
    captured,
    execute: async (q: unknown) => {
      const text = (() => {
        try {
          return JSON.stringify(q);
        } catch {
          return String(q);
        }
      })();
      captured.push({ text });
      return handler(text);
    },
  };
}

console.log("\n═══ migration 025 file + repair patterns ═══");

assert.ok(existsSync(mig025Path), "025_billing_schema_authority.sql must exist");
assert.ok(existsSync(preflightPath), "preflight-migration-025.sql must exist");
assert.match(mig025, /CREATE TABLE IF NOT EXISTS office_entitlements/);
assert.match(mig025, /CREATE TABLE IF NOT EXISTS platform_billing_invoices/);
assert.match(mig025, /ADD COLUMN IF NOT EXISTS office_id/);
assert.match(mig025, /ADD COLUMN IF NOT EXISTS stripe_id/);
assert.match(mig025, /ADD COLUMN IF NOT EXISTS "limit"/);
assert.match(mig025, /idx_platform_billing_invoices_office_id/);
assert.match(mig025, /idx_platform_billing_invoices_status/);
assert.match(mig025, /idx_platform_billing_invoices_due_date/);
assert.match(mig025, /uq_office_entitlements_office_key|PRIMARY KEY \(office_id, key\)/);
assert.doesNotMatch(mig025, /DROP TABLE/i);
assert.doesNotMatch(mig025, /USING\s+\w+::numeric/i);
assert.match(preflight, /READ-ONLY|SELECT only/i);
assert.match(integ, /scenario_migration_025_billing|MIGRATION_025/);
console.log("  ✅ migration 025 + preflight + integration harness wiring");

console.log("\n═══ routes use requireAuthWithTenant + helpers ═══");

function routeSlice(marker: string): string {
  const start = billingTs.indexOf(marker);
  assert.ok(start >= 0, `missing route ${marker}`);
  const end = billingTs.indexOf("router.", start + marker.length);
  return billingTs.slice(start, end === -1 ? undefined : end);
}

{
  const overview = routeSlice('router.get("/billing/overview"');
  assert.match(overview, /requireAuthWithTenant/);
  assert.match(overview, /fetchBillingOverview/);
  assert.doesNotMatch(overview, /requireAuth,/);
  assert.doesNotMatch(overview, /FROM platform_billing_invoices\s+WHERE status='unpaid'/);

  const invoices = routeSlice('router.get("/billing/platform-invoices"');
  assert.match(invoices, /requireAuthWithTenant/);
  assert.match(invoices, /listTenantPlatformInvoices/);
  assert.doesNotMatch(invoices, /FROM platform_billing_invoices ORDER BY/);

  const stats = routeSlice('router.get("/billing/platform-invoices\/stats"');
  assert.match(stats, /requireAuthWithTenant/);
  assert.match(stats, /tenantPlatformInvoiceStats/);

  assert.match(billingTs, /\/admin\/billing/);
  assert.match(helperTs, /office_id = \$\{tenantId\}/);
  assert.match(helperTs, /WHERE office_id = \$\{tenantId\}/);
  console.log("  ✅ three GETs tenant-gated; global view stays on admin routes");
}

console.log("\n═══ normalizeMoneySum never returns null/NaN ═══");

assert.equal(normalizeMoneySum(null), 0);
assert.equal(normalizeMoneySum(undefined), 0);
assert.equal(normalizeMoneySum("12.50"), 12.5);
assert.equal(normalizeMoneySum(NaN), 0);
assert.equal(normalizeMoneySum("nope"), 0);
console.log("  ✅ monetary sums normalize to finite numbers");

console.log("\n═══ assertTenantBillingOfficeId rejects platform / non-UUID ═══");

assert.equal(assertTenantBillingOfficeId(OFFICE_A), OFFICE_A);
assert.throws(() => assertTenantBillingOfficeId("platform"), /TENANT_BILLING_FORBIDDEN/);
assert.throws(() => assertTenantBillingOfficeId("trial_abc"), /TENANT_BILLING_FORBIDDEN/);
assert.throws(() => assertTenantBillingOfficeId(""), /TENANT_BILLING_FORBIDDEN/);
console.log("  ✅ unresolved / platform / legacy tenant ids are forbidden for office billing reads");

console.log("\n═══ empty DB shapes + missing Stripe → stable 200 payload ═══");

{
  const mock = createMockDb(() => ({ rows: [] }));
  const overview = await fetchBillingOverview({
    db: mock,
    tenantId: OFFICE_A,
    plans: [{ id: "free", name: "مجاني", color: "#64748B", monthlyPrice: 0 }],
    planOrder: ["free"],
    keyLabels: {},
    getStripeClient: async () => {
      throw new Error("STRIPE_SECRET_KEY missing");
    },
  });
  assert.equal(overview.stripeConfigured, false);
  assert.equal(overview.stripeSubscription, null);
  assert.deepEqual(overview.entitlements, []);
  assert.equal(overview.mrr, 0);
  assert.equal(overview.totalPaid, 0);
  assert.equal(overview.nextDueDate, null);
  assert.ok(mock.captured.every((c) => c.text.includes(OFFICE_A) || c.text.includes("office_page")));
  assert.ok(
    mock.captured.some((c) => /office_ledger/.test(c.text) && c.text.includes(OFFICE_A)),
    "ledger totals must be office-scoped",
  );
  assert.ok(
    mock.captured.some((c) => /platform_billing_invoices/.test(c.text) && c.text.includes(OFFICE_A)),
    "next-due must be office-scoped",
  );

  const invoices = await listTenantPlatformInvoices({ db: mock, tenantId: OFFICE_A });
  assert.deepEqual(invoices, []);

  const stats = await tenantPlatformInvoiceStats({ db: mock, tenantId: OFFICE_A });
  assert.deepEqual(stats, {
    total: 0,
    paid: 0,
    unpaid: 0,
    overdue: 0,
    total_paid: 0,
    total_pending: 0,
  });
  console.log("  ✅ empty tables + missing Stripe yield stable numeric/empty shapes");
}

console.log("\n═══ tenant A cannot see tenant B invoices or totals ═══");

{
  const mock = createMockDb((text) => {
    if (/platform_billing_invoices/.test(text) && text.includes(OFFICE_A)) {
      return { rows: [{ id: "inv-a", office_id: OFFICE_A, amount: 99, status: "paid" }] };
    }
    if (/platform_billing_invoices/.test(text) && text.includes(OFFICE_B)) {
      return { rows: [{ id: "inv-b", office_id: OFFICE_B, amount: 500, status: "paid" }] };
    }
    if (/office_ledger/.test(text) && text.includes(OFFICE_A)) {
      return { rows: [{ mrr: 10, total: 10 }] };
    }
    if (/office_ledger/.test(text) && text.includes(OFFICE_B)) {
      return { rows: [{ mrr: 999, total: 999 }] };
    }
    if (/office_page/.test(text)) return { rows: [{ plan: "pro" }] };
    if (/office_entitlements/.test(text)) return { rows: [] };
    return { rows: [] };
  });

  const invA = await listTenantPlatformInvoices({ db: mock, tenantId: OFFICE_A });
  const invB = await listTenantPlatformInvoices({ db: mock, tenantId: OFFICE_B });
  assert.equal(invA[0]?.id, "inv-a");
  assert.equal(invB[0]?.id, "inv-b");
  assert.notEqual(invA[0]?.id, invB[0]?.id);

  const statsA = await tenantPlatformInvoiceStats({ db: mock, tenantId: OFFICE_A });
  const statsB = await tenantPlatformInvoiceStats({ db: mock, tenantId: OFFICE_B });
  /* mock returns row objects; stats path uses aggregates — ensure filter present */
  assert.ok(mock.captured.filter((c) => /platform_billing_invoices/.test(c.text)).every((c) => {
    return c.text.includes(OFFICE_A) || c.text.includes(OFFICE_B);
  }));
  assert.ok(statsA);
  assert.ok(statsB);

  const overviewA = await fetchBillingOverview({
    db: mock,
    tenantId: OFFICE_A,
    plans: [
      { id: "free", name: "مجاني", color: "#64748B", monthlyPrice: 0 },
      { id: "pro", name: "احترافي", color: "#C9A84C", monthlyPrice: 299 },
    ],
    planOrder: ["free", "pro"],
    keyLabels: {},
  });
  assert.equal(overviewA.mrr, 10);
  assert.equal(overviewA.totalPaid, 10);
  assert.ok(
    !mock.captured.some((c) => /office_ledger/.test(c.text) && !c.text.includes("office_id")),
    "ledger queries must include office_id filter",
  );
  console.log("  ✅ invoice/stats/overview queries are office_id scoped per tenant");
}

console.log("\n═══ subscribe INSERT writes office_id ═══");

{
  const subscribe = routeSlice('router.post("/billing/subscribe"');
  assert.match(subscribe, /requireAuthWithTenant/);
  assert.match(subscribe, /office_id/);
  console.log("  ✅ subscribe stamps office_id for tenant visibility");
}

console.log("\n✅ billingSchemaAuthority025 tests passed\n");
