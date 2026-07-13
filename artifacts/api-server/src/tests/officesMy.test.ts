/**
 * GET /api/offices/my — trial tenant vs office_page UUID resolution
 * Run: pnpm --filter @workspace/api-server run test:offices-my
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isTrialTenantId,
  isUuid,
  resolveOfficePageLookup,
} from "../lib/officePageResolverLogic";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

const TRIAL_ID = "trial_560de17b7b63";
const OFFICE_UUID = "550e8400-e29b-41d4-a716-446655440000";

console.log("\n═══ officesMy: id helpers ═══");

assert.equal(isTrialTenantId(TRIAL_ID), true);
assert.equal(isTrialTenantId(OFFICE_UUID), false);
assert.equal(isUuid(OFFICE_UUID), true);
assert.equal(isUuid(TRIAL_ID), false);
console.log("  ✅ isTrialTenantId / isUuid distinguish trial scope from office_page PK");

console.log("\n═══ officesMy: resolveOfficePageLookup ═══");

/* Trial user without office_page */
{
  const r = resolveOfficePageLookup({
    tenantId: TRIAL_ID,
    isActiveMember: true,
    registryOfficeId: null,
    uuidMembershipOfficeId: null,
    trialOfficeId: TRIAL_ID,
    trialOfficeName: "مكتب تجريبي",
  });
  assert.equal(r.status, "trial_pending");
  if (r.status === "trial_pending") {
    assert.equal(r.trialOfficeId, TRIAL_ID);
    assert.equal(r.officeName, "مكتب تجريبي");
  }
  console.log("  ✅ trial user without office_page → trial_pending");
}

/* Trial tenant resolved but user also has real uuid membership */
{
  const r = resolveOfficePageLookup({
    tenantId: TRIAL_ID,
    isActiveMember: true,
    registryOfficeId: null,
    uuidMembershipOfficeId: OFFICE_UUID,
    trialOfficeId: TRIAL_ID,
  });
  assert.deepEqual(r, { status: "found", officePageId: OFFICE_UUID });
  console.log("  ✅ trial tenant + uuid membership → prefers office_page uuid");
}

/* Regular user with uuid tenant */
{
  const r = resolveOfficePageLookup({
    tenantId: OFFICE_UUID,
    isActiveMember: true,
    registryOfficeId: OFFICE_UUID,
    uuidMembershipOfficeId: OFFICE_UUID,
    trialOfficeId: null,
  });
  assert.deepEqual(r, { status: "found", officePageId: OFFICE_UUID });
  console.log("  ✅ regular user with uuid tenant → found");
}

/* Tenant not linked to user membership */
{
  const r = resolveOfficePageLookup({
    tenantId: TRIAL_ID,
    isActiveMember: false,
    registryOfficeId: null,
    uuidMembershipOfficeId: null,
    trialOfficeId: null,
  });
  assert.equal(r.status, "forbidden");
  console.log("  ✅ non-member → forbidden (cross-tenant blocked)");
}

/* Unknown text tenant (not trial, not uuid) */
{
  const r = resolveOfficePageLookup({
    tenantId: "legacy_text_office",
    isActiveMember: true,
    registryOfficeId: null,
    uuidMembershipOfficeId: null,
    trialOfficeId: null,
  });
  assert.equal(r.status, "not_found");
  console.log("  ✅ unknown text tenant → not_found");
}

/* Registry uuid when tenant is still trial_* */
{
  const r = resolveOfficePageLookup({
    tenantId: TRIAL_ID,
    isActiveMember: true,
    registryOfficeId: OFFICE_UUID,
    uuidMembershipOfficeId: null,
    trialOfficeId: TRIAL_ID,
  });
  assert.deepEqual(r, { status: "found", officePageId: OFFICE_UUID });
  console.log("  ✅ registry uuid overrides trial tenant for office_page lookup");
}

console.log("\n═══ officesMy: handler wiring ═══");

const officeSrc = readSrc("modules/marketplace/office.ts");
assert.match(officeSrc, /fetchOfficePageForUser\(req\.userId, tenantId\)/);
assert.match(officeSrc, /OFFICE_PAGE_NOT_CREATED/);
assert.match(officeSrc, /case "trial_pending"/);
const handlerBlock = officeSrc.match(/async function handleGetMyOffice[\s\S]*?^}/m)?.[0] ?? "";
assert.ok(handlerBlock.length > 0, "handleGetMyOffice block found");
assert.doesNotMatch(handlerBlock, /eq\(officePageTable\.id,/);
console.log("  ✅ handleGetMyOffice uses resolver — no direct office_page.id query in handler");

const resolverSrc = readSrc("lib/officePageResolver.ts");
assert.match(resolverSrc, /fetchOfficePageForUser/);
assert.match(resolverSrc, /office_id ~ '\^\[0-9a-f\]/);
console.log("  ✅ resolver queries uuid memberships separately from trial scope");

console.log("\n✅ officesMy: all checks passed\n");
