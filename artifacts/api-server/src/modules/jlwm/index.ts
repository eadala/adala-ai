/**
 * JLWM — Justice Legal World Model
 * Main router: aggregates all sub-module routers.
 * Registered in src/routes/index.ts under router.use(jlwmRouter).
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import memoryGraphRouter      from "./memoryGraph";
import worldStateRouter       from "./worldState";
import digitalTwinsRouter     from "./digitalTwins";
import recommendationsRouter  from "./recommendations";
import commandCenterRouter    from "./commandCenter";
// Phase 2
import predictionEngineRouter from "./predictionEngine";
import futureExplorerRouter   from "./futureExplorer";
import simulationEngineRouter from "./simulationEngine";
import litigationIntelRouter  from "./litigationIntelligence";
// Phase 3
import predictionAccuracyRouter from "./predictionAccuracy";
import executiveIntelRouter     from "./executiveIntelligence";
import legalCOORouter           from "./legalCOO";
import reliabilityRouter        from "./reliabilityEngine";
// Phase 4 — Enterprise Integration, Security & Reliability
import enterpriseReportRouter   from "./enterpriseReport";
// Demo Seed
import { seedNorthSouthDemoData, isJLWMDemoSeeded, clearJLWMDemoData } from "./jlwmDemoSeed";

export { ensureJLWMSchema, seedJLWMDemoData } from "./jlwm.schema";
export { ensureFuturePathsTable }   from "./futureExplorer";
export { ensureSimulationsTable }   from "./simulationEngine";
export { ensureLitigationIntelTable } from "./litigationIntelligence";
export { ensureAccuracyTable }      from "./predictionAccuracy";
export { ensureExecutiveTable }     from "./executiveIntelligence";
export { ensureCOOTable }           from "./legalCOO";
export { ensureReliabilitySchema }  from "./reliabilityEngine";

const jlwmRouter = Router();

// Phase 1
jlwmRouter.use(memoryGraphRouter);
jlwmRouter.use(worldStateRouter);
jlwmRouter.use(digitalTwinsRouter);
jlwmRouter.use(recommendationsRouter);
jlwmRouter.use(commandCenterRouter);

// Phase 2
jlwmRouter.use(predictionEngineRouter);
jlwmRouter.use(futureExplorerRouter);
jlwmRouter.use(simulationEngineRouter);
jlwmRouter.use(litigationIntelRouter);

// Phase 3
jlwmRouter.use(predictionAccuracyRouter);
jlwmRouter.use(executiveIntelRouter);
jlwmRouter.use(legalCOORouter);
jlwmRouter.use(reliabilityRouter);
// Phase 4 — Enterprise
jlwmRouter.use(enterpriseReportRouter);

/* ── Demo Seed Routes (super_admin only) ─────────────────────── */
function isSA(req: any): boolean {
  try {
    const auth = getAuth(req);
    const meta = (auth as any)?.sessionClaims?.publicMetadata as any;
    if (meta?.role === "super_admin") return true;
    const emails = (process.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map((s: string) => s.trim());
    const email  = (auth as any)?.sessionClaims?.email as string ?? "";
    return emails.includes(email);
  } catch { return false; }
}

/** GET /jlwm/seed/status — check if demo data is already seeded */
jlwmRouter.get("/seed/status", async (req, res) => {
  if (!isSA(req)) return res.status(403).json({ error: "super_admin only" });
  try {
    const status = await isJLWMDemoSeeded();
    res.json({ status, message: status.north && status.south ? "already_seeded" : "needs_seed" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /jlwm/seed — run the full JLWM demo seed (idempotent) */
jlwmRouter.post("/seed", async (req, res) => {
  if (!isSA(req)) return res.status(403).json({ error: "super_admin only" });
  try {
    const force  = req.body?.force === true;
    const result = await seedNorthSouthDemoData(force);
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /jlwm/seed — clear demo data for both offices */
jlwmRouter.delete("/seed", async (req, res) => {
  if (!isSA(req)) return res.status(403).json({ error: "super_admin only" });
  try {
    await clearJLWMDemoData();
    res.json({ ok: true, message: "Demo data cleared" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default jlwmRouter;
