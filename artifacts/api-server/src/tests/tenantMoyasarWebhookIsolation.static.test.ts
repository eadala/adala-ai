/**
 * Moyasar webhook isolation — post P0 remediation contract.
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

describe("F-TENANT-MOYASAR-001 remediated", () => {
  it("rejects missing webhook_secret (fail closed)", () => {
    const moyasar = src.slice(src.indexOf("webhook/moyasar"));
    assert.match(moyasar, /webhook_secret not configured/);
    assert.doesNotMatch(moyasar, /signature verification SKIPPED/);
  });

  it("requires signature header", () => {
    assert.match(src, /Missing x-moyasar-signature/);
  });

  it("payment update by txId includes office_id", () => {
    assert.match(src, /WHERE id = \$\{txId\}::uuid AND office_id = \$\{officeId\}/);
  });

  it("payment update by txRef includes office_id", () => {
    assert.match(src, /gateway_payment_id = \$\{txRef\} AND gateway = 'moyasar' AND office_id = \$\{officeId\}/);
  });
});
