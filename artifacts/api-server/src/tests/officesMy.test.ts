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
import { buildGetMyOfficeHttpResult } from "../lib/officeMyResponse";

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

console.log("\n═══ officesMy: HTTP mapping (soft pending vs hard not found) ═══");

/* Existing office / trial with no marketplace page → 200 soft payload */
{
  const http = buildGetMyOfficeHttpResult({
    kind: "trial_pending",
    trialOfficeId: TRIAL_ID,
    officeName: "مكتب المحاماة",
    tenantId: TRIAL_ID,
  });
  assert.equal(http.status, 200);
  assert.equal(http.body.code, "OFFICE_PAGE_NOT_CREATED");
  assert.equal(http.body.marketplacePageCreated, false);
  assert.equal(http.body.name, "مكتب المحاماة");
  assert.equal(http.body.trialOfficeId, TRIAL_ID);
  assert.equal(http.body.tenantId, TRIAL_ID);
  assert.equal(http.body.id, undefined, "must not invent a marketplace page id");
  console.log("  ✅ existing office with no marketplace page → 200 OFFICE_PAGE_NOT_CREATED");
}

/* Existing office with marketplace page → 200 office row */
{
  const officeRow = {
    id: OFFICE_UUID,
    name: "مكتب الشمراني",
    slug: "shamrani",
    isPublished: false,
  };
  const http = buildGetMyOfficeHttpResult({
    kind: "found",
    office: officeRow as never,
    tenantId: OFFICE_UUID,
  });
  assert.equal(http.status, 200);
  assert.equal(http.body.id, OFFICE_UUID);
  assert.equal(http.body.name, "مكتب الشمراني");
  assert.equal(http.body.code, undefined);
  console.log("  ✅ existing office with marketplace page → 200 office payload");
}

/* True missing office → 404 OFFICE_NOT_FOUND */
{
  const http = buildGetMyOfficeHttpResult({
    kind: "not_found",
    tenantId: OFFICE_UUID,
  });
  assert.equal(http.status, 404);
  assert.equal(http.body.code, "OFFICE_NOT_FOUND");
  assert.equal(http.body.tenantId, OFFICE_UUID);
  console.log("  ✅ true missing office → 404 OFFICE_NOT_FOUND");
}

console.log("\n═══ officesMy: handler wiring ═══");

const officeSrc = readSrc("modules/marketplace/office.ts");
assert.match(officeSrc, /fetchOfficePageForUser\(req\.userId, tenantId\)/);
assert.match(officeSrc, /buildGetMyOfficeHttpResult/);
const handlerBlock = officeSrc.match(/async function handleGetMyOffice[\s\S]*?^}/m)?.[0] ?? "";
assert.ok(handlerBlock.length > 0, "handleGetMyOffice block found");
assert.doesNotMatch(handlerBlock, /eq\(officePageTable\.id,/);
assert.match(handlerBlock, /buildGetMyOfficeHttpResult/);
console.log("  ✅ handleGetMyOffice uses resolver + soft-pending HTTP mapper");

const responseSrc = readSrc("lib/officeMyResponse.ts");
assert.match(responseSrc, /OFFICE_PAGE_NOT_CREATED/);
assert.match(responseSrc, /status: 200/);
assert.match(responseSrc, /trial_pending/);
assert.match(responseSrc, /OFFICE_NOT_FOUND/);
assert.match(responseSrc, /case "trial_pending":\s*return \{\s*status: 200,/s);
assert.match(responseSrc, /case "not_found":\s*return \{\s*status: 404,/s);
console.log("  ✅ officeMyResponse: trial_pending is soft 200; not_found stays 404");

const resolverSrc = readSrc("lib/officePageResolver.ts");
assert.match(resolverSrc, /fetchOfficePageForUser/);
assert.match(resolverSrc, /office_id ~ '\^\[0-9a-f\]/);
console.log("  ✅ resolver queries uuid memberships separately from trial scope");

console.log("\n✅ officesMy: all checks passed\n");
