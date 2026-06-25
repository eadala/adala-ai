/**
 * JLWM — Justice Legal World Model
 * Main router: aggregates all sub-module routers.
 * Registered in src/routes/index.ts under router.use(jlwmRouter).
 */

import { Router } from "express";
import memoryGraphRouter   from "./memoryGraph";
import worldStateRouter    from "./worldState";
import digitalTwinsRouter  from "./digitalTwins";
import recommendationsRouter from "./recommendations";
import commandCenterRouter from "./commandCenter";

export { ensureJLWMSchema, seedJLWMDemoData } from "./jlwm.schema";

const jlwmRouter = Router();

jlwmRouter.use(memoryGraphRouter);
jlwmRouter.use(worldStateRouter);
jlwmRouter.use(digitalTwinsRouter);
jlwmRouter.use(recommendationsRouter);
jlwmRouter.use(commandCenterRouter);

export default jlwmRouter;
