/**
 * ADALA-ARC-TENANT-SECURITY-004 — static evidence for Moyasar webhook isolation gaps.
 * Run: pnpm exec tsx --test src/tests/tenantMoyasarWebhookIsolation.static.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../modules/integrations/webhook.ts"),
  "utf8",
);

describe("F-TENANT-MOYASAR-001 static isolation gaps", () => {
  it("office_id is taken from unverified body metadata", () => {
    assert.match(src, /body\.metadata\?\.office_id/);
  });

  it("signature verification can be skipped when secret missing", () => {
    assert.match(src, /signature verification SKIPPED/);
  });

  it("payment update by txId lacks office_id predicate", () => {
    const block = src.slice(src.indexOf("if (txId)"), src.indexOf("else if (txRef)"));
    assert.match(block, /WHERE id = \$\{txId\}::uuid/);
    assert.doesNotMatch(block, /office_id/);
  });

  it("payment update by txRef lacks office_id predicate", () => {
    const start = src.indexOf("else if (txRef)");
    const block = src.slice(start, src.indexOf("/* If no existing transaction", start));
    assert.match(block, /WHERE gateway_payment_id = \$\{txRef\}/);
    assert.doesNotMatch(block, /office_id/);
  });
});
