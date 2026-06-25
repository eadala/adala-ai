/**
 * Direct JLWM Seed Runner
 * Run with: pnpm --filter @workspace/api-server exec tsx src/runSeed.ts
 */
import "dotenv/config";
import { seedNorthSouthDemoData, isJLWMDemoSeeded } from "./modules/jlwm/jlwmDemoSeed";
import { ensureJLWMSchema } from "./modules/jlwm/jlwm.schema";
import { ensureFuturePathsTable }      from "./modules/jlwm/futureExplorer";
import { ensureSimulationsTable }      from "./modules/jlwm/simulationEngine";
import { ensureLitigationIntelTable }  from "./modules/jlwm/litigationIntelligence";
import { ensureAccuracyTable }         from "./modules/jlwm/predictionAccuracy";
import { ensureExecutiveTable }        from "./modules/jlwm/executiveIntelligence";
import { ensureCOOTable }              from "./modules/jlwm/legalCOO";
import { ensureReliabilitySchema }     from "./modules/jlwm/reliabilityEngine";

async function main() {
  console.log("🌱 JLWM Demo Seed — Starting...");

  /* Ensure all JLWM tables exist */
  console.log("📦 Ensuring JLWM schema...");
  await ensureJLWMSchema();
  await ensureFuturePathsTable();
  await ensureSimulationsTable();
  await ensureLitigationIntelTable();
  await ensureAccuracyTable();
  await ensureExecutiveTable();
  await ensureCOOTable();
  await ensureReliabilitySchema();

  /* Check seeded status */
  const status = await isJLWMDemoSeeded();
  console.log("📊 Current seed status:", status);

  const force = process.argv.includes("--force");
  if (!force && status.north && status.south) {
    console.log("✅ Already seeded. Use --force to re-seed.");
    process.exit(0);
  }

  console.log("🚀 Running full seed (force:", force, ")...");
  const t0 = Date.now();
  const result = await seedNorthSouthDemoData(force);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (result.skipped) {
    console.log("⏭️  Skipped — already seeded.");
  } else {
    console.log(`✅ Done in ${elapsed}s`);
    console.log("  North — clients:", result.north.clients, "cases:", result.north.cases);
    console.log("  South — clients:", result.south.clients, "cases:", result.south.cases);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Seed failed:", e.message);
  console.error(e.stack);
  process.exit(1);
});
