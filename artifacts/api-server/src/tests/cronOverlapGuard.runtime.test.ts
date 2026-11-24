/**
 * Runtime tests for process-local cron overlap protection (Stage 10.6).
 * Run: pnpm --filter @workspace/api-server run test:cron-overlap
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CRON_JOB_NAMES,
  getRunningCronJobs,
  isCronJobRunning,
  resetCronOverlapLocksForTests,
  withCronOverlapProtection,
} from "../lib/cronOverlapGuard";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

resetCronOverlapLocksForTests();

console.log("\n═══ discovery: non-Stripe cron registrations use overlap guard ═══");
{
  const agent = read("cron/agentCron.ts");
  const email = read("cron/emailCron.ts");
  const logRot = read("cron/logRotationCron.ts");
  const monitoring = read("cron/monitoringCron.ts");
  const demo = read("modules/platform/demo-sync.ts");

  for (const [name, src] of [
    ["agentCron", agent],
    ["emailCron", email],
    ["logRotationCron", logRot],
    ["monitoringCron", monitoring],
    ["demo-sync", demo],
  ] as const) {
    assert.match(src, /withCronOverlapProtection/, `${name} must wrap scheduled runs`);
    assert.match(src, /CRON_JOB_NAMES/, `${name} must use shared job names`);
  }

  assert.match(agent, /CRON_JOB_NAMES\.agentRun/);
  assert.match(agent, /CRON_JOB_NAMES\.agentDailySnapshot/);
  assert.match(agent, /CRON_JOB_NAMES\.backupTenant/);
  assert.match(agent, /CRON_JOB_NAMES\.backupFull/);
  assert.match(email, /CRON_JOB_NAMES\.email/);
  assert.match(logRot, /CRON_JOB_NAMES\.logRotation/);
  assert.match(monitoring, /CRON_JOB_NAMES\.monitoring/);
  assert.match(demo, /CRON_JOB_NAMES\.demoSync/);
  console.log("  ✅ all non-Stripe scheduled crons wired to shared guard");
}

console.log("\n═══ stripe reconciliation remains unchanged ═══");
{
  const stripe = read("jobs/stripeReconcile.ts");
  assert.doesNotMatch(stripe, /withCronOverlapProtection|cronOverlapGuard|CRON_JOB_NAMES/);
  assert.match(stripe, /startReconciliationCron/);
  assert.match(stripe, /setInterval/);
  console.log("  ✅ stripeReconcile.ts untouched by overlap guard");
}

console.log("\n═══ runtime: first run starts normally ═══");
{
  resetCronOverlapLocksForTests();
  let ran = false;
  const result = await withCronOverlapProtection("job-a", async () => {
    ran = true;
    assert.equal(isCronJobRunning("job-a"), true);
    return 42;
  });
  assert.deepEqual(result, { status: "completed", result: 42 });
  assert.equal(ran, true);
  assert.equal(isCronJobRunning("job-a"), false);
  console.log("  ✅ first run completes and returns result");
}

console.log("\n═══ runtime: overlapping run of same job is skipped ═══");
{
  resetCronOverlapLocksForTests();
  const warnings: Array<{ payload: Record<string, unknown>; message: string }> = [];
  let starts = 0;

  const first = withCronOverlapProtection("job-overlap", async () => {
    starts += 1;
    await delay(40);
    return "first";
  });

  await delay(5);
  const second = await withCronOverlapProtection(
    "job-overlap",
    async () => {
      starts += 1;
      return "second";
    },
    {
      logWarn: (payload, message) => {
        warnings.push({ payload, message });
      },
    },
  );

  const firstResult = await first;
  assert.deepEqual(firstResult, { status: "completed", result: "first" });
  assert.deepEqual(second, { status: "skipped" });
  assert.equal(starts, 1);
  console.log("  ✅ second overlapping run skipped; only one body executed");
}

console.log("\n═══ runtime: different jobs can run concurrently ═══");
{
  resetCronOverlapLocksForTests();
  let aActive = false;
  let bSawA = false;

  const a = withCronOverlapProtection(CRON_JOB_NAMES.email, async () => {
    aActive = true;
    await delay(40);
    aActive = false;
    return "email";
  });

  await delay(5);
  const b = await withCronOverlapProtection(CRON_JOB_NAMES.monitoring, async () => {
    bSawA = aActive;
    return "monitoring";
  });

  const aResult = await a;
  assert.deepEqual(aResult, { status: "completed", result: "email" });
  assert.deepEqual(b, { status: "completed", result: "monitoring" });
  assert.equal(bSawA, true);
  console.log("  ✅ distinct job names run at the same time");
}

console.log("\n═══ runtime: lock released after success ═══");
{
  resetCronOverlapLocksForTests();
  await withCronOverlapProtection("job-success", async () => "ok");
  assert.equal(isCronJobRunning("job-success"), false);
  assert.deepEqual(getRunningCronJobs(), []);

  const again = await withCronOverlapProtection("job-success", async () => "again");
  assert.deepEqual(again, { status: "completed", result: "again" });
  console.log("  ✅ lock cleared after successful run");
}

console.log("\n═══ runtime: lock released after failure ═══");
{
  resetCronOverlapLocksForTests();
  await assert.rejects(
    () =>
      withCronOverlapProtection("job-fail", async () => {
        throw new Error("boom");
      }),
    /boom/,
  );
  assert.equal(isCronJobRunning("job-fail"), false);
  assert.deepEqual(getRunningCronJobs(), []);
  console.log("  ✅ lock cleared after thrown failure");
}

console.log("\n═══ runtime: next schedule runs after prior failure ═══");
{
  resetCronOverlapLocksForTests();
  await assert.rejects(
    () =>
      withCronOverlapProtection("job-retry", async () => {
        throw new Error("first-fail");
      }),
    /first-fail/,
  );

  const next = await withCronOverlapProtection("job-retry", async () => "recovered");
  assert.deepEqual(next, { status: "completed", result: "recovered" });
  console.log("  ✅ subsequent run after failure is allowed");
}

console.log("\n═══ runtime: skipped runs produce expected log/event ═══");
{
  resetCronOverlapLocksForTests();
  const warnings: Array<{ payload: Record<string, unknown>; message: string }> = [];

  const long = withCronOverlapProtection("job-log", async () => {
    await delay(40);
    return true;
  });
  await delay(5);
  const skipped = await withCronOverlapProtection(
    "job-log",
    async () => false,
    {
      logWarn: (payload, message) => {
        warnings.push({ payload, message });
      },
    },
  );
  await long;

  assert.deepEqual(skipped, { status: "skipped" });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.payload.job, "job-log");
  assert.equal(warnings[0]?.payload.event, "cron_overlap_skipped");
  assert.match(warnings[0]?.message ?? "", /already running/);
  console.log("  ✅ structured warning includes job + cron_overlap_skipped");
}

console.log("\n═══ architecture: single-process deploy (no multi-replica) ═══");
{
  const compose = readFileSync(
    join(ROOT, "..", "..", "..", "docker-compose.yml"),
    "utf8",
  );
  assert.match(compose, /container_name:\s*adala-app/);
  assert.doesNotMatch(compose, /replicas:\s*[2-9]/);

  const guard = read("lib/cronOverlapGuard.ts");
  assert.match(guard, /Process-local cron overlap protection/);
  assert.doesNotMatch(guard, /pg_advisory|ioredis|createClient\(/);
  assert.match(guard, /runningJobs = new Set/);
  console.log("  ✅ single adala-app container; process-local Set lock only");
}

resetCronOverlapLocksForTests();
console.log("\n✅ cronOverlapGuard runtime tests passed\n");
