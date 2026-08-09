/**
 * Stage 18 — JLWM EventBus canonical Office UUID ownership.
 * Run: pnpm --filter @workspace/api-server run test:jlwm-eventbus-ownership
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  logJlwmSkip,
  resolveJlwmOfficeId,
  runOwnedJlwmRebuild,
} from "../lib/jlwmOwnership";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");

const OFFICE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const OFFICE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

const ownershipTs = readFileSync(join(SRC, "lib/jlwmOwnership.ts"), "utf8");
const jlwmIndexTs = readFileSync(join(SRC, "modules/jlwm/index.ts"), "utf8");
const enterpriseTs = readFileSync(join(SRC, "modules/jlwm/enterpriseReport.ts"), "utf8");

console.log("\n═══ resolveJlwmOfficeId — UUID only ═══");
{
  assert.equal(resolveJlwmOfficeId(OFFICE_A), OFFICE_A);
  assert.equal(resolveJlwmOfficeId(OFFICE_B), OFFICE_B);
  for (const bad of [null, undefined, "", "default", "platform", "trial_abc", "not-a-uuid", "random-text"]) {
    assert.equal(resolveJlwmOfficeId(bad), null, `must reject ${String(bad)}`);
  }
  assert.doesNotMatch(ownershipTs, /\?\?\s*["']default["']/);
  assert.doesNotMatch(ownershipTs, /resolveAutopilotOfficeId/);
  assert.match(ownershipTs, /classifyTenantId/);
  assert.match(ownershipTs, /toUuid/);
  console.log("  ✅ default/platform/trial_*/missing/text rejected");
}

console.log("\n═══ EventBus schedule path is UUID-gated ═══");
{
  assert.match(jlwmIndexTs, /resolveJlwmOfficeId/);
  assert.match(jlwmIndexTs, /runOwnedJlwmRebuild/);
  assert.match(jlwmIndexTs, /logJlwmSkip/);
  assert.match(jlwmIndexTs, /rebuildJLWMFromLiveData/);
  assert.doesNotMatch(jlwmIndexTs, /officeId\s*\?\?\s*["']default["']/);
  /* Must not schedule with raw truthy non-UUID alone */
  assert.match(jlwmIndexTs, /if\s*\(\s*!officeId\s*\)/);
  console.log("  ✅ scheduleRebuild uses resolveJlwmOfficeId before debounce");
}

console.log("\n═══ rebuildJLWMFromLiveData refuses non-canonical officeId ═══");
{
  assert.match(enterpriseTs, /resolveJlwmOfficeId\(officeIdRaw\)/);
  assert.match(enterpriseTs, /logJlwmSkip/);
  assert.match(
    enterpriseTs,
    /return\s*\{\s*worldState:\s*false,\s*caseTwins:\s*0,\s*clientTwins:\s*0,\s*memoryNodes:\s*0\s*\}/,
  );
  console.log("  ✅ rebuild entry fail-closed; no tenant writes without UUID");
}

console.log("\n═══ invoice exposure scoped by case_id AND office_id ═══");
{
  const invBlock = enterpriseTs.slice(
    enterpriseTs.indexOf("financial_exposure"),
    enterpriseTs.indexOf("financial_exposure") + 800,
  );
  /* Locate the exposure SELECT near case twin rebuild */
  const exposureIdx = enterpriseTs.indexOf("AS exposure");
  assert.ok(exposureIdx > 0, "exposure aggregate must exist");
  const window = enterpriseTs.slice(Math.max(0, exposureIdx - 220), exposureIdx + 80);
  assert.match(window, /case_id\s*=\s*\$\{c\.id\}/);
  assert.match(window, /office_id\s*=\s*\$\{officeId\}/);
  assert.doesNotMatch(
    window,
    /FROM client_invoices WHERE case_id=\$\{c\.id\} AND status/,
    "must not query invoices by case_id alone",
  );
  /* Defense: office A canonical id cannot be substituted by office B in WHERE */
  assert.notEqual(OFFICE_A, OFFICE_B);
  assert.ok(invBlock.includes("office_id") || window.includes("office_id"));
  console.log("  ✅ case twin invoice exposure requires office_id (blocks cross-office case_id collision)");
}

async function main() {
  console.log("\n═══ canonical office A → rebuild runs with exact UUID ═══");
  {
    const seen: string[] = [];
    const result = await runOwnedJlwmRebuild({
      officeIdRaw: OFFICE_A,
      trigger: "case_created",
      eventType: "CASE_CREATED",
      eventId: "evt-1",
      rebuildFn: async (officeId, trigger) => {
        seen.push(`${officeId}:${trigger}`);
      },
    });
    assert.equal(result, "ok");
    assert.deepEqual(seen, [`${OFFICE_A}:case_created`]);
    console.log("  ✅ office A schedules rebuild for office A only");
  }

  console.log("\n═══ invalid ownership → no rebuild / no write ═══");
  {
    for (const bad of [undefined, null, "", "default", "platform", "trial_xyz", "arbitrary-text"]) {
      let called = 0;
      const result = await runOwnedJlwmRebuild({
        officeIdRaw: bad,
        trigger: "case_updated",
        eventType: "CASE_UPDATED",
        eventId: "evt-bad",
        rebuildFn: async () => {
          called += 1;
        },
      });
      assert.equal(result, "skipped", `must skip for ${String(bad)}`);
      assert.equal(called, 0, `must not write for ${String(bad)}`);
    }
    console.log("  ✅ invalid ownership never invokes rebuildFn");
  }

  console.log("\n═══ structured skip log; never throws into EventBus ═══");
  {
    assert.doesNotThrow(() => {
      logJlwmSkip({
        trigger: "case_created",
        eventType: "CASE_CREATED",
        eventId: "evt-2",
        officeIdRaw: "default",
        reason: "NON_UUID_OFFICE_ID",
      });
    });
    const skipped = await runOwnedJlwmRebuild({
      officeIdRaw: "platform",
      trigger: "client_added",
      rebuildFn: async () => {
        throw new Error("must not run");
      },
    });
    assert.equal(skipped, "skipped");
    console.log("  ✅ skip is non-throwing; EventBus fan-out safe");
  }

  console.log("\n═══ other rebuild queries remain office-scoped ═══");
  {
    /* Audit companions: tasks/documents near case twin already scoped */
    assert.match(enterpriseTs, /FROM tasks WHERE case_id=\$\{c\.id\} AND office_id=\$\{officeId\}/);
    assert.match(enterpriseTs, /FROM documents WHERE case_id=\$\{c\.id\} AND office_id=\$\{officeId\}/);
    assert.match(enterpriseTs, /FROM cases WHERE client_id=\$\{cl\.id\} AND office_id=\$\{officeId\}/);
    assert.match(
      enterpriseTs,
      /FROM client_invoices WHERE client_id=\$\{cl\.id\} AND office_id=\$\{officeId\}/,
    );
    console.log("  ✅ companion case/client twin reads already office-scoped; only invoice exposure needed fix");
  }

  console.log("\n✅ jlwmEventBusOwnership: all assertions passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
