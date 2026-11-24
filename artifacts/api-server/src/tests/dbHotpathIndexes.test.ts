/**
 * Focused validation for migration 020 hot-path indexes (Stage 10.7).
 * Run: pnpm --filter @workspace/api-server run test:db-indexes
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(ROOT, "migrations");

function readMig(name: string) {
  return readFileSync(join(migrationsDir, name), "utf8");
}

console.log("\n═══ migration 020 present & CREATE INDEX only ═══");
{
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.includes("020_performance_hotpath_indexes.sql"));
  const mig = readMig("020_performance_hotpath_indexes.sql");

  assert.match(mig, /CREATE INDEX IF NOT EXISTS/);
  assert.doesNotMatch(mig, /CREATE TABLE|ALTER TABLE|DROP INDEX|DROP TABLE/i);
  assert.match(mig, /pg_temp\.create_index_020/);
  assert.match(mig, /020_indexes: skipping/);
  console.log("  ✅ 020 is index-only and legacy-guarded");
}

console.log("\n═══ required hot-path indexes declared ═══");
{
  const mig = readMig("020_performance_hotpath_indexes.sql");
  const required = [
    "idx_office_messages_conversation_created",
    "idx_msgs_office_date",
    "idx_msgs_sender_date",
    "idx_messages_case_id",
    "idx_folder_permissions_user_id",
    "idx_employees_office_status",
    "idx_leaves_employee_status",
    "idx_payroll_employee_period",
    "idx_conv_office",
    "idx_convs_case_id",
    "idx_conv_members_conv",
    "idx_conv_members_user",
    "idx_rcpt_msg",
    "idx_rcpt_user_unread",
    "idx_attach_msg",
    "idx_events_case_id",
    "idx_events_office_start",
  ];
  for (const name of required) {
    assert.match(mig, new RegExp(`CREATE INDEX IF NOT EXISTS ${name}`), name);
  }
  console.log(`  ✅ ${required.length} CREATE INDEX IF NOT EXISTS statements present`);
}

console.log("\n═══ query-pattern justification anchors ═══");
{
  const mig = readMig("020_performance_hotpath_indexes.sql");
  assert.match(mig, /GET \/conversations/);
  assert.match(mig, /GET \/storage\/folders/);
  assert.match(mig, /payroll generate|NOT EXISTS/i);
  assert.match(mig, /conversation_id, created_at DESC/);
  assert.match(mig, /folder_permissions \(user_id\)/);
  console.log("  ✅ comments tie indexes to known hot routes");
}

console.log("\n═══ no duplicate of migration 010 task indexes reintroduced wrongly ═══");
{
  const mig = readMig("020_performance_hotpath_indexes.sql");
  /* tasks indexes already owned by 015 — do not re-add here */
  assert.doesNotMatch(mig, /idx_tasks_office_due|idx_tasks_status/);
  console.log("  ✅ does not re-declare 015 task indexes");
}

console.log("\n✅ db hot-path index tests passed\n");
