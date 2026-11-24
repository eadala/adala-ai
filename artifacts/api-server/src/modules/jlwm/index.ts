/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; Stage 18 ownership only */
/**
 * JLWM — Justice Legal World Model
 * Main router: aggregates all sub-module routers.
 * Registered in src/routes/index.ts under router.use(jlwmRouter).
 */

import { Router } from "express";
import { requireSuperAdmin, checkIsSuperAdmin } from "../../middlewares/requireAuth";
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
import enterpriseReportRouter, { rebuildJLWMFromLiveData } from "./enterpriseReport";
// Demo Seed
import { seedNorthSouthDemoData, isJLWMDemoSeeded, clearJLWMDemoData } from "./jlwmDemoSeed";
// EventBus
import { eventBus } from "../../core/eventBus";
import {
  logJlwmSkip,
  resolveJlwmOfficeId,
  runOwnedJlwmRebuild,
} from "../../lib/jlwmOwnership";

export { ensureJLWMSchema, seedJLWMDemoData } from "./jlwm.schema";
export { ensureFuturePathsTable }   from "./futureExplorer";
export { ensureSimulationsTable }   from "./simulationEngine";
export { ensureLitigationIntelTable } from "./litigationIntelligence";
export { ensureAccuracyTable }      from "./predictionAccuracy";
export { ensureExecutiveTable }     from "./executiveIntelligence";
export { ensureCOOTable }           from "./legalCOO";
export { ensureReliabilitySchema, selectCaseBundlePrediction }  from "./reliabilityEngine";

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

/* ── Auto-Sync: EventBus Listeners ──────────────────────────── */
/*
 * When a case or client changes in the platform, rebuild JLWM
 * world state + digital twins for that office automatically.
 * Debounced per office: one rebuild per office per 30s max.
 * Stage 18 — only canonical Office UUID ownership may schedule a rebuild.
 */
const pendingRebuild = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRebuild(
  officeIdRaw: string | undefined,
  trigger: string,
  eventType?: string,
  eventId?: string | null,
): void {
  const officeId = resolveJlwmOfficeId(officeIdRaw);
  if (!officeId) {
    /* Fail closed immediately — never debounce invent-style ownership keys */
    logJlwmSkip({
      trigger,
      eventType: eventType ?? null,
      eventId: eventId ?? null,
      officeIdRaw,
      reason:
        officeIdRaw == null || officeIdRaw === ""
          ? "MISSING_CANONICAL_OFFICE_UUID"
          : "NON_UUID_OFFICE_ID",
    });
    return;
  }

  const existing = pendingRebuild.get(officeId);
  if (existing) clearTimeout(existing);
  pendingRebuild.set(officeId, setTimeout(async () => {
    pendingRebuild.delete(officeId);
    try {
      await runOwnedJlwmRebuild({
        officeIdRaw: officeId,
        trigger,
        eventType: eventType ?? null,
        eventId: eventId ?? null,
        rebuildFn: rebuildJLWMFromLiveData,
      });
    } catch { /* non-critical background job — never throw into EventBus */ }
  }, 5_000)); // 5s debounce — waits for burst of changes to settle
}

eventBus.on("CASE_CREATED",  (e) => scheduleRebuild(e.officeId, "case_created", e.type, e.id));
eventBus.on("CASE_UPDATED",  (e) => scheduleRebuild(e.officeId, "case_updated", e.type, e.id));
eventBus.on("CASE_CLOSED",   (e) => scheduleRebuild(e.officeId, "case_closed", e.type, e.id));
eventBus.on("CLIENT_ADDED",  (e) => scheduleRebuild(e.officeId, "client_added", e.type, e.id));

/* ── Demo Seed Routes (super_admin only) ─────────────────────── */
function isSA(req: any): boolean {
  try {
    const auth = getAuth(req);
    const meta = (auth as any)?.sessionClaims?.publicMetadata as any;
    /* SA check now handled by requireSuperAdmin middleware */
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
