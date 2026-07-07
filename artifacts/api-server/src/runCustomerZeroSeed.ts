/**
 * Enterprise Customer Zero — seed runner
 * pnpm --filter @workspace/api-server exec tsx src/runCustomerZeroSeed.ts [--force]
 */
import "dotenv/config";
import { seedCustomerZero, isCustomerZeroSeeded, CZ_OFFICE_ID, CZ_USERS } from "./modules/platform/customerZeroSeed";

async function main() {
  console.log("🏢 Enterprise Customer Zero — Seed\n");
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL required");
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  const already = await isCustomerZeroSeeded();
  console.log("Office ID:", CZ_OFFICE_ID);
  console.log("Seeded:", already, "| force:", force);

  const result = await seedCustomerZero(force);
  if (result.skipped) {
    console.log("⏭️  Already seeded. Use --force to re-seed.");
    process.exit(0);
  }

  console.log("\n✅ Customer Zero tenant ready");
  console.log("  Clients:", result.clients);
  console.log("  Cases:", result.cases);
  console.log("  Invoices:", result.invoices);
  console.log("  Employees:", result.employees);
  console.log("  Members:", result.members);
  console.log("\nPlaceholder Clerk user IDs (link in pilot):");
  for (const [role, id] of Object.entries(CZ_USERS)) {
    console.log(`  ${role}: ${id}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
