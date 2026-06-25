/**
 * JLWM — Justice Legal World Model
 * Main router: aggregates all sub-module routers.
 * Registered in src/routes/index.ts under router.use(jlwmRouter).
 */

import { Router } from "express";
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

export { ensureJLWMSchema, seedJLWMDemoData } from "./jlwm.schema";
export { ensureFuturePathsTable }   from "./futureExplorer";
export { ensureSimulationsTable }   from "./simulationEngine";
export { ensureLitigationIntelTable } from "./litigationIntelligence";
export { ensureAccuracyTable }      from "./predictionAccuracy";
export { ensureExecutiveTable }     from "./executiveIntelligence";
export { ensureCOOTable }           from "./legalCOO";

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

export default jlwmRouter;
