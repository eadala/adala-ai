import assert from "node:assert/strict";
import {
  classifyDemoSeedError,
  isDemoSeedEnabled,
} from "../modules/platform/demoSeedPolicy";

console.log("═══ demoSeedPolicy unit tests ═══");

assert.equal(isDemoSeedEnabled({ NODE_ENV: "production" }), false);
assert.equal(
  isDemoSeedEnabled({ NODE_ENV: "production", DEMO_SEED_ENABLED: "true" }),
  true,
);
assert.equal(
  isDemoSeedEnabled({ NODE_ENV: "production", DEMO_SEED_ENABLED: "false" }),
  false,
);
assert.equal(isDemoSeedEnabled({ NODE_ENV: "development" }), true);
assert.equal(
  isDemoSeedEnabled({ NODE_ENV: "development", DEMO_SEED_ENABLED: "false" }),
  false,
);
console.log("  ✅ Production environment guard");

assert.deepEqual(
  classifyDemoSeedError({ code: "42703", message: 'column "case_number" does not exist' }),
  { code: "42703", reason: "undefined_column" },
);
assert.deepEqual(
  classifyDemoSeedError({ message: 'column "case_number" of relation "cases" does not exist' }),
  { code: "42703", reason: "undefined_column" },
);
assert.deepEqual(
  classifyDemoSeedError({ code: "42P01", message: 'relation "cases" does not exist' }),
  { code: "42P01", reason: "undefined_table" },
);
assert.deepEqual(
  classifyDemoSeedError({ code: "23503", message: "foreign key violation" }),
  { code: "23503", reason: "foreign_key_violation" },
);
assert.deepEqual(
  classifyDemoSeedError({ code: "23505", message: "duplicate key value" }),
  { code: "23505", reason: "unique_violation" },
);
assert.equal(classifyDemoSeedError(new Error("boom")).reason, "seed_failed");
console.log("  ✅ classifyDemoSeedError reports real cause (not table-may-not-exist)");

console.log("✅ demoSeedPolicy: all checks passed");
